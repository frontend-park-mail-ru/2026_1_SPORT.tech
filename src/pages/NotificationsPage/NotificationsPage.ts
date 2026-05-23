import './NotificationsPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse, Profile } from '../../types/api.types';
import type { Notification } from '../../types/api.types';

interface NotificationsPageParams {
  currentUser?: AuthResponse | null;
  onLogout?: (() => Promise<void>) | null;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getInitials(profile: Profile): string {
  const f = (profile.first_name || '').trim();
  const l = (profile.last_name || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || '?';
}

function renderSkeleton(): string {
  return Array.from({ length: 5 }, () => `
    <div class="notification-skeleton">
      <div class="notification-skeleton__dot"></div>
      <div class="notification-skeleton__content">
        <div class="notification-skeleton__line"></div>
        <div class="notification-skeleton__line notification-skeleton__line--short"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Иконка-эмодзи для типа уведомления
 */
function notifIcon(type: string): string {
  switch (type) {
  case 'subscription': return '🎫';
  case 'donation':     return '💸';
  case 'like':         return '❤️';
  case 'comment':      return '💬';
  case 'post':         return '📝';
  default:             return '🔔';
  }
}

function renderNotificationItem(n: Notification): HTMLElement {
  const item = document.createElement('div');
  item.className = `notification-item${n.is_read ? '' : ' notification-item--unread'}`;
  item.dataset.id = String(n.notification_id);

  // Базовый вариант (без актора)
  item.innerHTML = `
    <div class="notification-item__dot"></div>
    <div class="notification-item__icon">${notifIcon(n.type)}</div>
    <div class="notification-item__content">
      <div class="notification-item__title">${n.title}</div>
      <div class="notification-item__body">${n.body}</div>
    </div>
    <div class="notification-item__time">${formatTime(n.created_at)}</div>
  `;
  return item;
}

/**
 * Для уведомлений с actor_user_id — подгружаем профиль и добавляем аватар + ссылку.
 */
async function enrichWithActor(item: HTMLElement, api: ApiClient, actorUserId: number): Promise<void> {
  try {
    const profile = await api.getProfile(actorUserId);
    const avatarHtml = profile.avatar_url
      ? `<img src="${profile.avatar_url}" class="notification-item__avatar" alt="${profile.first_name}">`
      : `<div class="notification-item__avatar notification-item__avatar--initials">${getInitials(profile)}</div>`;

    const fullName = `${profile.first_name} ${profile.last_name}`.trim();

    // Вставляем аватар перед content
    const iconEl = item.querySelector('.notification-item__icon');
    if (iconEl) iconEl.remove();

    const contentEl = item.querySelector('.notification-item__content') as HTMLElement;
    const avatarWrapper = document.createElement('a');
    avatarWrapper.href = `/profile/${actorUserId}`;
    avatarWrapper.className = 'notification-item__avatar-link';
    avatarWrapper.innerHTML = avatarHtml;
    contentEl.parentNode?.insertBefore(avatarWrapper, contentEl);

    // Добавляем имя перед телом уведомления
    const bodyEl = item.querySelector('.notification-item__body') as HTMLElement;
    const nameEl = document.createElement('div');
    nameEl.className = 'notification-item__actor-name';
    nameEl.textContent = fullName;
    bodyEl.parentNode?.insertBefore(nameEl, bodyEl);
  } catch {
    /* профиль недоступен — оставляем как есть */
  }
}

export async function renderNotificationsPage(
  api: ApiClient,
  container: HTMLElement,
  params: NotificationsPageParams
): Promise<void> {
  void params; // sidebar managed by main.ts

  const template = (window as any).Handlebars.templates['NotificationsPage.hbs'];
  container.innerHTML = template({}).trim();

  const listEl = container.querySelector('#notifications-list') as HTMLElement;
  const markAllBtn = container.querySelector('#mark-all-read-btn') as HTMLButtonElement;

  // Show skeleton
  listEl.innerHTML = renderSkeleton();

  let notifications: Notification[] = [];

  try {
    const data = await api.getNotifications({ limit: 50 });
    notifications = data.notifications || [];
  } catch {
    listEl.innerHTML = '<p class="notifications-page__error">Не удалось загрузить уведомления</p>';
    return;
  }

  const renderList = (): void => {
    listEl.innerHTML = '';
    if (notifications.length === 0) {
      listEl.innerHTML = '<p class="notifications-page__empty">Уведомлений пока нет</p>';
      return;
    }
    notifications.forEach((n, idx) => {
      const item = renderNotificationItem(n);

      // Асинхронно обогащаем актором для subscription/donation/comment/like
      if (n.actor_user_id) {
        void enrichWithActor(item, api, n.actor_user_id);
      }

      if (!n.is_read) {
        item.addEventListener('click', async () => {
          if (item.classList.contains('notification-item--unread')) {
            try {
              await api.markNotificationRead(n.notification_id);
              notifications[idx] = { ...n, is_read: true };
              item.classList.remove('notification-item--unread');
            } catch { /* ignore */ }
          }
        });
      }
      listEl.appendChild(item);
    });
  };

  renderList();

  markAllBtn.addEventListener('click', async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    markAllBtn.disabled = true;
    try {
      await Promise.all(unread.map(n => api.markNotificationRead(n.notification_id)));
      notifications = notifications.map(n => ({ ...n, is_read: true }));
      renderList();
    } catch { /* ignore */ } finally {
      markAllBtn.disabled = false;
    }
  });
}
