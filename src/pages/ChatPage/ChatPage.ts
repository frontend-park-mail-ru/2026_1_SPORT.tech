/**
 * @fileoverview Страница чата — список диалогов + окно переписки
 * @module pages/ChatPage
 */

import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/auth.types';
import type { ChatConversation, ChatMessage, ChatConversationsSnapshot } from '../../types/api.types';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import { getChatSnapshot, emitChatUnread, CHAT_CONVERSATIONS_EVENT } from '../../components/organisms/Sidebar/Sidebar';
import './ChatPage.css';

interface ChatPageParams {
  currentUser: AuthResponse;
  initialUserId?: number; // открыть диалог сразу
}

interface ChatReadEventPayload {
  message_ids?: number[];
}

// Format a timestamp to HH:MM
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Format a timestamp to short date
function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CHAT_LINK_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function appendTextWithLineBreaks(target: HTMLElement, text: string): void {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) target.appendChild(document.createElement('br'));
    if (line) target.appendChild(document.createTextNode(line));
  });
}

function trimUrlPunctuation(rawUrl: string): { url: string; suffix: string } {
  let url = rawUrl;
  let suffix = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if (/[.,!?;:]/.test(lastChar)) {
      suffix = lastChar + suffix;
      url = url.slice(0, -1);
      continue;
    }

    const pair = lastChar === ')' ? '(' : lastChar === ']' ? '[' : lastChar === '}' ? '{' : '';
    if (pair) {
      const openingCount = url.split(pair).length - 1;
      const closingCount = url.split(lastChar).length - 1;
      if (closingCount > openingCount) {
        suffix = lastChar + suffix;
        url = url.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return { url, suffix };
}

function normalizeChatLinkHref(url: string): string | null {
  const href = url.toLowerCase().startsWith('www.') ? `https://${url}` : url;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function appendMessageBody(target: HTMLElement, body: string): void {
  let lastIndex = 0;

  for (const match of body.matchAll(CHAT_LINK_RE)) {
    const matchIndex = match.index ?? 0;
    const rawMatch = match[0];
    if (matchIndex > lastIndex) {
      appendTextWithLineBreaks(target, body.slice(lastIndex, matchIndex));
    }

    const { url, suffix } = trimUrlPunctuation(rawMatch);
    const href = normalizeChatLinkHref(url);
    if (href) {
      const link = document.createElement('a');
      link.className = 'chat-msg__link';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.textContent = url;
      target.appendChild(link);
      if (suffix) appendTextWithLineBreaks(target, suffix);
    } else {
      appendTextWithLineBreaks(target, rawMatch);
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < body.length) {
    appendTextWithLineBreaks(target, body.slice(lastIndex));
  }
}

export async function renderChatPage(
  api: ApiClient,
  container: HTMLElement,
  params: ChatPageParams
): Promise<void> {
  const template = (window as any).Handlebars.templates['ChatPage.hbs'];
  container.innerHTML = template({});

  const myUserId = Number(params.currentUser.user?.user_id ?? 0);

  const convList = container.querySelector('#conversation-list') as HTMLElement;
  const chatWindow = container.querySelector('#chat-window') as HTMLElement;

  // State
  let activeConvUserId: number | null = null;
  let conversations: ChatConversation[] = [];
  let lastRenderedMessageId = 0;
  let lastRenderedDateLabel = '';
  let lastConvSignature = '';
  // Map userId → profile name/avatar (cached)
  const profileCache = new Map<number, { name: string; avatar?: string | null }>();
  // Сообщения, для которых уже отправлен запрос «прочитано» — чтобы повторные
  // ре-рендеры (поллинг/SSE) не слали тот же PATCH снова и снова.
  const readAttempted = new Set<number>();

  // ── Load profile name/avatar for a user ─────────────────────────────────
  async function getProfileInfo(userId: number): Promise<{ name: string; avatar?: string | null }> {
    if (profileCache.has(userId)) return profileCache.get(userId)!;
    try {
      const p = await api.getProfile(userId);
      const name = `${p.first_name} ${p.last_name}`.trim() || p.username;
      const info = { name, avatar: p.avatar_url };
      profileCache.set(userId, info);
      return info;
    } catch {
      const info = { name: `Пользователь #${userId}`, avatar: null };
      profileCache.set(userId, info);
      return info;
    }
  }

  // SSE шлёт id числами, а REST-фолбэк — строками; приводим к числам в одной точке.
  function normalizeConversations(incoming: ChatConversation[]): ChatConversation[] {
    return (incoming || []).map(c => ({
      ...c,
      other_user_id: Number(c.other_user_id),
      unread_count: Number(c.unread_count || 0),
      last_message: c.last_message
        ? {
          ...c.last_message,
          message_id: Number(c.last_message.message_id),
          sender_user_id: Number(c.last_message.sender_user_id),
          receiver_user_id: Number(c.last_message.receiver_user_id)
        }
        : c.last_message
    }));
  }

  // ── Render conversations list from a snapshot ────────────────────────────
  async function applyConversations(incoming: ChatConversation[]): Promise<void> {
    conversations = normalizeConversations(incoming);

    // Подстраховка: если в открытом диалоге появилось сообщение, которого ещё
    // нет на экране (например, SSE не доставил), — догружаем его без F5.
    if (activeConvUserId != null) {
      const activeConv = conversations.find(c => c.other_user_id === activeConvUserId);
      const lastId = Number(activeConv?.last_message?.message_id ?? 0);
      if (lastId > lastRenderedMessageId) {
        await loadMessages(activeConvUserId);
      }
      if (
        activeConv?.last_message
        && Number(activeConv.last_message.sender_user_id) === myUserId
        && activeConv.last_message.is_read
      ) {
        markOutgoingMessagesReadThrough(lastId);
      }
    }

    // Пропускаем перерисовку, если ничего не изменилось — иначе каждый снапшот
    // будет мигать списком и сбрасывать наведение/скролл.
    const signature = conversations
      .map(c => `${c.other_user_id}:${c.last_message?.message_id ?? 0}:${c.unread_count}:${c.last_message?.is_read ? 1 : 0}`)
      .join('|') + `#${activeConvUserId ?? 0}`;
    if (signature === lastConvSignature) return;
    lastConvSignature = signature;

    if (conversations.length === 0) {
      convList.innerHTML = `
        <div class="chat-empty-state">
          <div class="chat-empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p class="chat-empty-state__text">Нет диалогов</p>
          <p class="chat-empty-state__hint">
            Чат доступен при подписке с опцией «Чат».<br>
            Откройте профиль тренера и нажмите кнопку <strong>«Написать»</strong>.
          </p>
        </div>
      `;
      return;
    }

    convList.innerHTML = '';

    for (const conv of conversations) {
      const info = await getProfileInfo(conv.other_user_id);
      const item = document.createElement('div');
      item.className = 'chat-conv-item';
      if (activeConvUserId === conv.other_user_id) item.classList.add('chat-conv-item--active');
      item.dataset.userId = String(conv.other_user_id);

      const avatarHtml = info.avatar
        ? `<img src="${escapeHtml(info.avatar)}" alt="${escapeHtml(info.name)}">`
        : escapeHtml(initials(info.name));

      const preview = conv.last_message?.body
        ? (conv.last_message.body.length > 40
          ? conv.last_message.body.slice(0, 40) + '…'
          : conv.last_message.body)
        : '';
      const timeStr = conv.last_message?.created_at ? formatTime(conv.last_message.created_at) : '';
      const badgeHtml = conv.unread_count > 0
        ? `<span class="chat-conv-item__badge">${conv.unread_count}</span>`
        : '';

      item.innerHTML = `
        <div class="chat-conv-item__avatar">${avatarHtml}</div>
        <div class="chat-conv-item__info">
          <div class="chat-conv-item__name">${escapeHtml(info.name)}</div>
          <div class="chat-conv-item__preview">${escapeHtml(preview)}</div>
        </div>
        <div class="chat-conv-item__meta">
          <span class="chat-conv-item__time">${escapeHtml(timeStr)}</span>
          ${badgeHtml}
        </div>
      `;

      item.addEventListener('click', () => {
        openConversation(conv.other_user_id);
      });
      convList.appendChild(item);
    }
  }

  // ── Open a conversation (load messages + render chat window) ─────────────
  async function openConversation(userId: number): Promise<void> {
    activeConvUserId = userId;

    // Открытие диалога помечает входящие прочитанными — сразу гасим бейдж в
    // списке и в сайдбаре, не дожидаясь подтверждающего SSE-снапшота.
    const conv = conversations.find(c => c.other_user_id === userId);
    if (conv) conv.unread_count = 0;
    emitChatUnread(conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0));

    // Update active highlight in list
    convList.querySelectorAll('.chat-conv-item').forEach(el => {
      const isActive = (el as HTMLElement).dataset.userId === String(userId);
      el.classList.toggle('chat-conv-item--active', isActive);
      if (isActive) el.querySelector('.chat-conv-item__badge')?.remove();
    });

    const info = await getProfileInfo(userId);
    const avatarHtml = info.avatar
      ? `<img src="${escapeHtml(info.avatar)}" alt="${escapeHtml(info.name)}">`
      : escapeHtml(initials(info.name));

    chatWindow.innerHTML = `
      <div class="chat-window__header">
        <button class="chat-window__profile" type="button" data-profile-id="${userId}">
          <span class="chat-window__header-avatar">${avatarHtml}</span>
          <span class="chat-window__header-name">${escapeHtml(info.name)}</span>
        </button>
      </div>
      <div class="chat-messages" id="chat-messages-area">
        <div class="chat-loader"><div class="chat-loader__spinner"></div></div>
      </div>
      <div class="chat-input">
        <textarea class="chat-input__field" id="chat-input-field" placeholder="Написать сообщение…" rows="1"></textarea>
        <button class="chat-input__send" id="chat-send-btn" title="Отправить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    `;

    const profileLink = chatWindow.querySelector('.chat-window__profile') as HTMLButtonElement | null;
    profileLink?.addEventListener('click', () => {
      window.router.navigateTo(`/profile/${userId}`);
    });

    await loadMessages(userId);
    setupInput(userId);
    setupSSE(userId);
  }

  function renderMessageMeta(meta: HTMLElement, time: string, isRead: boolean): void {
    const readMark = isRead
      ? ' <span class="chat-msg__read-mark" aria-label="Прочитано"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/><polyline points="22 12 13 21" opacity="0.75"/></svg></span>'
      : '';
    meta.innerHTML = `${time}${readMark}`;
  }

  function markMessageRead(messageId: number): void {
    const msgEl = chatWindow.querySelector(`.chat-msg[data-message-id="${messageId}"][data-outgoing="true"]`) as HTMLElement | null;
    const meta = msgEl?.querySelector('.chat-msg__meta') as HTMLElement | null;
    if (!msgEl || !meta) return;

    msgEl.dataset.read = 'true';
    renderMessageMeta(meta, meta.dataset.time || '', true);
  }

  function markOutgoingMessagesReadThrough(lastReadMessageId: number): void {
    chatWindow.querySelectorAll('.chat-msg[data-outgoing="true"]').forEach(el => {
      const messageId = Number((el as HTMLElement).dataset.messageId || 0);
      if (messageId > 0 && messageId <= lastReadMessageId) {
        markMessageRead(messageId);
      }
    });
  }

  // ── Append a single message node to the area ────────────────────────────
  function appendMessageNode(area: HTMLElement, msg: ChatMessage): void {
    const dateLabel = formatDate(msg.created_at);
    if (dateLabel !== lastRenderedDateLabel) {
      const div = document.createElement('div');
      div.className = 'chat-messages__date-divider';
      div.textContent = dateLabel;
      area.appendChild(div);
      lastRenderedDateLabel = dateLabel;
    }

    const isOut = Number(msg.sender_user_id) === myUserId;
    const messageId = Number(msg.message_id);
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg chat-msg--${isOut ? 'out' : 'in'}`;
    msgEl.dataset.messageId = String(messageId);
    msgEl.dataset.outgoing = isOut ? 'true' : 'false';
    msgEl.dataset.read = msg.is_read ? 'true' : 'false';
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    appendMessageBody(bubble, msg.body);

    const meta = document.createElement('div');
    meta.className = 'chat-msg__meta';
    meta.dataset.time = formatTime(msg.created_at);
    renderMessageMeta(meta, meta.dataset.time, isOut && msg.is_read);

    msgEl.append(bubble, meta);
    area.appendChild(msgEl);

    if (!isOut && !msg.is_read && myUserId > 0 && messageId > 0 && !readAttempted.has(messageId)) {
      readAttempted.add(messageId);
      api.markChatMessageRead(msg.message_id).catch(() => {/* ignore */});
    }
  }

  // ── Load and render messages (full re-render) ────────────────────────────
  async function loadMessages(userId: number): Promise<void> {
    const area = chatWindow.querySelector('#chat-messages-area') as HTMLElement;
    if (!area) return;

    let messages: ChatMessage[] = [];
    try {
      const data = await api.listChatMessages(userId, { limit: 50 });
      messages = data.messages || [];
    } catch {
      return;
    }

    area.innerHTML = '';
    lastRenderedMessageId = 0;
    lastRenderedDateLabel = '';

    if (messages.length === 0) {
      area.innerHTML = '<p style="text-align:center;color:#adb5bd;font-size:13px;margin-top:40px;">Нет сообщений. Напишите первым!</p>';
      return;
    }

    for (const msg of messages) {
      appendMessageNode(area, msg);
      const id = Number(msg.message_id);
      if (id > lastRenderedMessageId) lastRenderedMessageId = id;
    }
    area.scrollTop = area.scrollHeight;
  }

  // ── SSE ───────────────────────────────────────────────────────────────────
  let activeEventSource: EventSource | null = null;
  let sseFallbackPollTimer: number | null = null;

  function stopSSEFallbackPoll(): void {
    if (sseFallbackPollTimer != null) {
      window.clearInterval(sseFallbackPollTimer);
      sseFallbackPollTimer = null;
    }
  }

  function startSSEFallbackPoll(userId: number): void {
    if (sseFallbackPollTimer != null) return;

    sseFallbackPollTimer = window.setInterval(() => {
      if (activeConvUserId !== userId) {
        stopSSEFallbackPoll();
        return;
      }

      void loadMessages(userId);
    }, 5000);
  }

  function setupSSE(userId: number): void {
    clearSSE();
    const url = `/api/v1/chat/messages/${userId}/stream?after=${lastRenderedMessageId}`;
    const es = new EventSource(url, { withCredentials: true });
    activeEventSource = es;

    es.onopen = () => {
      stopSSEFallbackPoll();
    };

    es.onmessage = (event: MessageEvent) => {
      if (activeConvUserId !== userId) { clearSSE(); return; }
      const area = chatWindow.querySelector('#chat-messages-area') as HTMLElement | null;
      if (!area) { clearSSE(); return; }

      let msg: ChatMessage;
      try {
        msg = JSON.parse(event.data) as ChatMessage;
      } catch {
        return;
      }

      if (Number(msg.message_id) <= lastRenderedMessageId) return;

      const placeholder = area.querySelector('p');
      if (placeholder) area.innerHTML = '';

      const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
      appendMessageNode(area, msg);
      lastRenderedMessageId = Number(msg.message_id);
      if (isAtBottom) area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    };

    es.addEventListener('read', (event: MessageEvent) => {
      if (activeConvUserId !== userId) { clearSSE(); return; }

      let payload: ChatReadEventPayload;
      try {
        payload = JSON.parse(event.data) as ChatReadEventPayload;
      } catch {
        return;
      }

      (payload.message_ids || []).forEach(id => {
        const messageId = Number(id);
        if (Number.isFinite(messageId)) markMessageRead(messageId);
      });
    });

    es.onerror = () => {
      if (activeConvUserId !== userId) {
        clearSSE();
        return;
      }

      void loadMessages(userId);
      startSSEFallbackPoll(userId);
    };
  }

  function clearSSE(): void {
    stopSSEFallbackPoll();
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
  }

  // Список диалогов и счётчик приходят из общего SSE-потока (его держит сайдбар).
  function onConversationsSnapshot(e: Event): void {
    const snapshot = (e as CustomEvent<ChatConversationsSnapshot>).detail;
    if (snapshot) void applyConversations(snapshot.conversations);
  }
  function cleanupChat(): void {
    clearSSE();
    document.removeEventListener(CHAT_CONVERSATIONS_EVENT, onConversationsSnapshot);
  }

  // Закрываем поток и поллинг при навигации
  window.addEventListener('popstate', cleanupChat, { once: true });
  const cleanupObserver = new MutationObserver(() => {
    if (!document.body.contains(chatWindow)) {
      cleanupChat();
      cleanupObserver.disconnect();
    }
  });
  cleanupObserver.observe(document.body, { childList: true, subtree: true });

  // ── Input + send ─────────────────────────────────────────────────────────
  function setupInput(toUserId: number): void {
    const field = chatWindow.querySelector('#chat-input-field') as HTMLTextAreaElement;
    const sendBtn = chatWindow.querySelector('#chat-send-btn') as HTMLButtonElement;
    if (!field || !sendBtn) return;

    // Auto-resize textarea
    const resizeField = () => {
      field.style.height = 'auto';
      const newHeight = Math.min(field.scrollHeight, 120);
      field.style.height = `${newHeight}px`;
      field.style.overflowY = field.scrollHeight > 120 ? 'auto' : 'hidden';
    };
    field.addEventListener('input', resizeField);
    resizeField();

    async function sendMessage(): Promise<void> {
      const body = field.value.trim();
      if (!body) return;

      sendBtn.disabled = true;
      // Remove any previous error banner
      chatWindow.querySelector('.chat-send-error')?.remove();

      try {
        const sentMessage = await api.sendChatMessage(toUserId, body);
        field.value = '';
        field.style.height = 'auto';

        const area = chatWindow.querySelector('#chat-messages-area') as HTMLElement | null;
        if (area) {
          const placeholder = area.querySelector('p');
          if (placeholder) area.innerHTML = '';
          const messageId = Number(sentMessage.message_id);
          if (messageId > lastRenderedMessageId) {
            appendMessageNode(area, sentMessage);
            lastRenderedMessageId = messageId;
            area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
          }
        }

        const nextConversations = conversations.filter(c => c.other_user_id !== toUserId);
        await applyConversations([
          { other_user_id: toUserId, last_message: sentMessage, unread_count: 0 },
          ...nextConversations
        ]);
      } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: number })?.status;
        let displayText = getFriendlyErrorMessage(err, 'Не удалось отправить сообщение. Попробуйте ещё раз.');
        if (status === 403 || /forbidden|PermissionDenied|403|нет доступа/i.test(errMsg)) {
          displayText = 'Нет доступа к чату: проверьте, что у вас активная подписка с опцией «Чат»';
        }
        const errBanner = document.createElement('div');
        errBanner.className = 'chat-send-error';
        errBanner.textContent = displayText;
        const inputEl = chatWindow.querySelector('.chat-input');
        inputEl?.insertAdjacentElement('beforebegin', errBanner);
        // Auto-remove after 5 seconds
        setTimeout(() => errBanner.remove(), 5000);
      } finally {
        sendBtn.disabled = false;
        field.focus();
      }
    }

    sendBtn.addEventListener('click', sendMessage);

    field.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  // Рисуем из кэша снапшота (его уже получил сайдбар); если кэша нет — один
  // REST-запрос, дальше список живёт на SSE-событиях.
  const cached = getChatSnapshot();
  if (cached) {
    await applyConversations(cached.conversations);
  } else {
    try {
      const data = await api.listChatConversations();
      await applyConversations(data.conversations || []);
    } catch { /* список наполнится из SSE */ }
  }

  document.addEventListener(CHAT_CONVERSATIONS_EVENT, onConversationsSnapshot);

  // If a specific user was requested (e.g. from profile page "написать")
  if (params.initialUserId) {
    await openConversation(params.initialUserId);
  }
}
