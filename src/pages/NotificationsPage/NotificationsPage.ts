import './NotificationsPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/api.types';
import type { Notification } from '../../types/api.types';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';

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

function renderNotificationItem(n: Notification): HTMLElement {
  const item = document.createElement('div');
  item.className = `notification-item${n.is_read ? '' : ' notification-item--unread'}`;
  item.dataset.id = String(n.notification_id);
  item.innerHTML = `
    <div class="notification-item__dot"></div>
    <div class="notification-item__content">
      <div class="notification-item__title">${n.title}</div>
      <div class="notification-item__body">${n.body}</div>
    </div>
    <div class="notification-item__time">${formatTime(n.created_at)}</div>
  `;
  return item;
}

export async function renderNotificationsPage(
  api: ApiClient,
  container: HTMLElement,
  params: NotificationsPageParams
): Promise<void> {
  const { currentUser = null, onLogout = null } = params;

  const template = (window as any).Handlebars.templates['NotificationsPage.hbs'];
  container.innerHTML = template({}).trim();

  const sidebarContainer = container.querySelector('#sidebar-container') as HTMLElement;
  const listEl = container.querySelector('#notifications-list') as HTMLElement;
  const markAllBtn = container.querySelector('#mark-all-read-btn') as HTMLButtonElement;

  const currentUserData = currentUser?.user;
  const fullName = currentUserData
    ? `${currentUserData.first_name} ${currentUserData.last_name}`.trim() || currentUserData.username
    : '';

  await renderSidebar(sidebarContainer, {
    activePage: 'notifications',
    currentUser: currentUserData ? {
      id: currentUserData.user_id,
      name: fullName,
      role: currentUserData.is_trainer ? 'Тренер' : 'Пользователь',
      avatar: currentUserData.avatar_url
    } : null,
    api,
    onLogout
  });

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
