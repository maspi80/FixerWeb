import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const CHAT_ALL_CONVERSATION_ID = 'all';
const LOCAL_READ_STATE_PREFIX = 'fixer-chat-read';

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

export function getChatMessageConversationId(message, currentUserId) {
  if (!message?.recipient_user_id) return CHAT_ALL_CONVERSATION_ID;
  const otherUserId = message.sender_user_id === currentUserId ? message.recipient_user_id : message.sender_user_id;
  return getChatConversationId(otherUserId);
}

export function getChatConversationPartnerId(conversationId) {
  return String(conversationId ?? '').startsWith('user:') ? String(conversationId).slice(5) : null;
}

export function normalizeChatMessage(row = {}, profilesById = new Map()) {
  const author = profilesById.get(row.sender_user_id);
  return {
    id: row.id,
    sender_user_id: row.sender_user_id,
    recipient_user_id: row.recipient_user_id ?? null,
    message: row.message ?? '',
    created_at: row.created_at ?? new Date().toISOString(),
    author_name: getChatUserDisplayName(author) || 'Użytkownik',
    author_color: author?.user_color || '#2563EB'
  };
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
    .select('id, sender_user_id, recipient_user_id, message, created_at')
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
    .select('id, sender_user_id, recipient_user_id, message, created_at')
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

export async function createChatMessage({ recipientUserId = null, message }) {
  if (!isSupabaseConfigured) return { data: null, error: null, local: true };
  const text = String(message ?? '').trim();
  if (!text) return { data: null, error: new Error('Wpisz treść wiadomości.') };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ recipient_user_id: recipientUserId || null, message: text })
    .select('id, sender_user_id, recipient_user_id, message, created_at')
    .single();

  return { data, error };
}

export async function deleteChatMessage(messageId) {
  if (!isSupabaseConfigured || !messageId) return { error: null, local: true };
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId);
  return { error };
}
