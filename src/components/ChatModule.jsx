import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppButton, AppInput, AppTextarea, EmptyState, buildUiResizeStorageKey, readPersistedUiSize, writePersistedUiSize } from '../design-system';
import {
  CHAT_ALL_CONVERSATION_ID,
  clearPublicChatHistory,
  createChatConversation,
  createChatMessage,
  deleteChatConversation,
  deleteChatMessage,
  getChatConversationKey,
  getChatConversationUuid,
  getChatMessageConversationId,
  getChatUserDisplayName,
  normalizeChatMessage,
  sortChatMessages
} from '../services/chatService';

function formatChatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatChatConversationMeta(conversation) {
  const date = formatChatTime(conversation?.created_at);
  const title = String(conversation?.title ?? '').trim();
  if (title && date) return `${title} · ${date}`;
  return title || date;
}

function getChatInitial(value) {
  return getChatUserDisplayName(value).trim().slice(0, 1).toUpperCase() || 'U';
}

function getReadableAvatarTextColor(backgroundColor) {
  const raw = String(backgroundColor ?? '').trim();
  const hex = /^#([0-9a-f]{6})$/i.test(raw) ? raw.slice(1) : '2563EB';
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const convert = (channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
  return luminance > 0.48 ? '#0F172A' : '#FFFFFF';
}

const CHAT_SIDEBAR_MIN_WIDTH = 248;
const CHAT_SIDEBAR_DEFAULT_WIDTH = 280;
const CHAT_SIDEBAR_MAX_RATIO = 0.4;
const CHAT_SIDEBAR_WIDTH_KEY = buildUiResizeStorageKey('chat', 'sidebar');

function getChatSidebarStorageKey(userId) {
  const scopedUserId = String(userId ?? '').trim();
  return scopedUserId ? `${CHAT_SIDEBAR_WIDTH_KEY}:${scopedUserId}` : CHAT_SIDEBAR_WIDTH_KEY;
}

function clampChatSidebarWidth(value, containerWidth = 0) {
  const numeric = Number(value);
  const ratioMax = Number(containerWidth) > 0 ? Math.floor(containerWidth * CHAT_SIDEBAR_MAX_RATIO) : 480;
  const max = Math.max(CHAT_SIDEBAR_MIN_WIDTH, ratioMax);
  if (!Number.isFinite(numeric)) return Math.min(CHAT_SIDEBAR_DEFAULT_WIDTH, max);
  return Math.min(max, Math.max(CHAT_SIDEBAR_MIN_WIDTH, Math.round(numeric)));
}

function getSavedChatSidebarWidth(storageKey) {
  if (typeof window === 'undefined') return CHAT_SIDEBAR_DEFAULT_WIDTH;
  const saved = readPersistedUiSize(storageKey, {
    minWidth: CHAT_SIDEBAR_MIN_WIDTH,
    maxWidth: 2000,
    defaultWidth: CHAT_SIDEBAR_DEFAULT_WIDTH
  });
  return saved?.width ?? CHAT_SIDEBAR_DEFAULT_WIDTH;
}

export default function ChatModule({
  currentUser,
  permissions = { view: true, create: true },
  isAdmin = false,
  users = [],
  conversations = [],
  visibleMessages = [],
  readState = {},
  requestedConversationId = null,
  onConsumeConversationRequest,
  onActiveConversationChange,
  onMarkConversationRead,
  onMessageCreated,
  onMessageDeleted,
  onConversationCreated,
  onConversationDeleted,
  onPublicHistoryCleared
}) {
  const currentUserId = currentUser?.profile?.id ?? currentUser?.id ?? null;
  const [selectedConversationId, setSelectedConversationId] = useState(CHAT_ALL_CONVERSATION_ID);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatForm, setNewChatForm] = useState({ userId: '', title: '' });
  const [selectedContactId, setSelectedContactId] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [deleteConversationConfirm, setDeleteConversationConfirm] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [clearPublicConfirm, setClearPublicConfirm] = useState(false);
  const [clearingPublicHistory, setClearingPublicHistory] = useState(false);
  const chatModuleRef = useRef(null);
  const messagesRef = useRef(null);
  const draftRef = useRef(null);
  const resizeStateRef = useRef(null);
  const canCreate = permissions.create === true;
  const chatSidebarStorageKey = useMemo(() => getChatSidebarStorageKey(currentUserId), [currentUserId]);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampChatSidebarWidth(getSavedChatSidebarWidth(getChatSidebarStorageKey(currentUserId))));

  const currentProfile = currentUser?.profile ? {
    id: currentUser.profile.id,
    email: currentUser.profile.email,
    username: currentUser.profile.username,
    full_name: currentUser.profile.full_name,
    user_color: currentUser.profile.user_color,
    is_active: currentUser.profile.is_active
  } : currentUserId ? {
    id: currentUserId,
    email: currentUser.email,
    full_name: currentUser.name,
    user_color: '#2563EB',
    is_active: true
  } : null;

  const profilesById = useMemo(() => {
    const map = new Map();
    if (currentProfile?.id) map.set(currentProfile.id, currentProfile);
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [currentProfile?.id, currentProfile?.email, currentProfile?.full_name, currentProfile?.username, currentProfile?.user_color, users]);

  const selectedConversationUuid = getChatConversationUuid(selectedConversationId);
  const selectedConversation = selectedConversationUuid ? conversations.find((conversation) => conversation.id === selectedConversationUuid) : null;
  const selectedRecipientId = selectedConversationId.startsWith('user:') ? selectedConversationId.slice(5) : null;
  const selectedUser = selectedRecipientId ? users.find((user) => user.id === selectedRecipientId) : null;
  const conversationTitle = selectedConversation?.partner_name || (selectedUser ? getChatUserDisplayName(selectedUser) : 'Wszyscy');
  const conversationSubtitle = selectedConversation?.title ?? '';
  const contacts = useMemo(() => users.filter((user) => user.id !== currentUserId), [currentUserId, users]);

  const messages = useMemo(() => sortChatMessages(visibleMessages.filter((message) => (
    getChatMessageConversationId(message, currentUserId) === selectedConversationId
  ))), [currentUserId, selectedConversationId, visibleMessages]);

  const measureChatWidth = useCallback(() => chatModuleRef.current?.getBoundingClientRect().width ?? 0, []);

  useEffect(() => {
    setSidebarWidth(clampChatSidebarWidth(getSavedChatSidebarWidth(chatSidebarStorageKey), measureChatWidth()));
  }, [chatSidebarStorageKey, measureChatWidth]);

  useEffect(() => {
    writePersistedUiSize(chatSidebarStorageKey, { width: sidebarWidth });
  }, [chatSidebarStorageKey, sidebarWidth]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const state = resizeStateRef.current;
      if (!state) return;
      event.preventDefault();
      setSidebarWidth(clampChatSidebarWidth(state.startWidth + event.clientX - state.startX, state.containerWidth));
    };
    const handlePointerUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.classList.remove('chat-sidebar-resizing');
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('chat-sidebar-resizing');
    };
  }, []);

  useEffect(() => {
    const syncWidthToBounds = () => {
      setSidebarWidth((current) => clampChatSidebarWidth(current, measureChatWidth()));
    };
    syncWidthToBounds();
    window.addEventListener('resize', syncWidthToBounds);
    return () => window.removeEventListener('resize', syncWidthToBounds);
  }, [measureChatWidth]);

  const startSidebarResize = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
      containerWidth: measureChatWidth()
    };
    document.body.classList.add('chat-sidebar-resizing');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [measureChatWidth, sidebarWidth]);

  const markConversationRead = (conversationId, nextMessages = messages) => {
    const lastMessage = [...nextMessages].reverse().find((message) => (
      getChatMessageConversationId(message, currentUserId) === conversationId
    ));
    if (!lastMessage) return;
    onMarkConversationRead?.(conversationId, lastMessage.created_at);
  };

  useEffect(() => {
    if (!requestedConversationId) return;
    setSelectedConversationId(requestedConversationId);
    onConsumeConversationRequest?.();
  }, [requestedConversationId, onConsumeConversationRequest]);

  useEffect(() => {
    onActiveConversationChange?.(selectedConversationId);
  }, [selectedConversationId, onActiveConversationChange]);

  useEffect(() => {
    const box = messagesRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    markConversationRead(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const box = messagesRef.current;
    if (!box) return;
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distanceFromBottom < 120) {
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
        markConversationRead(selectedConversationId);
      });
    }
  }, [messages, selectedConversationId, markConversationRead]);

  const unreadCounts = useMemo(() => {
    const counts = {};
    visibleMessages.forEach((message) => {
      if (message.sender_user_id === currentUserId) return;
      const conversationId = getChatMessageConversationId(message, currentUserId);
      const lastRead = readState[conversationId];
      if (!lastRead || new Date(message.created_at).getTime() > new Date(lastRead).getTime()) {
        counts[conversationId] = (counts[conversationId] ?? 0) + 1;
      }
    });
    return counts;
  }, [currentUserId, readState, visibleMessages]);

  const selectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
    setDeleteConversationConfirm(false);
    setClearPublicConfirm(false);
    setNotice('');
  };

  const openNewChatDialog = (user) => {
    if (!user?.id) return;
    setSelectedContactId(user.id);
    setNewChatForm({ userId: user.id, title: '' });
    setNewChatOpen(true);
    setNotice('');
  };

  const submitNewChat = async (event) => {
    event.preventDefault();
    if (creatingConversation) return;
    setCreatingConversation(true);
    setNotice('');
    const result = await createChatConversation({
      partnerUserId: newChatForm.userId,
      title: newChatForm.title,
      currentUserId
    });
    if (result.error) {
      console.error('Chat conversation create failed', result.error);
      setNotice('Nie udało się utworzyć rozmowy.');
      setCreatingConversation(false);
      return;
    }
    setNewChatOpen(false);
    setNewChatForm({ userId: '', title: '' });
    setSelectedContactId('');
    onConversationCreated?.();
    if (result.data?.id) setSelectedConversationId(getChatConversationKey(result.data.id));
    setCreatingConversation(false);
  };

  const sendMessage = async () => {
    if (!canCreate || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setNotice('');
    const result = await createChatMessage({ recipientUserId: selectedRecipientId, conversationId: selectedConversationUuid, message: text });
    if (result.error) setNotice('Nie udało się wysłać wiadomości.');
    if (!result.error) {
      setDraft('');
      requestAnimationFrame(() => draftRef.current?.focus());
      if (result.data) {
        const nextMessage = normalizeChatMessage(result.data, profilesById);
        onMessageCreated?.(nextMessage);
      }
    }
    setSending(false);
  };

  const handleDraftKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  };

  const removeMessage = async (message) => {
    const canDeleteMessage = message.sender_user_id === currentUserId && !message.deleted_at;
    if (!canDeleteMessage) return;
    const result = await deleteChatMessage(message.id);
    if (result.error) setNotice('Nie udało się usunąć wiadomości.');
    if (!result.error && result.data) onMessageCreated?.(normalizeChatMessage(result.data, profilesById));
  };

  const removeConversation = async () => {
    if (!selectedConversationUuid || deletingConversation) return;
    setDeletingConversation(true);
    const result = await deleteChatConversation(selectedConversationUuid, { currentUserId });
    if (result.error) {
      setNotice('Nie udało się usunąć rozmowy.');
      setDeletingConversation(false);
      return;
    }
    onConversationDeleted?.(selectedConversationUuid);
    setSelectedConversationId(CHAT_ALL_CONVERSATION_ID);
    setDeleteConversationConfirm(false);
    setDeletingConversation(false);
  };

  const clearPublicHistory = async () => {
    if (!isAdmin || clearingPublicHistory) return;
    setClearingPublicHistory(true);
    const result = await clearPublicChatHistory();
    if (result.error) {
      setNotice('Nie udało się wyczyścić historii.');
      setClearingPublicHistory(false);
      return;
    }
    onPublicHistoryCleared?.();
    setClearPublicConfirm(false);
    setClearingPublicHistory(false);
  };

  return <div className="chat-module" ref={chatModuleRef} style={{ '--chat-sidebar-width': `${sidebarWidth}px` }}>
    <aside className="chat-sidebar">
      <div className="chat-sidebar-section chat-contacts-section">
        <h3>Kontakty</h3>
        <div className="chat-contacts-list">
          {contacts.map((user) => <button key={user.id} type="button" className={`chat-conversation chat-contact ${selectedContactId === user.id ? 'active' : ''}`} onClick={() => setSelectedContactId(user.id)} onDoubleClick={() => openNewChatDialog(user)}>
            <span className="chat-conversation-user">
              <span className="chat-user-avatar" style={{ '--chat-user-color': user.user_color || '#2563EB', '--chat-user-text-color': getReadableAvatarTextColor(user.user_color) }}>{getChatInitial(user)}</span>
              <span>{getChatUserDisplayName(user)}</span>
            </span>
          </button>)}
        </div>
      </div>
      {newChatOpen && <div className="chat-new-card">
        <form className="chat-new-form" onSubmit={submitNewChat}>
          <label>Temat rozmowy
            <AppInput value={newChatForm.title} onChange={(event) => setNewChatForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} />
          </label>
          <div className="chat-new-actions">
            <AppButton variant="secondary" size="sm" onClick={() => { setNewChatOpen(false); setNewChatForm({ userId: '', title: '' }); setSelectedContactId(''); }}>Anuluj</AppButton>
            <AppButton type="submit" variant="primary" size="sm" disabled={creatingConversation || !newChatForm.userId}>Utwórz</AppButton>
          </div>
        </form>
      </div>
      }
      <div className="chat-sidebar-section chat-conversations-section">
        <h3>Aktywne rozmowy</h3>
      <button type="button" className={`chat-conversation ${selectedConversationId === CHAT_ALL_CONVERSATION_ID ? 'active' : ''}`} onClick={() => selectConversation(CHAT_ALL_CONVERSATION_ID)}>
        <span className="chat-conversation-user">
          <span className="chat-user-avatar chat-user-avatar-all">W</span>
          <span>Wszyscy</span>
        </span>
        {unreadCounts[CHAT_ALL_CONVERSATION_ID] > 0 && <span>({unreadCounts[CHAT_ALL_CONVERSATION_ID]})</span>}
      </button>
      {conversations.map((conversation) => {
        const unread = unreadCounts[conversation.conversation_key] ?? 0;
        const meta = formatChatConversationMeta(conversation);
        return <button key={conversation.id} type="button" className={`chat-conversation ${selectedConversationId === conversation.conversation_key ? 'active' : ''}`} onClick={() => selectConversation(conversation.conversation_key)}>
          <span className="chat-conversation-user">
            <span className="chat-user-avatar" style={{ '--chat-user-color': conversation.partner_color || '#2563EB', '--chat-user-text-color': getReadableAvatarTextColor(conversation.partner_color) }}>{getChatInitial({ full_name: conversation.partner_name })}</span>
            <span className="chat-conversation-lines"><strong>{conversation.partner_name}</strong>{meta && <small>{meta}</small>}</span>
          </span>
          {unread > 0 && <span>({unread})</span>}
        </button>;
      })}
      </div>
    </aside>
    <div className="chat-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Zmień szerokość panelu czatu" onPointerDown={startSidebarResize} />
    <section className="chat-panel">
      <div className="chat-header">
        <div>
          <h2>{conversationTitle}</h2>
          {conversationSubtitle && <p>{conversationSubtitle}</p>}
        </div>
        {selectedConversationUuid && <button type="button" className="chat-delete-conversation-button" onClick={() => setDeleteConversationConfirm(true)}>Usuń rozmowę</button>}
        {!selectedConversationUuid && isAdmin && <button type="button" className="chat-delete-conversation-button" onClick={() => setClearPublicConfirm(true)}>Wyczyść historię</button>}
      </div>
      {deleteConversationConfirm && <div className="chat-confirm-delete">
        <div><strong>Czy na pewno chcesz usunąć rozmowę?</strong><span>Rozmowa zostanie ukryta tylko dla Ciebie.</span></div>
        <button type="button" onClick={() => setDeleteConversationConfirm(false)} disabled={deletingConversation}>Anuluj</button>
        <button type="button" onClick={removeConversation} disabled={deletingConversation}>Usuń</button>
      </div>}
      {clearPublicConfirm && <div className="chat-confirm-delete">
        <div><strong>Czy na pewno chcesz wyczyścić historię?</strong><span>Wiadomości z kanału Wszyscy zostaną usunięte.</span></div>
        <button type="button" onClick={() => setClearPublicConfirm(false)} disabled={clearingPublicHistory}>Anuluj</button>
        <button type="button" onClick={clearPublicHistory} disabled={clearingPublicHistory}>Wyczyść</button>
      </div>}
      {notice && <div className="notice chat-notice">{notice}</div>}
      <div className="chat-messages" ref={messagesRef} onScroll={() => {
        const box = messagesRef.current;
        if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) markConversationRead(selectedConversationId);
      }}>
        {messages.map((message) => {
          const canDeleteMessage = message.sender_user_id === currentUserId && !message.deleted_at;
          return <article key={message.id} className="chat-message" style={{ '--chat-author-color': message.author_color }}>
            <div className="chat-message-meta">
              <strong>{message.author_name}</strong>
              <span>{formatChatTime(message.created_at)}</span>
            </div>
            <p>{message.message}</p>
            {canDeleteMessage && <button type="button" className="chat-delete-button" onClick={() => removeMessage(message)}>Usuń</button>}
          </article>;
        })}
        {!messages.length && <EmptyState title="Brak wiadomości." />}
      </div>
      <div className="chat-composer">
        <AppTextarea
          ref={draftRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder={canCreate ? 'Napisz wiadomość...' : 'Masz dostęp tylko do odczytu.'}
          disabled={!canCreate || sending}
          rows={2}
        />
        <AppButton variant="primary" onClick={sendMessage} disabled={!canCreate || sending || !draft.trim()}>Wyślij</AppButton>
      </div>
    </section>
  </div>;
}
