import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const CHAT_ALL_CONVERSATION_ID = 'all';
export const CHAT_GENERAL_LABEL = 'Ogólny';
const LOCAL_READ_STATE_PREFIX = 'fixer-chat-read';
const CHAT_CONVERSATION_PREFIX = 'conversation:';
const PUBLIC_THREAD_TYPE = 'public_thread';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pendingConversationCreates = new Map();

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

export function buildChatProfilesById({
  currentProfile = null,
  users = [],
  conversations = [],
  publicThreads = []
} = {}) {
  const map = new Map();
  const addProfile = (profile) => {
    const normalized = normalizeProfile(profile ?? {});
    if (!normalized.id) return;
    const existing = map.get(normalized.id);
    map.set(normalized.id, existing ? { ...existing, ...normalized } : normalized);
  };

  if (currentProfile?.id) addProfile(currentProfile);
  users.forEach(addProfile);
  conversations.forEach((conversation) => {
    if (!conversation?.partner_user_id) return;
    addProfile({
      id: conversation.partner_user_id,
      full_name: conversation.partner_name,
      user_color: conversation.partner_color,
      is_active: true
    });
  });
  publicThreads.forEach((thread) => {
    if (!thread?.created_by) return;
    addProfile({
      id: thread.created_by,
      full_name: thread.creator_name,
      user_color: thread.creator_color,
      is_active: true
    });
  });

  return map;
}

export function resolveChatMessageAuthor(message, profilesById = new Map()) {
  const senderId = message?.sender_user_id;
  if (senderId) {
    const author = profilesById.get(senderId);
    if (author) return getChatUserDisplayName(author);
  }
  const cachedName = String(message?.author_name ?? '').trim();
  if (cachedName && cachedName !== 'Użytkownik') return cachedName;
  return 'Użytkownik';
}

export function resolveChatMessageAuthorColor(message, profilesById = new Map()) {
  return profilesById.get(message?.sender_user_id)?.user_color || message?.author_color || '#2563EB';
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

export function findLatestUnreadChatConversationId(messages = [], readState = {}, currentUserId = null) {
  let latestConversationId = null;
  let latestTimestamp = -1;
  messages.forEach((message) => {
    if (!message?.id || message.sender_user_id === currentUserId) return;
    const conversationId = getChatMessageConversationId(message, currentUserId);
    const lastRead = readState[conversationId];
    if (lastRead && new Date(message.created_at).getTime() <= new Date(lastRead).getTime()) return;
    const timestamp = new Date(message.created_at).getTime();
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestConversationId = conversationId;
    }
  });
  return latestConversationId;
}

const CHAT_LAST_CONTEXT_PREFIX = 'fixer:chat:last-context';

export function getChatLastContextStorageKey(userId) {
  const scopedUserId = String(userId ?? '').trim();
  return scopedUserId ? `${CHAT_LAST_CONTEXT_PREFIX}:${scopedUserId}` : null;
}

function parseChatLastContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'general') return { type: 'general' };
  if (raw.type === 'thread') {
    const threadId = String(raw.threadId ?? '').trim();
    return threadId ? { type: 'thread', threadId } : null;
  }
  if (raw.type === 'private') {
    const conversationKey = String(raw.conversationKey ?? raw.conversationId ?? '').trim();
    if (!conversationKey || conversationKey.startsWith('user:')) return null;
    return { type: 'private', conversationKey };
  }
  return null;
}

export function readChatLastContext(userId) {
  const storageKey = getChatLastContextStorageKey(userId);
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    return parseChatLastContext(JSON.parse(localStorage.getItem(storageKey) || 'null'));
  } catch {
    return null;
  }
}

export function writeChatLastContext(userId, context) {
  const storageKey = getChatLastContextStorageKey(userId);
  if (!storageKey || typeof window === 'undefined') return;
  const parsed = parseChatLastContext(context);
  if (!parsed) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(parsed));
  } catch {
    // ignore storage failures
  }
}

export function clearChatLastContext(userId) {
  const storageKey = getChatLastContextStorageKey(userId);
  if (!storageKey || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage failures
  }
}

