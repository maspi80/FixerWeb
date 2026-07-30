import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const CHAT_ALL_CONVERSATION_ID = 'all';
const LOCAL_READ_STATE_PREFIX = 'fixer-chat-read';
const CHAT_CONVERSATION_PREFIX = 'conversation:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeProfile(row = {}) {
  return {
    id: row.id,
    email: row.email ?? '',
    username: row.username ?? '',
    full_name: row.full_name ?? '',
    user_color: row.user_color || '#2563EB',
    is_active: row.is_active !== false
  };
}

export function getChatUserDisplayName(profile) {
  return profile?.full_name?.trim() || profile?.username?.trim() || profile?.email?.split('@')[0] || 'Użytkownik';
}

export function getChatConversationId(userId) {
  return userId ? `user:${userId}` : CHAT_ALL_CONVERSATION_ID;
}

export function getChatConversationKey(conversationId) {
  return conversationId ? `${CHAT_CONVERSATION_PREFIX}${conversationId}` : CHAT_ALL_CONVERSATION_ID;
}

export function getChatConversationUuid(conversationKey) {
  const key = String(conversationKey ?? '');
  return key.startsWith(CHAT_CONVERSATION_PREFIX) ? key.slice(CHAT_CONVERSATION_PREFIX.length) : null;
}

export function getChatMessageConversationId(message, currentUserId) {
  if (message?.conversation_id) return getChatConversationKey(message.conversation_id);
  if (!message?.recipient_user_id) return CHAT_ALL_CONVERSATION_ID;
  const otherUserId = message.sender_user_id === currentUserId ? message.recipient_user_id : message.sender_user_id;
  return getChatConversationId(otherUserId);
}

export function getChatConversationPartnerId(conversationId) {
  return String(conversationId ?? '').startsWith('user:') ? String(conversationId).slice(5) : null;
}

export function normalizeChatMessage(row = {}, profilesById = new Map()) {
  const author = profilesById.get(row.sender_user_id);
  const deletedAt = row.deleted_at ?? null;
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? null,
    sender_user_id: row.sender_user_id,
    recipient_user_id: row.recipient_user_id ?? null,
    message: deletedAt ? 'Wiadomość usunięta' : row.message ?? '',
    created_at: row.created_at ?? new Date().toISOString(),
    deleted_at: deletedAt,
    author_name: getChatUserDisplayName(author) || 'Użytkownik',
    author_color: author?.user_color || '#2563EB'
  };
}

function normalizeConversation(row = {}, currentUserId = null, profilesById = new Map()) {
  const members = row.chat_conversation_members ?? row.members ?? [];
  const partnerMember = members.find((member) => member.user_id !== currentUserId) ?? members[0] ?? null;
  const partner = profilesById.get(partnerMember?.user_id) ?? partnerMember?.profile ?? partnerMember?.profiles ?? null;
  const hasParticipantIntegrityIssue = !partnerMember?.user_id || !partner?.id;
  if (hasParticipantIntegrityIssue) {
    console.warn('[FIXER Chat] conversation participant integrity issue', {
      conversationId: row.id,
      currentUserId,
      members
    });
  }
  return {
    id: row.id,
    conversation_key: getChatConversationKey(row.id),
    created_by: row.created_by,
    title: row.title ?? '',
    created_at: row.created_at,
    partner_user_id: partnerMember?.user_id ?? null,
    partner_name: hasParticipantIntegrityIssue ? 'Błąd danych' : getChatUserDisplayName(partner),
    partner_color: partner?.user_color || '#2563EB'
  };
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value ?? '').trim());
}

function logChatSendDiagnostics(payload) {
  if (typeof console === 'undefined') return;
  console.groupCollapsed?.('[FIXER Chat] send message diagnostics');
  console.info('[FIXER Chat] send message payload', payload);
  if (payload?.error) {
    console.error('[FIXER Chat] RLS/send-message error', {
      code: payload.error.code,
      message: payload.error.message,
      details: payload.error.details,
      hint: payload.error.hint,
      error: payload.error
    });
  }
  console.groupEnd?.();
}

