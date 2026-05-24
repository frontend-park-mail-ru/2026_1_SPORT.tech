/**
 * @fileoverview Страница чата — список диалогов + окно переписки
 * @module pages/ChatPage
 */

import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/auth.types';
import type { ChatConversation, ChatMessage } from '../../types/api.types';
import './ChatPage.css';

interface ChatPageParams {
  currentUser: AuthResponse;
  initialUserId?: number; // открыть диалог сразу
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

export async function renderChatPage(
  api: ApiClient,
  container: HTMLElement,
  params: ChatPageParams
): Promise<void> {
  const template = (window as any).Handlebars.templates['ChatPage.hbs'];
  container.innerHTML = template({});

  const myUserId = params.currentUser.user?.user_id ?? 0;

  const convList = container.querySelector('#conversation-list') as HTMLElement;
  const chatWindow = container.querySelector('#chat-window') as HTMLElement;

  // State
  let activeConvUserId: number | null = null;
  let conversations: ChatConversation[] = [];
  // Map userId → profile name/avatar (cached)
  const profileCache = new Map<number, { name: string; avatar?: string | null }>();

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

  // ── Render conversations list ────────────────────────────────────────────
  async function renderConversations(): Promise<void> {
    try {
      const data = await api.listChatConversations();
      conversations = data.conversations || [];
    } catch {
      conversations = [];
    }

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
            Откройте профиль тренера и нажмите кнопку <strong>«💬 Написать»</strong>.
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
        ? `<img src="${info.avatar}" alt="${info.name}">`
        : initials(info.name);

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
          <div class="chat-conv-item__name">${info.name}</div>
          <div class="chat-conv-item__preview">${preview}</div>
        </div>
        <div class="chat-conv-item__meta">
          <span class="chat-conv-item__time">${timeStr}</span>
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

    // Update active highlight in list
    convList.querySelectorAll('.chat-conv-item').forEach(el => {
      el.classList.toggle('chat-conv-item--active', (el as HTMLElement).dataset.userId === String(userId));
    });

    const info = await getProfileInfo(userId);
    const avatarHtml = info.avatar
      ? `<img src="${info.avatar}" alt="${info.name}">`
      : initials(info.name);

    chatWindow.innerHTML = `
      <div class="chat-window__header">
        <div class="chat-window__header-avatar">${avatarHtml}</div>
        <div class="chat-window__header-name">${info.name}</div>
        <span class="chat-window__header-link" data-profile-id="${userId}">Перейти к профилю</span>
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

    // Profile link
    const profileLink = chatWindow.querySelector('.chat-window__header-link') as HTMLElement;
    profileLink?.addEventListener('click', () => {
      window.router.navigateTo(`/profile/${userId}`);
    });

    await loadMessages(userId);
    setupInput(userId);
    setupPolling(userId);
  }

  // ── Load and render messages ─────────────────────────────────────────────
  async function loadMessages(userId: number, append = false): Promise<void> {
    const area = chatWindow.querySelector('#chat-messages-area') as HTMLElement;
    if (!area) return;

    let messages: ChatMessage[] = [];
    try {
      const data = await api.listChatMessages(userId, { limit: 50 });
      messages = data.messages || [];
    } catch {
      messages = [];
    }

    area.innerHTML = '';
    if (messages.length === 0) {
      area.innerHTML = '<p style="text-align:center;color:#adb5bd;font-size:13px;margin-top:40px;">Нет сообщений. Напишите первым!</p>';
      return;
    }

    let lastDate = '';
    for (const msg of messages) {
      const dateLabel = formatDate(msg.created_at);
      if (dateLabel !== lastDate) {
        const div = document.createElement('div');
        div.className = 'chat-messages__date-divider';
        div.textContent = dateLabel;
        area.appendChild(div);
        lastDate = dateLabel;
      }

      const isOut = msg.sender_user_id === myUserId;
      const msgEl = document.createElement('div');
      msgEl.className = `chat-msg chat-msg--${isOut ? 'out' : 'in'}`;
      msgEl.innerHTML = `
        <div class="chat-msg__bubble">${escapeHtml(msg.body)}</div>
        <div class="chat-msg__meta">${formatTime(msg.created_at)}${isOut && msg.is_read ? ' ✓✓' : ''}</div>
      `;
      area.appendChild(msgEl);

      // Mark incoming messages as read
      if (!isOut && !msg.is_read) {
        api.markChatMessageRead(msg.message_id).catch(() => {/* ignore */});
      }
    }

    if (!append) {
      area.scrollTop = area.scrollHeight;
    }
  }

  // ── Polling ──────────────────────────────────────────────────────────────
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  function setupPolling(userId: number): void {
    clearPolling();
    pollingInterval = setInterval(async () => {
      if (activeConvUserId !== userId) { clearPolling(); return; }
      await loadMessages(userId);
    }, 3000);
  }

  function clearPolling(): void {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  }

  // Stop polling when page unmounts (navigation)
  window.addEventListener('popstate', clearPolling, { once: true });

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
        await api.sendChatMessage(toUserId, body);
        field.value = '';
        field.style.height = 'auto';
        await loadMessages(toUserId);
        await renderConversations();
      } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        // Pick a user-friendly message
        let displayText = 'Не удалось отправить сообщение';
        if (errMsg.includes('forbidden') || errMsg.includes('PermissionDenied') || errMsg.includes('403')) {
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

  // ── HTML escape ──────────────────────────────────────────────────────────
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  await renderConversations();

  // If a specific user was requested (e.g. from profile page "написать")
  if (params.initialUserId) {
    await openConversation(params.initialUserId);
  }
}