export function buildChatLastContextFromSelection(conversationId, { conversations = [], publicThreads = [] } = {}) {
  const key = String(conversationId ?? '').trim();
  if (!key || key === CHAT_ALL_CONVERSATION_ID) {
    return { type: 'general' };
  }
  if (key.startsWith('user:')) {
    return null;
  }
  const publicThread = publicThreads.find((thread) => thread.conversation_key === key);
  if (publicThread?.id) {
    return { type: 'thread', threadId: publicThread.id };
  }
  const uuid = getChatConversationUuid(key);
  const privateConversation = conversations.find((conversation) => (
    conversation.conversation_key === key
    || conversation.id === uuid
    || (conversation.thread_conversation_ids ?? []).includes(uuid)
  ));
  if (privateConversation?.conversation_key || (uuid && key.startsWith(CHAT_CONVERSATION_PREFIX))) {
    return {
      type: 'private',
      conversationKey: privateConversation?.conversation_key ?? key
    };
  }
  return null;
}

export function resolveChatLastContext(context, { conversations = [], publicThreads = [] } = {}) {
  const parsed = parseChatLastContext(context);
  if (!parsed) return null;
  if (parsed.type === 'general') return CHAT_ALL_CONVERSATION_ID;
  if (parsed.type === 'thread') {
    const thread = publicThreads.find((entry) => entry.id === parsed.threadId);
    return thread?.conversation_key ?? null;
  }
  if (parsed.type === 'private') {
    return conversations.some((conversation) => conversation.conversation_key === parsed.conversationKey)
      ? parsed.conversationKey
      : null;
  }
  return null;
}

export function isChatLastContextStale(context, { conversations = [], publicThreads = [] } = {}) {
  const parsed = parseChatLastContext(context);
  if (!parsed) return true;
  if (parsed.type === 'general') return false;
  if (parsed.type === 'thread') {
    if (!publicThreads.length) return false;
    return !publicThreads.some((thread) => thread.id === parsed.threadId);
  }
  if (parsed.type === 'private') {
    if (!conversations.length) return false;
    return !conversations.some((conversation) => conversation.conversation_key === parsed.conversationKey);
  }
  return true;
}

export function getChatConversationPartnerId(conversationId) {
  return String(conversationId ?? '').startsWith('user:') ? String(conversationId).slice(5) : null;
}

export function isPublicChatThreadId(conversationId, publicThreadIds = null) {
  const uuid = getChatConversationUuid(conversationId) ?? (isUuid(String(conversationId ?? '')) ? String(conversationId) : null);
  if (!uuid) return false;
  if (publicThreadIds instanceof Set) return publicThreadIds.has(uuid);
  if (Array.isArray(publicThreadIds)) return publicThreadIds.includes(uuid);
  return false;
}

function normalizePublicThread(row = {}, profilesById = new Map()) {
  const creator = row.creator ?? profilesById.get(row.created_by) ?? null;
  const creatorName = creator ? getChatUserDisplayName(creator) : '';
  return {
    id: row.id,
    title: String(row.title ?? '').trim(),
    created_by: row.created_by ?? null,
    creator_name: creatorName,
    created_at: row.created_at,
    conversation_key: getChatConversationKey(row.id),
    conversation_type: PUBLIC_THREAD_TYPE
  };
}

function isPrivateChatConversationRow(row = {}) {
  if (row.conversation_type === PUBLIC_THREAD_TYPE) return false;
  const members = row.chat_conversation_members ?? row.members ?? [];
  return members.length > 0;
}

export function normalizeChatMessage(row = {}, profilesById = new Map()) {
  const deletedAt = row.deleted_at ?? null;
  const normalized = {
    id: row.id,
    conversation_id: row.conversation_id ?? null,
    sender_user_id: row.sender_user_id,
    recipient_user_id: row.recipient_user_id ?? null,
    message: deletedAt ? 'Wiadomość usunięta' : row.message ?? '',
    created_at: row.created_at ?? new Date().toISOString(),
    deleted_at: deletedAt,
    author_name: 'Użytkownik',
    author_color: '#2563EB'
  };
  normalized.author_name = resolveChatMessageAuthor(normalized, profilesById);
  normalized.author_color = resolveChatMessageAuthorColor(normalized, profilesById);
  return normalized;
}

function normalizeConversation(row = {}, currentUserId = null, profilesById = new Map()) {
  if (row.conversation_type === PUBLIC_THREAD_TYPE) return null;
  const members = row.chat_conversation_members ?? row.members ?? [];
  if (!members.length) return null;
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
    partner_color: partner?.user_color || '#2563EB',
    thread_conversation_ids: [row.id],
    active_conversation_id: row.id
  };
}