export function sortChatMessages(messages = []) {
  return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function getLocalReadStateKey(userId) {
  return `${LOCAL_READ_STATE_PREFIX}:${userId || 'demo'}`;
}

function readLocalChatReadState(userId) {
  try {
    return JSON.parse(localStorage.getItem(getLocalReadStateKey(userId)) || '{}') ?? {};
  } catch {
    return {};
  }
}

function writeLocalChatReadState(userId, state) {
  localStorage.setItem(getLocalReadStateKey(userId), JSON.stringify(state ?? {}));
}

function isMissingReadStateTableError(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return text.includes('chat_read_state') && (text.includes('relation') || text.includes('schema cache') || text.includes('pgrst'));
}

export async function fetchChatUsers(currentUserId) {
  if (!isSupabaseConfigured) return { data: [], error: null, local: true };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, user_color, is_active')
    .eq('is_active', true)
    .neq('id', currentUserId)
    .order('full_name', { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []).map(normalizeProfile), error: null };
}

export async function fetchChatMessages({ currentUserId, recipientUserId = null, profilesById = new Map() }) {
  if (!isSupabaseConfigured || !currentUserId) return { data: [], error: null, local: true };

  let query = supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_user_id, recipient_user_id, message, created_at, deleted_at')
    .order('created_at', { ascending: true })
    .limit(500);

  if (recipientUserId) {
    query = query.or(
      `and(sender_user_id.eq.${currentUserId},recipient_user_id.eq.${recipientUserId}),and(sender_user_id.eq.${recipientUserId},recipient_user_id.eq.${currentUserId})`
    );
  } else {
    query = query.is('recipient_user_id', null);
  }

  const { data, error } = await query;
  if (error) return { data: [], error };
  return { data: sortChatMessages((data ?? []).map((row) => normalizeChatMessage(row, profilesById))), error: null };
}

export async function fetchVisibleChatMessages({ profilesById = new Map() } = {}) {
  if (!isSupabaseConfigured) return { data: [], error: null, local: true };
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_user_id, recipient_user_id, message, created_at, deleted_at')
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) return { data: [], error };
  return { data: sortChatMessages((data ?? []).map((row) => normalizeChatMessage(row, profilesById))), error: null };
}

export async function fetchChatReadState(currentUserId) {
  if (!isSupabaseConfigured || !currentUserId) {
    return { data: readLocalChatReadState(currentUserId), error: null, local: true };
  }

  const { data, error } = await supabase
    .from('chat_read_state')
    .select('conversation_key, last_read_at')
    .eq('user_id', currentUserId);

  if (error) {
    if (isMissingReadStateTableError(error)) return { data: readLocalChatReadState(currentUserId), error: null, fallback: true };
    return { data: readLocalChatReadState(currentUserId), error, fallback: true };
  }

  const state = Object.fromEntries((data ?? []).map((row) => [row.conversation_key, row.last_read_at]));
  writeLocalChatReadState(currentUserId, state);
  return { data: state, error: null };
}

export async function saveChatReadState(currentUserId, conversationKey, lastReadAt) {
  if (!currentUserId || !conversationKey || !lastReadAt) return { error: null };
  const localState = { ...readLocalChatReadState(currentUserId), [conversationKey]: lastReadAt };
  writeLocalChatReadState(currentUserId, localState);

  if (!isSupabaseConfigured) return { error: null, local: true };

  const { error } = await supabase
    .from('chat_read_state')
    .upsert({
      user_id: currentUserId,
      conversation_key: conversationKey,
      last_read_at: lastReadAt
    }, { onConflict: 'user_id,conversation_key' });

  if (error && isMissingReadStateTableError(error)) return { error: null, fallback: true };
  return { error };
}

export async function fetchChatConversations({ currentUserId, profilesById = new Map() }) {
  if (!isSupabaseConfigured || !currentUserId) return { data: [], error: null, local: true };

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, created_by, title, created_at, chat_conversation_members(user_id, deleted_at, profile:profiles(id, email, username, full_name, user_color, is_active))')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: (data ?? []).map((row) => normalizeConversation(row, currentUserId, profilesById)), error: null };
}

