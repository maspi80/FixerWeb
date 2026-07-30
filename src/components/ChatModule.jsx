import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppButton, AppTextarea, EmptyState } from '../design-system';
import {
  CHAT_ALL_CONVERSATION_ID,
  createChatMessage,
  deleteChatMessage,
  getChatConversationId,
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

export default function ChatModule({
  currentUser,
  permissions = { view: true, create: true },
  isAdmin = false,
  users = [],
  visibleMessages = [],
  readState = {},
  requestedConversationId = null,
  onConsumeConversationRequest,
  onActiveConversationChange,
  onMarkConversationRead,
  onMessageCreated,
  onMessageDeleted
}) {
  const currentUserId = currentUser?.id ?? null;
  const [selectedConversationId, setSelectedConversationId] = useState(CHAT_ALL_CONVERSATION_ID);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(null);
  const draftRef = useRef(null);
  const canCreate = permissions.create === true;

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

  const selectedRecipientId = selectedConversationId.startsWith('user:') ? selectedConversationId.slice(5) : null;
  const selectedUser = selectedRecipientId ? users.find((user) => user.id === selectedRecipientId) : null;
  const conversationTitle = selectedUser ? getChatUserDisplayName(selectedUser) : 'Wszyscy';

  const messages = useMemo(() => sortChatMessages(visibleMessages.filter((message) => (
    getChatMessageConversationId(message, currentUserId) === selectedConversationId
  ))), [currentUserId, selectedConversationId, visibleMessages]);

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
    setNotice('');
  };

  const sendMessage = async () => {
    if (!canCreate || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setNotice('');
    const result = await createChatMessage({ recipientUserId: selectedRecipientId, message: text });
    if (result.error) setNotice(result.error.message || 'Nie udało się wysłać wiadomości.');
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
    const isPublic = !message.recipient_user_id;
    const canDeleteMessage = message.sender_user_id === currentUserId || (isAdmin && isPublic);
    if (!canDeleteMessage) return;
    const result = await deleteChatMessage(message.id);
    if (result.error) setNotice(result.error.message || 'Nie udało się usunąć wiadomości.');
    if (!result.error) onMessageDeleted?.(message.id);
  };

  return <div className="chat-module">
    <aside className="chat-sidebar">
      <button type="button" className={`chat-conversation ${selectedConversationId === CHAT_ALL_CONVERSATION_ID ? 'active' : ''}`} onClick={() => selectConversation(CHAT_ALL_CONVERSATION_ID)}>
        <span>Wszyscy</span>
        {unreadCounts[CHAT_ALL_CONVERSATION_ID] > 0 && <span>({unreadCounts[CHAT_ALL_CONVERSATION_ID]})</span>}
      </button>
      {users.map((user) => {
        const conversationId = getChatConversationId(user.id);
        const unread = unreadCounts[conversationId] ?? 0;
        return <button key={user.id} type="button" className={`chat-conversation ${selectedConversationId === conversationId ? 'active' : ''}`} onClick={() => selectConversation(conversationId)}>
          <span className="chat-conversation-user">
            <span className="chat-user-avatar" style={{ '--chat-user-color': user.user_color || '#2563EB', '--chat-user-text-color': getReadableAvatarTextColor(user.user_color) }}>{getChatInitial(user)}</span>
            <span>{getChatUserDisplayName(user)}</span>
          </span>
          {unread > 0 && <span>({unread})</span>}
        </button>;
      })}
    </aside>
    <section className="chat-panel">
      <div className="chat-header">
        <h2>{conversationTitle}</h2>
      </div>
      {notice && <div className="notice chat-notice">{notice}</div>}
      <div className="chat-messages" ref={messagesRef} onScroll={() => {
        const box = messagesRef.current;
        if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) markConversationRead(selectedConversationId);
      }}>
        {messages.map((message) => {
          const isPublic = !message.recipient_user_id;
          const canDeleteMessage = message.sender_user_id === currentUserId || (isAdmin && isPublic);
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