export function getActiveConversationUuid(conversations = [], conversationUuid = null) {
  if (!conversationUuid) return null;
  const match = conversations.find((conversation) => (
    conversation.id === conversationUuid
    || (conversation.thread_conversation_ids ?? []).includes(conversationUuid)
  ));
  return match?.active_conversation_id ?? conversationUuid;
}

function pickConversationThreadTitle(...candidates) {
  const rows = candidates.filter(Boolean);
  if (!rows.length) return '';
  const active = rows.reduce((latest, row) => (
    new Date(row.created_at).getTime() >= new Date(latest.created_at).getTime() ? row : latest
  ));
  const activeTitle = String(active.title ?? '').trim();
  if (activeTitle) return activeTitle;
  return rows.map((row) => String(row.title ?? '').trim()).find(Boolean) || '';
}

export function mergeFetchedChatConversations(current = [], fetched = []) {
  if (!fetched.length) return current;
  return fetched.map((fetchedConversation) => {
    const fetchedTitle = String(fetchedConversation.title ?? '').trim();
    if (fetchedTitle) return fetchedConversation;

    const currentMatch = current.find((conversation) => (
      conversation.id === fetchedConversation.id
      || conversation.active_conversation_id === fetchedConversation.active_conversation_id
      || (conversation.thread_conversation_ids ?? []).some((id) => (
        (fetchedConversation.thread_conversation_ids ?? []).includes(id)
      ))
    ));
    const currentTitle = String(currentMatch?.title ?? '').trim();
    if (!currentTitle) return fetchedConversation;
    return { ...fetchedConversation, title: currentTitle };
  });
}

export function applyConversationTitleUpdate(conversations = [], conversationId, title) {
  const cleanConversationId = String(conversationId ?? '').trim();
  if (!cleanConversationId) return conversations;
  const nextTitle = String(title ?? '').trim();
  return conversations.map((conversation) => {
    if (
      conversation.id === cleanConversationId
      || conversation.active_conversation_id === cleanConversationId
      || (conversation.thread_conversation_ids ?? []).includes(cleanConversationId)
    ) {
      return { ...conversation, title: nextTitle };
    }
    return conversation;
  });
}