export async function createChatConversation({ partnerUserId, title, currentUserId = null } = {}) {
  if (!isSupabaseConfigured) return { data: null, error: null, local: true };
  const cleanPartnerUserId = String(partnerUserId ?? '').trim();
  const cleanTitle = String(title ?? '').trim();
  if (!cleanPartnerUserId) return { data: null, error: new Error('Wybierz użytkownika.') };
  if (!isUuid(cleanPartnerUserId)) return { data: null, error: new Error('Nieprawidłowy identyfikator użytkownika.') };

  const partnerResult = await supabase
    .from('profiles')
    .select('id, email, username, full_name, user_color, is_active')
    .eq('id', cleanPartnerUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (partnerResult.error) return { data: null, error: partnerResult.error };
  if (!partnerResult.data?.id) return { data: null, error: new Error('Wybrany użytkownik nie istnieje albo jest nieaktywny.') };

  const authResult = await supabase.auth.getUser();
  const authUserId = authResult.data?.user?.id ?? null;
  const conversationPayload = {
    participant_user_id: cleanPartnerUserId,
    conversation_title: cleanTitle || null
  };
  const expectedConversationInsertPayload = {
    created_by: authUserId,
    title: cleanTitle || null
  };
  const createResult = await supabase.rpc('create_chat_conversation', {
    ...conversationPayload
  });
  const data = Array.isArray(createResult.data) ? createResult.data[0] : createResult.data;
  const createDiagnostics = {
    authUid: authUserId,
    currentUserId,
    selectedUserId: cleanPartnerUserId,
    conversationPayload,
    createdBy: expectedConversationInsertPayload.created_by,
    expectedConversationInsertPayload,
    conversationInsertResult: {
      data: createResult.data,
      error: createResult.error ? {
        code: createResult.error.code,
        message: createResult.error.message,
        details: createResult.error.details,
        hint: createResult.error.hint
      } : null,
      status: createResult.status,
      statusText: createResult.statusText
    },
    conversationId: data?.id ?? null,
    membershipPayload: data?.id ? [
      { conversation_id: data.id, user_id: authUserId },
      { conversation_id: data.id, user_id: cleanPartnerUserId }
    ] : null,
    membershipInsertResult: null
  };
  if (createResult.error || !data?.id) {
    console.groupCollapsed?.('[FIXER Chat] CREATE FAILURE');
    console.error('[FIXER Chat] create conversation failed', createDiagnostics);
    console.groupEnd?.();
    return { data: null, error: createResult.error ?? new Error('Nie udało się utworzyć rozmowy.') };
  }
  const membersResult = await supabase
    .from('chat_conversation_members')
    .select('conversation_id, user_id, deleted_at')
    .eq('conversation_id', data.id);
  createDiagnostics.membershipInsertResult = {
    data: membersResult.data,
    error: membersResult.error ? {
      code: membersResult.error.code,
      message: membersResult.error.message,
      details: membersResult.error.details,
      hint: membersResult.error.hint
    } : null,
    status: membersResult.status,
    statusText: membersResult.statusText
  };
  console.groupCollapsed?.('[FIXER Chat] CREATE FAILURE');
  console.info('[FIXER Chat] create conversation diagnostics', createDiagnostics);
  if (membersResult.error) console.error('[FIXER Chat] create conversation membership read-back failed', createDiagnostics);
  console.groupEnd?.();
  return { data, error: null };
}

export async function deleteChatConversation(conversationId, { currentUserId = null } = {}) {
  if (!isSupabaseConfigured || !conversationId) return { error: null, local: true };
  const cleanConversationId = String(conversationId ?? '').trim();

  if (!isUuid(cleanConversationId)) {
    const error = new Error('Nieprawidłowy identyfikator rozmowy.');
    return { error };
  }

  const result = await supabase.rpc('hide_chat_conversation', { p_conversation_id: cleanConversationId });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) return { error: result.error };
  return { data: data ?? { id: cleanConversationId, physically_deleted: false }, error: null };
}

export async function createChatMessage({ recipientUserId = null, conversationId = null, message }) {
  if (!isSupabaseConfigured) return { data: null, error: null, local: true };
  const text = String(message ?? '').trim();
  if (!text) return { data: null, error: new Error('Wpisz treść wiadomości.') };

  const { data, error, status, statusText } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId || null, recipient_user_id: conversationId ? null : recipientUserId || null, message: text })
    .select('id, conversation_id, sender_user_id, recipient_user_id, message, created_at, deleted_at')
    .single();

  if (error) {
    logChatSendDiagnostics({
      conversationId,
      recipientUserId,
      status,
      statusText,
      error
    });
    return { data: null, error };
  }

  return { data, error };
}

export async function deleteChatMessage(messageId) {
  if (!isSupabaseConfigured || !messageId) return { error: null, local: true };
  const result = await supabase.rpc('soft_delete_chat_message', { p_message_id: messageId });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  return { data: data ?? null, error: result.error };
}

export async function clearPublicChatHistory() {
  if (!isSupabaseConfigured) return { error: null, local: true };
  const { error } = await supabase.rpc('clear_public_chat_history');
  return { error };
}
