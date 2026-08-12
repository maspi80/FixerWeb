import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, AppTextarea, EmptyState, buildUiResizeStorageKey, readPersistedUiSize, writePersistedUiSize } from '../design-system';
import {
  CHAT_ALL_CONVERSATION_ID,
  CHAT_GENERAL_LABEL,
  clearPublicChatHistory,
  sendChatMessage,
  deleteChatConversation,
  deleteChatMessage,
  createPublicChatThread,
  deletePublicChatThread,
  findActiveChatConversationWithPartner,
  getChatConversationKey,
  getChatConversationUuid,
  getChatConversationId,
  getActiveConversationUuid,
  getConversationThreadIds,
  getChatMessageConversationId,
  getChatUserDisplayName,
  normalizeChatMessage,
  sortChatMessages,
  updateChatConversationTitle,
  updatePublicChatThreadTitle,
  buildChatLastContextFromSelection,
  clearChatLastContext,
  isChatLastContextStale,
  readChatLastContext,
  resolveChatLastContext,
  writeChatLastContext,
  buildChatProfilesById,
  resolveChatMessageAuthor,
  resolveChatMessageAuthorColor
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

function getChatLocalDayStart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getChatLocalDayKey(value) {
  const dayStart = getChatLocalDayStart(value);
  if (!dayStart) return '';
  const year = dayStart.getFullYear();
  const month = String(dayStart.getMonth() + 1).padStart(2, '0');
  const day = String(dayStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shouldShowChatDateSeparator(currentMessage, previousMessage) {
  if (!currentMessage?.created_at) return false;
  if (!previousMessage?.created_at) return true;
  return getChatLocalDayKey(currentMessage.created_at) !== getChatLocalDayKey(previousMessage.created_at);
}

function formatChatDateSeparator(value, referenceDate = new Date()) {
  const dayStart = getChatLocalDayStart(value);
  if (!dayStart) return '';

  const todayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (dayStart.getTime() === todayStart.getTime()) return 'Dzisiaj';
  if (dayStart.getTime() === yesterdayStart.getTime()) return 'Wczoraj';

  const sameYear = dayStart.getFullYear() === referenceDate.getFullYear();
  return dayStart.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' })
  });
}

function formatChatConversationMeta(conversation) {
  const title = String(conversation?.title ?? '').trim();
  if (title) return title;
  return formatChatTime(conversation?.created_at);
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

const CHAT_GENERAL_SECTION_EXPANDED_KEY = 'fixer-chat-general-section-expanded';
const CHAT_PRIVATE_SECTION_EXPANDED_KEY = 'fixer-chat-private-section-expanded';

function getChatGeneralSectionExpandedStorageKey(userId) {
  const scopedUserId = String(userId ?? '').trim();
  return scopedUserId ? `${CHAT_GENERAL_SECTION_EXPANDED_KEY}:${scopedUserId}` : CHAT_GENERAL_SECTION_EXPANDED_KEY;
}

function getChatPrivateSectionExpandedStorageKey(userId) {
  const scopedUserId = String(userId ?? '').trim();
  return scopedUserId ? `${CHAT_PRIVATE_SECTION_EXPANDED_KEY}:${scopedUserId}` : CHAT_PRIVATE_SECTION_EXPANDED_KEY;
}

function readChatSidebarSectionExpanded(storageKey) {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

function writeChatSidebarSectionExpanded(storageKey, expanded) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, expanded ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
}

function clampChatContextMenuPosition(x, y, menuWidth = 168, menuHeight = 88) {
  const margin = 12;
  const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);
  return {
    left: Math.min(Math.max(margin, x), maxX),
    top: Math.min(Math.max(margin, y), maxY)
  };
}

function canManagePublicThread(thread, currentUserId, isAdmin) {
  return Boolean(thread?.id && (thread.created_by === currentUserId || isAdmin));
}

function ChatContextMenu({ x, y, items = [], onClose }) {
  const menuRef = useRef(null);
  const visibleItems = items.filter((item) => item.visible !== false);

  useEffect(() => {
    if (!visibleItems.length) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, visibleItems.length]);

  if (!visibleItems.length) return null;

  const position = clampChatContextMenuPosition(x, y, 168, 16 + visibleItems.length * 34);

  return createPortal(
    <div
      ref={menuRef}
      className="row-context-menu chat-context-menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      {visibleItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.className ?? ''}
          onClick={() => {
            onClose?.();
            item.onClick?.();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function ChatModule({
  isActive = true,
  currentUser,
  permissions = { view: true, create: true },
  isAdmin = false,
  users = [],
  conversations = [],
  publicThreads = [],
  visibleMessages = [],
  readState = {},
  requestedConversationId = null,
  onConsumeConversationRequest,
  onActiveConversationChange,
  onMarkConversationRead,
  onMessageCreated,
  onMessageDeleted,
  onConversationCreated,
  onConversationReplaced,
  onConversationUpdated,
  onPublicThreadCreated,
  onPublicThreadDeleted,
  onPublicThreadUpdated,
  onConversationDeleted,
  onPublicHistoryCleared
}) {
  const currentUserId = currentUser?.profile?.id ?? currentUser?.id ?? null;
  const [selectedConversationId, setSelectedConversationId] = useState(CHAT_ALL_CONVERSATION_ID);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const sendRequestRef = useRef(0);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [openingConversation, setOpeningConversation] = useState(false);
  const [deleteConversationConfirm, setDeleteConversationConfirm] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [clearPublicConfirm, setClearPublicConfirm] = useState(false);
  const [clearingPublicHistory, setClearingPublicHistory] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [generalSectionExpanded, setGeneralSectionExpanded] = useState(() => readChatSidebarSectionExpanded(getChatGeneralSectionExpandedStorageKey(currentUser?.profile?.id ?? currentUser?.id ?? null)));
  const [privateSectionExpanded, setPrivateSectionExpanded] = useState(() => readChatSidebarSectionExpanded(getChatPrivateSectionExpandedStorageKey(currentUser?.profile?.id ?? currentUser?.id ?? null)));
  const [creatingPublicThread, setCreatingPublicThread] = useState(false);
  const [publicThreadDraft, setPublicThreadDraft] = useState('');
  const [creatingPublicThreadBusy, setCreatingPublicThreadBusy] = useState(false);
  const [deleteThreadConfirm, setDeleteThreadConfirm] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingThreadId, setRenamingThreadId] = useState(null);
  const [renameThreadDraft, setRenameThreadDraft] = useState('');
  const [savingThreadRename, setSavingThreadRename] = useState(false);
  const chatModuleRef = useRef(null);
  const messagesRef = useRef(null);
  const draftRef = useRef(null);
  const titleInputRef = useRef(null);
  const titleSaveLockRef = useRef(false);
  const resizeStateRef = useRef(null);
  const conversationRemapRef = useRef(new Map());
  const publicThreadCreateOriginRef = useRef(null);
  const pendingPrivateTitleEditRef = useRef(null);
  const threadRenameSaveLockRef = useRef(false);
  const threadRenameInputRef = useRef(null);
  const lastContextRestoreAttemptsRef = useRef(0);
  const [contextRestoreDone, setContextRestoreDone] = useState(false);
  const canCreate = permissions.create === true;
  const chatSidebarStorageKey = useMemo(() => getChatSidebarStorageKey(currentUserId), [currentUserId]);
  const chatGeneralSectionExpandedStorageKey = useMemo(() => getChatGeneralSectionExpandedStorageKey(currentUserId), [currentUserId]);
  const chatPrivateSectionExpandedStorageKey = useMemo(() => getChatPrivateSectionExpandedStorageKey(currentUserId), [currentUserId]);
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

  const profilesById = useMemo(() => buildChatProfilesById({
    currentProfile,
    users,
    conversations,
    publicThreads
  }), [conversations, currentProfile, publicThreads, users]);

  const selectedConversationUuid = getChatConversationUuid(selectedConversationId);
  const selectedConversation = selectedConversationUuid ? conversations.find((conversation) => (
    conversation.id === selectedConversationUuid
    || (conversation.thread_conversation_ids ?? []).includes(selectedConversationUuid)
  )) : null;
  const threadConversationIds = useMemo(
    () => getConversationThreadIds(conversations, selectedConversationUuid),
    [conversations, selectedConversationUuid]
  );
  const activeConversationUuid = selectedConversation?.active_conversation_id
    ?? getActiveConversationUuid(conversations, selectedConversationUuid);
  const selectedPublicThread = useMemo(
    () => publicThreads.find((thread) => thread.conversation_key === selectedConversationId) ?? null,
    [publicThreads, selectedConversationId]
  );
  const selectedRecipientId = selectedConversationId.startsWith('user:') ? selectedConversationId.slice(5) : null;
  const selectedUser = selectedRecipientId ? users.find((user) => user.id === selectedRecipientId) : null;
  const conversationTitle = selectedPublicThread?.title
    || selectedConversation?.partner_name
    || (selectedUser ? getChatUserDisplayName(selectedUser) : CHAT_GENERAL_LABEL);
  const conversationSubtitle = String(selectedConversation?.title ?? '').trim();
  const publicThreadAuthorLine = selectedPublicThread?.creator_name
    ? `Utworzył: ${selectedPublicThread.creator_name}`
    : '';
  const canEditConversationTitle = Boolean(selectedConversationUuid && activeConversationUuid && !selectedPublicThread);
  const contacts = useMemo(() => users.filter((user) => user.id !== currentUserId), [currentUserId, users]);

  const messages = useMemo(() => sortChatMessages(visibleMessages.filter((message) => {
    if (selectedPublicThread) {
      return message.conversation_id === selectedPublicThread.id;
    }
    if (threadConversationIds.length) {
      return threadConversationIds.includes(message.conversation_id);
    }
    return getChatMessageConversationId(message, currentUserId) === selectedConversationId;
  })), [currentUserId, selectedConversationId, selectedPublicThread, threadConversationIds, visibleMessages]);

  const conversationMessagesRef = useRef(messages);
  conversationMessagesRef.current = messages;

  const measureChatWidth = useCallback(() => chatModuleRef.current?.getBoundingClientRect().width ?? 0, []);

  const markConversationRead = useCallback((conversationId, nextMessages = null) => {
    const sourceMessages = nextMessages ?? conversationMessagesRef.current;
    const lastMessage = [...sourceMessages].reverse().find((message) => {
      if (threadConversationIds.length) return threadConversationIds.includes(message.conversation_id);
      return getChatMessageConversationId(message, currentUserId) === conversationId;
    });
    if (!lastMessage) return;
    onMarkConversationRead?.(getChatMessageConversationId(lastMessage, currentUserId), lastMessage.created_at);
  }, [currentUserId, onMarkConversationRead, threadConversationIds]);

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

  useEffect(() => {
    lastContextRestoreAttemptsRef.current = 0;
    setContextRestoreDone(false);
  }, [currentUserId]);

  useEffect(() => {
    if (!requestedConversationId) return;
    publicThreadCreateOriginRef.current = null;
    setCreatingPublicThread(false);
    setPublicThreadDraft('');
    setSelectedConversationId(requestedConversationId);
    onConsumeConversationRequest?.();
    setContextRestoreDone(true);
  }, [requestedConversationId, onConsumeConversationRequest]);

  useEffect(() => {
    if (contextRestoreDone || requestedConversationId) return;
    if (!currentUserId) return;

    const saved = readChatLastContext(currentUserId);
    if (!saved) {
      setContextRestoreDone(true);
      return;
    }

    const resolved = resolveChatLastContext(saved, { conversations, publicThreads });
    if (resolved) {
      setSelectedConversationId(resolved);
      setContextRestoreDone(true);
      return;
    }

    lastContextRestoreAttemptsRef.current += 1;
    if (
      isChatLastContextStale(saved, { conversations, publicThreads })
      || lastContextRestoreAttemptsRef.current >= 3
    ) {
      clearChatLastContext(currentUserId);
      setContextRestoreDone(true);
    }
  }, [contextRestoreDone, conversations, currentUserId, publicThreads, requestedConversationId]);

  useEffect(() => {
    if (!currentUserId || !contextRestoreDone) return;
    const context = buildChatLastContextFromSelection(selectedConversationId, { conversations, publicThreads });
    if (context) writeChatLastContext(currentUserId, context);
  }, [contextRestoreDone, conversations, currentUserId, publicThreads, selectedConversationId]);

  useEffect(() => {
    onActiveConversationChange?.(selectedConversationId);
  }, [selectedConversationId, onActiveConversationChange]);

  useEffect(() => {
    if (!isActive) {
      sendRequestRef.current += 1;
      setSending(false);
      setOpeningConversation(false);
      return;
    }
    const box = messagesRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    markConversationRead(selectedConversationId);
  }, [isActive, selectedConversationId, markConversationRead]);

  useEffect(() => {
    if (!isActive) return;
    const box = messagesRef.current;
    if (!box) return;
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distanceFromBottom < 120) {
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
        markConversationRead(selectedConversationId);
      });
    }
  }, [isActive, messages, selectedConversationId, markConversationRead]);

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

    const aggregated = { ...counts };
    conversations.forEach((conversation) => {
      const threadKeys = (conversation.thread_conversation_ids ?? [conversation.id])
        .map((conversationId) => getChatConversationKey(conversationId));
      const total = threadKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
      if (total > 0) aggregated[conversation.conversation_key] = total;
    });
    return aggregated;
  }, [conversations, currentUserId, readState, visibleMessages]);

  useEffect(() => {
    writeChatSidebarSectionExpanded(chatGeneralSectionExpandedStorageKey, generalSectionExpanded);
  }, [chatGeneralSectionExpandedStorageKey, generalSectionExpanded]);

  useEffect(() => {
    writeChatSidebarSectionExpanded(chatPrivateSectionExpandedStorageKey, privateSectionExpanded);
  }, [chatPrivateSectionExpandedStorageKey, privateSectionExpanded]);

  useEffect(() => {
    setGeneralSectionExpanded(readChatSidebarSectionExpanded(chatGeneralSectionExpandedStorageKey));
    setPrivateSectionExpanded(readChatSidebarSectionExpanded(chatPrivateSectionExpandedStorageKey));
  }, [chatGeneralSectionExpandedStorageKey, chatPrivateSectionExpandedStorageKey]);

  const toggleGeneralSectionExpanded = () => {
    setGeneralSectionExpanded((current) => {
      const next = !current;
      if (!next && creatingPublicThread && !creatingPublicThreadBusy) {
        publicThreadCreateOriginRef.current = null;
        setCreatingPublicThread(false);
        setPublicThreadDraft('');
      }
      return next;
    });
  };

  const togglePrivateSectionExpanded = () => {
    setPrivateSectionExpanded((current) => !current);
  };

  const startCreatePublicThread = () => {
    if (!canCreate || creatingPublicThreadBusy) return;
    setGeneralSectionExpanded(true);
    publicThreadCreateOriginRef.current = selectedConversationId;
    setCreatingPublicThread(true);
    setPublicThreadDraft('');
    setNotice('');
  };

  const cancelCreatePublicThread = useCallback(() => {
    if (creatingPublicThreadBusy) return;
    publicThreadCreateOriginRef.current = null;
    setCreatingPublicThread(false);
    setPublicThreadDraft('');
  }, [creatingPublicThreadBusy]);

  const submitPublicThread = async (event) => {
    event?.preventDefault?.();
    if (!canCreate || creatingPublicThreadBusy) return;
    const nextTitle = publicThreadDraft.trim();
    if (!nextTitle) return;
    setCreatingPublicThreadBusy(true);
    setNotice('');
    const result = await createPublicChatThread(nextTitle, { profilesById, currentUserId });
    if (result.error) {
      setNotice('Nie udało się utworzyć wątku.');
      setCreatingPublicThreadBusy(false);
      return;
    }
    onPublicThreadCreated?.(result.data);
    if (result.data?.conversation_key) selectConversation(result.data.conversation_key);
    setCreatingPublicThread(false);
    setPublicThreadDraft('');
    setCreatingPublicThreadBusy(false);
  };

  const handlePublicThreadDraftKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPublicThread(event);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!creatingPublicThreadBusy) cancelCreatePublicThread();
    }
  };

  useEffect(() => {
    if (!creatingPublicThread) {
      publicThreadCreateOriginRef.current = null;
      return;
    }
    const originConversationId = publicThreadCreateOriginRef.current;
    if (originConversationId != null && originConversationId !== selectedConversationId) {
      publicThreadCreateOriginRef.current = null;
      setCreatingPublicThread(false);
      setPublicThreadDraft('');
    }
  }, [selectedConversationId, creatingPublicThread]);

  useEffect(() => {
    const pending = pendingPrivateTitleEditRef.current;
    if (pending?.conversationKey === selectedConversationId) {
      pendingPrivateTitleEditRef.current = null;
      setTitleDraft(pending.title);
      setTitleEditing(true);
      setSavingTitle(false);
      return;
    }
    if (!pending) {
      setTitleEditing(false);
      setTitleDraft('');
      setSavingTitle(false);
    }
  }, [selectedConversationId, activeConversationUuid]);

  useEffect(() => {
    if (!renamingThreadId) return;
    threadRenameInputRef.current?.focus();
    threadRenameInputRef.current?.select();
  }, [renamingThreadId]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const handleScroll = () => setContextMenu(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu]);

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  const closeContextMenu = () => setContextMenu(null);

  const openPublicThreadContextMenu = (event, thread) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canManagePublicThread(thread, currentUserId, isAdmin)) return;
    setContextMenu({
      type: 'thread',
      x: event.clientX,
      y: event.clientY,
      thread
    });
  };

  const openPrivateConversationContextMenu = (event, conversation) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      type: 'private',
      x: event.clientX,
      y: event.clientY,
      conversation
    });
  };

  const startThreadRename = (thread) => {
    if (!thread?.id || !canManagePublicThread(thread, currentUserId, isAdmin)) return;
    setRenamingThreadId(thread.id);
    setRenameThreadDraft(String(thread.title ?? '').trim());
    setNotice('');
  };

  const cancelThreadRename = () => {
    if (savingThreadRename) return;
    setRenamingThreadId(null);
    setRenameThreadDraft('');
  };

  const saveThreadRename = async (threadId) => {
    if (!threadId || threadRenameSaveLockRef.current || savingThreadRename) return;
    const thread = publicThreads.find((entry) => entry.id === threadId);
    const nextTitle = renameThreadDraft.trim();
    const currentTitle = String(thread?.title ?? '').trim();
    if (!nextTitle) {
      cancelThreadRename();
      return;
    }
    if (nextTitle === currentTitle) {
      cancelThreadRename();
      return;
    }
    threadRenameSaveLockRef.current = true;
    setSavingThreadRename(true);
    setNotice('');
    const result = await updatePublicChatThreadTitle(threadId, nextTitle);
    if (result.error) {
      setNotice('Nie udało się zmienić nazwy.');
      threadRenameSaveLockRef.current = false;
      setSavingThreadRename(false);
      return;
    }
    const savedTitle = String(result.data?.title ?? nextTitle).trim();
    onPublicThreadUpdated?.(threadId, { title: savedTitle });
    setRenamingThreadId(null);
    setRenameThreadDraft('');
    threadRenameSaveLockRef.current = false;
    setSavingThreadRename(false);
  };

  const handleThreadRenameKeyDown = (event, threadId) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveThreadRename(threadId);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelThreadRename();
    }
  };

  const startThreadDeleteFromMenu = (thread) => {
    if (!thread?.conversation_key) return;
    selectConversation(thread.conversation_key);
    setDeleteThreadConfirm(true);
  };

  const startPrivateTitleEditFromMenu = (conversation) => {
    if (!conversation?.conversation_key) return;
    pendingPrivateTitleEditRef.current = {
      conversationKey: conversation.conversation_key,
      title: String(conversation.title ?? '').trim()
    };
    selectConversation(conversation.conversation_key);
  };

  const startPrivateDeleteFromMenu = (conversation) => {
    if (!conversation?.conversation_key) return;
    selectConversation(conversation.conversation_key);
    setDeleteConversationConfirm(true);
  };

  const startTitleEdit = () => {
    if (!activeConversationUuid || titleEditing || savingTitle) return;
    setTitleDraft(conversationSubtitle);
    setTitleEditing(true);
  };

  const cancelTitleEdit = () => {
    setTitleEditing(false);
    setTitleDraft('');
  };

  const saveConversationTitle = async () => {
    if (!activeConversationUuid || titleSaveLockRef.current) return;
    const nextTitle = titleDraft.trim();
    if (nextTitle === conversationSubtitle) {
      cancelTitleEdit();
      return;
    }
    titleSaveLockRef.current = true;
    setSavingTitle(true);
    setNotice('');
    const result = await updateChatConversationTitle(activeConversationUuid, nextTitle);
    if (result.error) {
      setNotice('Nie udało się zapisać tematu rozmowy.');
      titleSaveLockRef.current = false;
      setSavingTitle(false);
      return;
    }
    const savedTitle = String(result.data?.title ?? nextTitle).trim();
    onConversationUpdated?.(activeConversationUuid, { title: savedTitle });
    setTitleEditing(false);
    setTitleDraft('');
    titleSaveLockRef.current = false;
    setSavingTitle(false);
  };

  const handleTitleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveConversationTitle();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  };

  const handleTitleBlur = () => {
    if (!titleEditing || savingTitle) return;
    saveConversationTitle();
  };

  const selectConversation = (conversationId) => {
    publicThreadCreateOriginRef.current = null;
    pendingPrivateTitleEditRef.current = null;
    setContextMenu(null);
    if (renamingThreadId) {
      setRenamingThreadId(null);
      setRenameThreadDraft('');
    }
    setSelectedConversationId(conversationId);
    setDeleteConversationConfirm(false);
    setClearPublicConfirm(false);
    setCreatingPublicThread(false);
    setPublicThreadDraft('');
    setNotice('');
  };

  const openConversationWithContact = async (user) => {
    if (!user?.id || openingConversation) return;
    setSelectedContactId(user.id);
    setNotice('');
    setOpeningConversation(true);

    const localConversation = conversations.find((conversation) => conversation.partner_user_id === user.id);
    if (localConversation?.conversation_key) {
      selectConversation(localConversation.conversation_key);
      setOpeningConversation(false);
      return;
    }

    const result = await findActiveChatConversationWithPartner({
      partnerUserId: user.id,
      currentUserId
    });
    if (result.error) {
      setNotice('Nie udało się otworzyć rozmowy.');
      setOpeningConversation(false);
      return;
    }

    if (result.data?.conversation_key) {
      selectConversation(result.data.conversation_key);
    } else {
      selectConversation(getChatConversationId(user.id));
    }
    setOpeningConversation(false);
  };

  const sendMessage = async () => {
    if (!canCreate || sending) return;
    const text = draft.trim();
    if (!text) return;
    const requestId = ++sendRequestRef.current;
    setSending(true);
    setNotice('');
    const wasDraftConversation = selectedConversationId.startsWith('user:');
    if (import.meta.env.DEV) {
      console.debug('[Chat] send start', {
        conversationId: selectedPublicThread?.id ?? activeConversationUuid ?? selectedConversationUuid,
        recipientId: selectedRecipientId,
        senderId: currentUserId,
        context: selectedPublicThread ? 'thread' : selectedConversationUuid ? 'private' : 'general'
      });
    }
    try {
      if (import.meta.env.DEV) console.debug('[Chat] send service start');
      const result = await sendChatMessage({
        recipientUserId: selectedRecipientId,
        conversationId: selectedPublicThread?.id ?? activeConversationUuid ?? selectedConversationUuid,
        message: text,
        currentUserId
      });
      if (requestId !== sendRequestRef.current) return;
      if (result.error) {
        if (import.meta.env.DEV) console.debug('[Chat] send error', result.error);
        setNotice('Nie udało się wysłać wiadomości.');
        return;
      }
      if (import.meta.env.DEV) console.debug('[Chat] send success', { messageId: result.data?.id });
      setDraft('');
      requestAnimationFrame(() => draftRef.current?.focus());
      const sentConversationUuid = result.conversationId ?? result.data?.conversation_id ?? null;
      if (wasDraftConversation && sentConversationUuid) {
        setSelectedConversationId(getChatConversationKey(sentConversationUuid));
        onConversationCreated?.();
      } else if (
        sentConversationUuid
        && selectedConversationUuid
        && sentConversationUuid !== selectedConversationUuid
      ) {
        conversationRemapRef.current.set(selectedConversationUuid, sentConversationUuid);
        onConversationReplaced?.({
          previousConversationUuid: selectedConversationUuid,
          nextConversationUuid: sentConversationUuid,
          keepConversationKey: selectedConversationId
        });
        onConversationCreated?.();
      } else if (result.conversationCreated) {
        onConversationCreated?.();
      }
      if (result.data) {
        const nextMessage = normalizeChatMessage(result.data, profilesById);
        onMessageCreated?.(nextMessage);
      }
    } catch (error) {
      if (requestId !== sendRequestRef.current) return;
      if (import.meta.env.DEV) console.debug('[Chat] send error', error);
      console.warn('[Chat] send failed', error);
      setNotice('Nie udało się wysłać wiadomości.');
    } finally {
      if (requestId === sendRequestRef.current) {
        setSending(false);
        if (import.meta.env.DEV) console.debug('[Chat] send finish');
      }
    }
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

  const removePublicThread = async () => {
    if (!selectedPublicThread?.id || deletingThread) return;
    setDeletingThread(true);
    setNotice('');
    const result = await deletePublicChatThread(selectedPublicThread.id, { currentUserId, isAdmin });
    if (result.error) {
      setNotice('Nie udało się usunąć wątku.');
      setDeletingThread(false);
      return;
    }
    onPublicThreadDeleted?.(selectedPublicThread.id);
    setDeleteThreadConfirm(false);
    setDeletingThread(false);
    selectConversation(CHAT_ALL_CONVERSATION_ID);
  };

  const removeConversation = async () => {
    if (!activeConversationUuid || deletingConversation) return;
    setDeletingConversation(true);
    const conversationIdsToHide = [...new Set(
      threadConversationIds.length ? threadConversationIds : [activeConversationUuid]
    )];
    let deleteError = null;
    for (const conversationId of conversationIdsToHide) {
      const result = await deleteChatConversation(conversationId, { currentUserId });
      if (result.error) deleteError = result.error;
    }
    if (deleteError) {
      setNotice('Nie udało się usunąć rozmowy.');
      setDeletingConversation(false);
      return;
    }
    onConversationDeleted?.(activeConversationUuid, { threadConversationIds: conversationIdsToHide });
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
          {contacts.map((user) => <button key={user.id} type="button" className={`chat-conversation chat-contact ${selectedContactId === user.id ? 'active' : ''}`} onClick={() => setSelectedContactId(user.id)} onDoubleClick={() => openConversationWithContact(user)}>
            <span className="chat-conversation-user">
              <span className="chat-user-avatar" style={{ '--chat-user-color': user.user_color || '#2563EB', '--chat-user-text-color': getReadableAvatarTextColor(user.user_color) }}>{getChatInitial(user)}</span>
              <span>{getChatUserDisplayName(user)}</span>
            </span>
          </button>)}
        </div>
      </div>
      <div className="chat-sidebar-section chat-general-section">
        <div className="chat-general-section-head">
          <div className="project-section-toggle chat-sidebar-section-toggle">
            <button
              type="button"
              className={`project-icon-action project-task-details-toggle ${generalSectionExpanded ? '' : 'is-collapsed'}`.trim()}
              onClick={toggleGeneralSectionExpanded}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleGeneralSectionExpanded();
                }
              }}
              aria-expanded={generalSectionExpanded}
            >{generalSectionExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
            <span
              className="project-section-name"
              onClick={() => {
                if (!generalSectionExpanded) {
                  toggleGeneralSectionExpanded();
                  return;
                }
                selectConversation(CHAT_ALL_CONVERSATION_ID);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (!generalSectionExpanded) toggleGeneralSectionExpanded();
                  else selectConversation(CHAT_ALL_CONVERSATION_ID);
                }
              }}
              role="button"
              tabIndex={0}
            >Ogólny</span>
            {unreadCounts[CHAT_ALL_CONVERSATION_ID] > 0 && generalSectionExpanded && (
              <span className="chat-general-unread">({unreadCounts[CHAT_ALL_CONVERSATION_ID]})</span>
            )}
          </div>
          {canCreate && generalSectionExpanded && <button type="button" className="chat-public-thread-add" onClick={(event) => {
            event.stopPropagation();
            startCreatePublicThread();
          }}>+ Dodaj</button>}
        </div>
        {generalSectionExpanded && <>
          {creatingPublicThread && (
            <form className="chat-public-thread-create" onSubmit={submitPublicThread}>
              <input
                className="chat-public-thread-input"
                type="text"
                value={publicThreadDraft}
                onChange={(event) => setPublicThreadDraft(event.target.value)}
                onKeyDown={handlePublicThreadDraftKeyDown}
                placeholder="Nazwa wątku"
                maxLength={120}
                disabled={creatingPublicThreadBusy}
                autoFocus
              />
              <button type="submit" disabled={creatingPublicThreadBusy || !publicThreadDraft.trim()}>Utwórz</button>
              <button type="button" className="chat-public-thread-cancel" onClick={cancelCreatePublicThread} disabled={creatingPublicThreadBusy}>Anuluj</button>
            </form>
          )}
          <div className="chat-public-threads-list">
            {publicThreads.map((thread) => {
              const unread = unreadCounts[thread.conversation_key] ?? 0;
              const isRenaming = renamingThreadId === thread.id;
              return <div key={thread.id} className={`chat-conversation chat-public-thread ${selectedConversationId === thread.conversation_key ? 'active' : ''}${isRenaming ? ' is-renaming' : ''}`}>
                {isRenaming
                  ? <input
                    ref={threadRenameInputRef}
                    className="chat-public-thread-rename-input"
                    type="text"
                    value={renameThreadDraft}
                    onChange={(event) => setRenameThreadDraft(event.target.value)}
                    onKeyDown={(event) => handleThreadRenameKeyDown(event, thread.id)}
                    onBlur={() => saveThreadRename(thread.id)}
                    maxLength={120}
                    disabled={savingThreadRename}
                  />
                  : <button type="button" className="chat-public-thread-button" onClick={() => selectConversation(thread.conversation_key)} onContextMenu={(event) => openPublicThreadContextMenu(event, thread)}>
                    <span className="chat-conversation-user">
                      <span className="chat-public-thread-title">{thread.title}</span>
                    </span>
                    {unread > 0 && <span>({unread})</span>}
                  </button>}
              </div>;
            })}
          </div>
        </>}
      </div>
      <div className="chat-sidebar-section chat-private-section">
        <div className="project-section-toggle chat-sidebar-section-toggle" onClick={togglePrivateSectionExpanded} role="button" tabIndex={0} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePrivateSectionExpanded();
          }
        }}>
          <span className={`project-icon-action project-task-details-toggle ${privateSectionExpanded ? '' : 'is-collapsed'}`.trim()} aria-hidden="true">{privateSectionExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
          <span className="project-section-name">Rozmowy prywatne</span>
        </div>
        {privateSectionExpanded && <div className="chat-private-conversations-list">
          {conversations.map((conversation) => {
            const unread = unreadCounts[conversation.conversation_key] ?? 0;
            const meta = formatChatConversationMeta(conversation);
            return <button key={conversation.id} type="button" className={`chat-conversation ${selectedConversationId === conversation.conversation_key ? 'active' : ''}`} onClick={() => selectConversation(conversation.conversation_key)} onContextMenu={(event) => openPrivateConversationContextMenu(event, conversation)}>
              <span className="chat-conversation-user">
                <span className="chat-user-avatar" style={{ '--chat-user-color': conversation.partner_color || '#2563EB', '--chat-user-text-color': getReadableAvatarTextColor(conversation.partner_color) }}>{getChatInitial({ full_name: conversation.partner_name })}</span>
                <span className="chat-conversation-lines"><strong>{conversation.partner_name}</strong>{meta && <small>{meta}</small>}</span>
              </span>
              {unread > 0 && <span>({unread})</span>}
            </button>;
          })}
        </div>}
      </div>
    </aside>
    <div className="chat-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Zmień szerokość panelu czatu" onPointerDown={startSidebarResize} />
    <section className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title-block">
          <h2 onDoubleClick={canEditConversationTitle ? startTitleEdit : undefined}>{conversationTitle}</h2>
          {selectedPublicThread && publicThreadAuthorLine && (
            <p className="chat-header-subtitle-line chat-header-thread-author">{publicThreadAuthorLine}</p>
          )}
          {canEditConversationTitle && (
            titleEditing
              ? <input
                ref={titleInputRef}
                className="chat-header-title-input"
                type="text"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleBlur}
                maxLength={120}
                disabled={savingTitle}
                aria-label="Temat rozmowy"
              />
              : <p
                className={`chat-header-subtitle-line${conversationSubtitle ? '' : ' chat-header-subtitle-placeholder'}`}
                onDoubleClick={startTitleEdit}
              >
                {conversationSubtitle || 'Dodaj temat rozmowy'}
              </p>
          )}
        </div>
        {selectedConversationUuid && !selectedPublicThread && <button type="button" className="chat-delete-conversation-button" onClick={() => setDeleteConversationConfirm(true)}>Usuń rozmowę</button>}
        {!selectedConversationUuid && !selectedPublicThread && isAdmin && <button type="button" className="chat-delete-conversation-button" onClick={() => setClearPublicConfirm(true)}>Wyczyść historię</button>}
      </div>
      {deleteThreadConfirm && <div className="chat-confirm-delete">
        <div><strong>Czy na pewno chcesz usunąć wątek?</strong><span>Wątek i jego wiadomości zostaną trwale usunięte dla wszystkich.</span></div>
        <button type="button" onClick={() => setDeleteThreadConfirm(false)} disabled={deletingThread}>Anuluj</button>
        <button type="button" onClick={removePublicThread} disabled={deletingThread}>Usuń</button>
      </div>}
      {deleteConversationConfirm && <div className="chat-confirm-delete">
        <div><strong>Czy na pewno chcesz usunąć rozmowę?</strong><span>Rozmowa zostanie ukryta tylko dla Ciebie.</span></div>
        <button type="button" onClick={() => setDeleteConversationConfirm(false)} disabled={deletingConversation}>Anuluj</button>
        <button type="button" onClick={removeConversation} disabled={deletingConversation}>Usuń</button>
      </div>}
      {clearPublicConfirm && <div className="chat-confirm-delete">
        <div><strong>Czy na pewno chcesz wyczyścić historię?</strong><span>Wiadomości z kanału {CHAT_GENERAL_LABEL} zostaną usunięte.</span></div>
        <button type="button" onClick={() => setClearPublicConfirm(false)} disabled={clearingPublicHistory}>Anuluj</button>
        <button type="button" onClick={clearPublicHistory} disabled={clearingPublicHistory}>Wyczyść</button>
      </div>}
      {notice && <div className="notice chat-notice">{notice}</div>}
      <div className="chat-messages" ref={messagesRef} onScroll={() => {
        const box = messagesRef.current;
        if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) markConversationRead(selectedConversationId);
      }}>
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const showDateSeparator = shouldShowChatDateSeparator(message, previousMessage);
          const dateSeparatorLabel = showDateSeparator ? formatChatDateSeparator(message.created_at) : '';
          const canDeleteMessage = message.sender_user_id === currentUserId && !message.deleted_at;
          const authorName = resolveChatMessageAuthor(message, profilesById);
          const authorColor = resolveChatMessageAuthorColor(message, profilesById);
          return <React.Fragment key={message.id}>
            {showDateSeparator && dateSeparatorLabel && (
              <div className="chat-date-separator" role="separator" aria-label={dateSeparatorLabel}>
                <span>{dateSeparatorLabel}</span>
              </div>
            )}
            <article className="chat-message" style={{ '--chat-author-color': authorColor }}>
              <div className="chat-message-meta">
                <strong>{authorName}</strong>
                <span>{formatChatTime(message.created_at)}</span>
              </div>
              <p>{message.message}</p>
              {canDeleteMessage && <button type="button" className="chat-delete-button" onClick={() => removeMessage(message)}>Usuń</button>}
            </article>
          </React.Fragment>;
        })}
        {!messages.length && <EmptyState title="Brak wiadomości." />}
      </div>
      <div className="chat-composer">
        <AppTextarea
          ref={draftRef}
          className="chat-composer-input"
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
    {contextMenu?.type === 'thread' && contextMenu.thread && <ChatContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={closeContextMenu}
      items={[
        {
          key: 'rename-thread',
          label: 'Zmień nazwę',
          visible: canManagePublicThread(contextMenu.thread, currentUserId, isAdmin),
          onClick: () => startThreadRename(contextMenu.thread)
        },
        {
          key: 'delete-thread',
          label: 'Usuń wątek',
          visible: canManagePublicThread(contextMenu.thread, currentUserId, isAdmin),
          className: 'danger-action',
          onClick: () => startThreadDeleteFromMenu(contextMenu.thread)
        }
      ]}
    />}
    {contextMenu?.type === 'private' && contextMenu.conversation && <ChatContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={closeContextMenu}
      items={[
        {
          key: 'edit-topic',
          label: 'Zmień temat',
          onClick: () => startPrivateTitleEditFromMenu(contextMenu.conversation)
        },
        {
          key: 'delete-conversation',
          label: 'Usuń rozmowę',
          className: 'danger-action',
          onClick: () => startPrivateDeleteFromMenu(contextMenu.conversation)
        }
      ]}
    />}
  </div>;
}