export function deduplicatePrivateChatConversations(conversations = []) {
  const fetchedIds = new Set(conversations.map((conversation) => conversation.id));
  const byPartner = new Map();
  const standalone = [];

  conversations.forEach((conversation) => {
    const partnerId = conversation.partner_user_id;
    if (!partnerId) {
      standalone.push({
        ...conversation,
        thread_conversation_ids: conversation.thread_conversation_ids ?? [conversation.id],
        active_conversation_id: conversation.active_conversation_id ?? conversation.id
      });
      return;
    }

    const existing = byPartner.get(partnerId);
    if (!existing) {
      byPartner.set(partnerId, {
        ...conversation,
        thread_conversation_ids: [conversation.id],
        active_conversation_id: conversation.id
      });
      return;
    }

    const threadConversationIds = [...new Set([
      ...(existing.thread_conversation_ids ?? [existing.id]),
      conversation.id
    ])];
    const existingCreatedAt = new Date(existing.created_at).getTime();
    const nextCreatedAt = new Date(conversation.created_at).getTime();
    const oldest = nextCreatedAt < existingCreatedAt ? conversation : existing;
    const newest = nextCreatedAt >= existingCreatedAt ? conversation : existing;

    byPartner.set(partnerId, {
      ...oldest,
      id: oldest.id,
      conversation_key: oldest.conversation_key,
      title: pickConversationThreadTitle(existing, conversation),
      created_at: newest.created_at,
      partner_user_id: partnerId,
      partner_name: oldest.partner_name || newest.partner_name,
      partner_color: oldest.partner_color || newest.partner_color,
      thread_conversation_ids: threadConversationIds,
      active_conversation_id: newest.id
    });
  });

  return [...standalone, ...byPartner.values()]
    .filter((entry) => fetchedIds.has(entry.active_conversation_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getConversationThreadIds(conversations = [], conversationUuid = null) {
  if (!conversationUuid) return [];
  const match = conversations.find((conversation) => (
    conversation.id === conversationUuid
    || (conversation.thread_conversation_ids ?? []).includes(conversationUuid)
  ));
  if (match?.thread_conversation_ids?.length) return match.thread_conversation_ids;
  return [conversationUuid];
}

export function isChatConversationSamePartnerThread(targetConversationKey, activeConversationKey, conversations = []) {
  if (!targetConversationKey || !activeConversationKey) return targetConversationKey === activeConversationKey;
  if (targetConversationKey === activeConversationKey) return true;

  const activeUuid = getChatConversationUuid(activeConversationKey);
  const targetUuid = getChatConversationUuid(targetConversationKey);
  if (!activeUuid || !targetUuid) return false;

  const thread = conversations.find((conversation) => (
    conversation.id === activeUuid
    || (conversation.thread_conversation_ids ?? []).includes(activeUuid)
  ));
  if (!thread?.thread_conversation_ids?.length) return false;

  return thread.thread_conversation_ids.some((conversationId) => (
    getChatConversationKey(conversationId) === targetConversationKey
  ));
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

export async function fetchChatMessages({ currentUserId, recipientUserId = null, conversationId = null, profilesById = new Map() }) {
  if (!isSupabaseConfigured || !currentUserId) return { data: [], error: null, local: true };

  let query = supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_user_id, recipient_user_id, message, created_at, deleted_at')
    .order('created_at', { ascending: true })
    .limit(500);

  if (conversationId) {
    query = query.eq('conversation_id', conversationId);
  } else if (recipientUserId) {
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
    .select('id, created_by, title, created_at, conversation_type, chat_conversation_members(user_id, deleted_at, profile:profiles(id, email, username, full_name, user_color, is_active))')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  const privateRows = (data ?? []).filter(isPrivateChatConversationRow);
  return {
    data: deduplicatePrivateChatConversations(
      privateRows
        .map((row) => normalizeConversation(row, currentUserId, profilesById))
        .filter(Boolean)
    ),
    error: null
  };
}

export async function fetchPublicChatThreads({ profilesById = new Map() } = {}) {
  if (!isSupabaseConfigured) return { data: [], error: null, local: true };

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, created_by, title, created_at, conversation_type, creator:profiles!chat_conversations_created_by_fkey(id, email, username, full_name, user_color, is_active)')
    .eq('conversation_type', PUBLIC_THREAD_TYPE)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return {
    data: (data ?? []).map((row) => normalizePublicThread(row, profilesById)),
    error: null
  };
}

export async function createPublicChatThread(title, { profilesById = new Map(), currentUserId = null } = {}) {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle) return { data: null, error: new Error('Podaj nazwę wątku.') };
  if (cleanTitle.length > 120) return { data: null, error: new Error('Nazwa wątku może mieć maksymalnie 120 znaków.') };

  if (!isSupabaseConfigured) {
    const localId = `local-thread-${Date.now()}`;
    const creator = currentUserId ? profilesById.get(currentUserId) : null;
    return {
      data: normalizePublicThread({
        id: localId,
        title: cleanTitle,
        created_by: currentUserId,
        creator,
        created_at: new Date().toISOString()
      }, profilesById),
      error: null,
      local: true
    };
  }

  const result = await supabase.rpc('create_public_chat_thread', { p_title: cleanTitle });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) return { data: null, error: result.error };
  return { data: normalizePublicThread(row ?? {}, profilesById), error: null };
}

export async function deletePublicChatThread(conversationId, { currentUserId = null, isAdmin = false } = {}) {
  if (!isSupabaseConfigured) return { data: null, error: null, local: true };
  const cleanConversationId = String(conversationId ?? '').trim();
  if (!isUuid(cleanConversationId)) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator wątku.') };
  }

  const result = await supabase.rpc('delete_public_chat_thread', {
    p_conversation_id: cleanConversationId
  });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) return { data: null, error: result.error };
  return { data: data ?? { id: cleanConversationId }, error: null };
}

export async function updatePublicChatThreadTitle(conversationId, title) {
  const cleanConversationId = String(conversationId ?? '').trim();
  const cleanTitle = String(title ?? '').trim();
  if (!cleanConversationId) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator wątku.') };
  }
  if (!isUuid(cleanConversationId)) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator wątku.') };
  }
  if (!cleanTitle) {
    return { data: null, error: new Error('Podaj nazwę wątku.') };
  }
  if (cleanTitle.length > 120) {
    return { data: null, error: new Error('Nazwa wątku może mieć maksymalnie 120 znaków.') };
  }

  if (!isSupabaseConfigured) {
    return {
      data: { id: cleanConversationId, title: cleanTitle },
      error: null,
      local: true
    };
  }

  const result = await supabase.rpc('update_public_chat_thread_title', {
    p_conversation_id: cleanConversationId,
    p_title: cleanTitle
  });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) return { data: null, error: result.error };
  return { data: data ?? { id: cleanConversationId, title: cleanTitle }, error: null };
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

