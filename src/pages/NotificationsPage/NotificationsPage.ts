// src/pages/NotificationsPage/NotificationsPage.ts

import type { ApiClient } from '../../utils/api';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'subscription' | 'payment' | 'payment_failed';
  text: string;
  time: string; // ISO string
  read: boolean;
  postId?: number;
  userId?: number;
}

// Мок-уведомления, пока нет API
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'like',
    text: 'Иван Петров поставил лайк вашей публикации «Утренняя тренировка»',
    time: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    postId: 101,
    userId: 5
  },
  {
    id: '2',
    type: 'comment',
    text: 'Мария Смирнова оставила комментарий к посту «Питание после тренировки»',
    time: new Date(Date.now() - 7200000).toISOString(),
    read: false,
    postId: 102,
    userId: 8
  },
  {
    id: '3',
    type: 'subscription',
    text: 'Алексей Фёдоров оформил подписку на уровень «Продвинутый»',
    time: new Date(Date.now() - 86400000).toISOString(),
    read: false
  },
  {
    id: '4',
    type: 'payment',
    text: 'Платёж по подписке «Продвинутый» на сумму 700 ₽ успешно выполнен',
    time: new Date(Date.now() - 172800000).toISOString(),
    read: true
  },
  {
    id: '5',
    type: 'payment_failed',
    text: 'Не удалось продлить подписку «Базовый». Проверьте способ оплаты.',
    time: new Date(Date.now() - 259200000).toISOString(),
    read: true
  }
];

interface NotificationsPageParams {
  currentUser?: { id: number; name: string; role: string; avatar: string | null } | null;
  onLogout?: (() => Promise<void>) | null;
  api: ApiClient; // оставлено для будущих вызовов API
}

export async function renderNotificationsPage(
  api: ApiClient,
  container: HTMLElement,
  params: NotificationsPageParams
): Promise<HTMLElement> {
  const { currentUser = null, onLogout = null } = params;

  const template = (window as any).Handlebars.templates['NotificationsPage.hbs'];
  const html = template({});
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild as HTMLElement;

  const sidebarContainer = page.querySelector('#sidebar-container') as HTMLElement;
  const listContainer = page.querySelector('#notifications-list') as HTMLElement;
  const emptyContainer = page.querySelector('#notifications-empty') as HTMLElement;
  const markAllBtn = page.querySelector('[data-mark-all-read]') as HTMLButtonElement;

  // Сайдбар
  await renderSidebar(sidebarContainer, {
    activePage: 'notifications',
    currentUser,
    users: [],
    api,
    onLogout
  });

  let notifications = [...mockNotifications];

  function renderList() {
    if (notifications.length === 0) {
      listContainer.innerHTML = '';
      emptyContainer.hidden = false;
      return;
    }
    emptyContainer.hidden = true;

    listContainer.innerHTML = notifications.map(n => {
      let iconClass = '';
      let iconSvg = '';
      switch (n.type) {
      case 'like':
        iconClass = 'notification-item__icon--like';
        iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        break;
      case 'comment':
        iconClass = 'notification-item__icon--comment';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
        break;
      case 'subscription':
        iconClass = 'notification-item__icon--subscription';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
        break;
      case 'payment':
        iconClass = 'notification-item__icon--payment';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
        break;
      case 'payment_failed':
        iconClass = 'notification-item__icon--warning';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        break;
      }

      const timeStr = new Date(n.time).toLocaleString('ru-RU');
      return `
        <div class="notification-item ${n.read ? '' : 'notification-item--unread'}" data-id="${n.id}">
          <div class="notification-item__icon ${iconClass}">${iconSvg}</div>
          <div class="notification-item__content">
            <div class="notification-item__text">${n.text}</div>
            <div class="notification-item__time">${timeStr}</div>
            <div class="notification-item__actions">
              ${!n.read ? '<button class="notification-item__action-btn" data-mark-read="' + n.id + '">Отметить прочитанным</button>' : ''}
              <button class="notification-item__action-btn" data-delete="${n.id}">Удалить</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Обработчики
  listContainer.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const actionBtn = target.closest('[data-mark-read]') as HTMLElement | null;
    const deleteBtn = target.closest('[data-delete]') as HTMLElement | null;

    if (actionBtn) {
      const id = actionBtn.dataset.markRead!;
      const notif = notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        renderList();
      }
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.delete!;
      notifications = notifications.filter(n => n.id !== id);
      renderList();
    }
  });

  markAllBtn.addEventListener('click', () => {
    notifications.forEach(n => n.read = true);
    renderList();
  });

  renderList();
  container.innerHTML = '';
  container.appendChild(page);

  return page;
}