export async function fetchChatConversationMembers(conversationId) {
  if (!isSupabaseConfigured || !conversationId) return { data: [], error: null, local: true };
  const cleanConversationId = String(conversationId ?? '').trim();
  if (!isUuid(cleanConversationId)) return { data: [], error: new Error('Nieprawidłowy identyfikator rozmowy.') };

  const { data, error } = await supabase
    .from('chat_conversation_members')
    .select('user_id, deleted_at')
    .eq('conversation_id', cleanConversationId);

  return { data: data ?? [], error };
}

async function findActiveConversationWithPartner({ partnerUserId, currentUserId, excludeConversationId = null } = {}) {
  if (!isSupabaseConfigured || !partnerUserId || !currentUserId) return null;

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, created_at, chat_conversation_members(user_id, deleted_at)')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return null;

  for (const row of data) {
    if (excludeConversationId && row.id === excludeConversationId) continue;
    const members = row.chat_conversation_members ?? [];
    const selfActive = members.some((member) => member.user_id === currentUserId && !member.deleted_at);
    const partnerActive = members.some((member) => member.user_id === partnerUserId && !member.deleted_at);
    if (selfActive && partnerActive) return row.id;
  }

  return null;
}

function getConversationCreateKey(currentUserId, partnerUserId) {
  return `${currentUserId}:${partnerUserId}`;
}

export async function findActiveChatConversationWithPartner({ partnerUserId, currentUserId } = {}) {
  const cleanPartnerUserId = String(partnerUserId ?? '').trim();
  if (!cleanPartnerUserId) {
    return { data: null, error: new Error('Wybierz użytkownika.') };
  }
  if (!isUuid(cleanPartnerUserId)) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator użytkownika.') };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: null, local: true };
  }

  if (!currentUserId) {
    return { data: null, error: new Error('Brak zalogowanego użytkownika.') };
  }

  const existingConversationId = await findActiveConversationWithPartner({
    partnerUserId: cleanPartnerUserId,
    currentUserId
  });
  if (!existingConversationId) {
    return { data: null, error: null };
  }

  return {
    data: {
      id: existingConversationId,
      conversation_key: getChatConversationKey(existingConversationId)
    },
    error: null
  };
}

export async function ensureChatConversationWithPartner({ partnerUserId, currentUserId } = {}) {
  const cleanPartnerUserId = String(partnerUserId ?? '').trim();
  if (!cleanPartnerUserId || !currentUserId) {
    return { conversationId: null, created: false, error: new Error('Brak uczestników rozmowy.') };
  }
  if (!isUuid(cleanPartnerUserId)) {
    return { conversationId: null, created: false, error: new Error('Nieprawidłowy identyfikator użytkownika.') };
  }

  if (!isSupabaseConfigured) {
    return { conversationId: null, created: false, error: null, local: true };
  }

  const existingConversationId = await findActiveConversationWithPartner({
    partnerUserId: cleanPartnerUserId,
    currentUserId
  });
  if (existingConversationId) {
    return { conversationId: existingConversationId, created: false, error: null };
  }

  const pendingKey = getConversationCreateKey(currentUserId, cleanPartnerUserId);
  if (pendingConversationCreates.has(pendingKey)) {
    try {
      return await pendingConversationCreates.get(pendingKey);
    } catch (error) {
      return { conversationId: null, created: false, error };
    }
  }

  const createPromise = (async () => {
    const existingAfterWait = await findActiveConversationWithPartner({
      partnerUserId: cleanPartnerUserId,
      currentUserId
    });
    if (existingAfterWait) {
      return { conversationId: existingAfterWait, created: false, error: null };
    }

    const createResult = await createChatConversation({
      partnerUserId: cleanPartnerUserId,
      currentUserId
    });
    if (createResult.error || !createResult.data?.id) {
      throw createResult.error ?? new Error('Nie udało się utworzyć rozmowy.');
    }

    return { conversationId: createResult.data.id, created: true, error: null };
  })();

  pendingConversationCreates.set(pendingKey, createPromise);

  try {
    return await createPromise;
  } catch (error) {
    return { conversationId: null, created: false, error };
  } finally {
    pendingConversationCreates.delete(pendingKey);
  }
}

async function resolveConversationForMessage({ conversationId, currentUserId } = {}) {
  const cleanConversationId = String(conversationId ?? '').trim();
  if (!cleanConversationId || !isUuid(cleanConversationId) || !currentUserId) {
    return { conversationId: cleanConversationId || null, replaced: false, previousConversationId: null };
  }

  const membersResult = await fetchChatConversationMembers(cleanConversationId);
  if (membersResult.error) return { conversationId: cleanConversationId, replaced: false, previousConversationId: null, error: membersResult.error };

  const members = membersResult.data ?? [];
  const partnerMember = members.find((member) => member.user_id !== currentUserId) ?? null;
  if (!partnerMember?.user_id || !partnerMember.deleted_at) {
    return { conversationId: cleanConversationId, replaced: false, previousConversationId: null };
  }

  const existingConversationId = await findActiveConversationWithPartner({
    partnerUserId: partnerMember.user_id,
    currentUserId,
    excludeConversationId: cleanConversationId
  });
  if (existingConversationId) {
    return {
      conversationId: existingConversationId,
      replaced: true,
      previousConversationId: cleanConversationId
    };
  }

  const createResult = await createChatConversation({
    partnerUserId: partnerMember.user_id,
    currentUserId
  });
  if (createResult.error || !createResult.data?.id) {
    return {
      conversationId: cleanConversationId,
      replaced: false,
      previousConversationId: null,
      error: createResult.error ?? new Error('Nie udało się utworzyć nowej rozmowy.')
    };
  }

  return {
    conversationId: createResult.data.id,
    replaced: true,
    previousConversationId: cleanConversationId
  };
}

export async function updateChatConversationTitle(conversationId, title) {
  const cleanConversationId = String(conversationId ?? '').trim();
  if (!cleanConversationId) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator rozmowy.') };
  }
  if (!isUuid(cleanConversationId)) {
    return { data: null, error: new Error('Nieprawidłowy identyfikator rozmowy.') };
  }

  const cleanTitle = String(title ?? '').trim();
  if (cleanTitle.length > 120) {
    return { data: null, error: new Error('Temat rozmowy może mieć maksymalnie 120 znaków.') };
  }

  if (!isSupabaseConfigured) {
    return {
      data: { id: cleanConversationId, title: cleanTitle || null },
      error: null,
      local: true
    };
  }

  const result = await supabase.rpc('update_chat_conversation_title', {
    p_conversation_id: cleanConversationId,
    p_title: cleanTitle || null
  });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error) return { data: null, error: result.error };
  return { data: data ?? null, error: null };
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

export async function sendChatMessage({ recipientUserId = null, conversationId = null, message, currentUserId = null } = {}) {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: null,
      local: true,
      conversationId: null,
      conversationReplaced: false,
      previousConversationId: null,
      conversationCreated: false
    };
  }

  let targetConversationId = conversationId || null;
  let conversationReplaced = false;
  let previousConversationId = null;
  let conversationCreated = false;

  if (!targetConversationId && recipientUserId && currentUserId) {
    const ensured = await ensureChatConversationWithPartner({
      partnerUserId: recipientUserId,
      currentUserId
    });
    if (ensured.error) {
      return {
        data: null,
        error: ensured.error,
        conversationId: null,
        conversationReplaced: false,
        previousConversationId: null,
        conversationCreated: false
      };
    }
    targetConversationId = ensured.conversationId;
    conversationCreated = ensured.created === true;
  }

  if (targetConversationId && currentUserId) {
    const resolved = await resolveConversationForMessage({
      conversationId: targetConversationId,
      currentUserId
    });
    if (resolved.error) {
      return {
        data: null,
        error: resolved.error,
        conversationId: targetConversationId,
        conversationReplaced: false,
        previousConversationId: null,
        conversationCreated
      };
    }
    targetConversationId = resolved.conversationId;
    conversationReplaced = resolved.replaced === true;
    previousConversationId = resolved.previousConversationId ?? null;
  }

  const result = await createChatMessage({
    recipientUserId: targetConversationId ? null : recipientUserId,
    conversationId: targetConversationId,
    message
  });

  return {
    ...result,
    conversationId: result.data?.conversation_id ?? targetConversationId ?? null,
    conversationReplaced,
    previousConversationId,
    conversationCreated
  };
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
