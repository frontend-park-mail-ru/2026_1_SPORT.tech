import './NotificationsPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse, Profile } from '../../types/api.types';
import type { Notification } from '../../types/api.types';
import { emitUnreadCount } from '../../components/organisms/Sidebar/Sidebar';
import { escapeHtml } from '../../utils/profilePageData';

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
      <div class="notification-skeleton__avatar"></div>
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

  if (n.actor_user_id) {
    const safeTitle = escapeHtml(n.title);
    const safeBody = escapeHtml(n.body);
    const safeTime = escapeHtml(formatTime(n.created_at));
    // Резервируем место под аватар и имя сразу, чтобы не было layout shift при загрузке
    item.innerHTML = `
      <div class="notification-item__dot"></div>
      <a class="notification-item__avatar-link" href="/profile/${n.actor_user_id}">
        <div class="notification-item__avatar notification-item__avatar--placeholder"></div>
      </a>
      <div class="notification-item__content">
        <div class="notification-item__actor-name notification-item__actor-name--loading"></div>
        <div class="notification-item__title">${safeTitle}</div>
        <div class="notification-item__body">${safeBody}</div>
      </div>
      <div class="notification-item__time">${safeTime}</div>
    `;
  } else {
    const safeTitle = escapeHtml(n.title);
    const safeBody = escapeHtml(n.body);
    const safeTime = escapeHtml(formatTime(n.created_at));
    item.innerHTML = `
      <div class="notification-item__dot"></div>
      <div class="notification-item__icon">${notifIcon(n.type)}</div>
      <div class="notification-item__content">
        <div class="notification-item__title">${safeTitle}</div>
        <div class="notification-item__body">${safeBody}</div>
      </div>
      <div class="notification-item__time">${safeTime}</div>
    `;
  }
  return item;
}

/**
 * Для уведомлений с actor_user_id — подгружаем профиль и обновляем уже зарезервированные слоты.
 * Структура DOM не меняется → нет layout shift.
 */
async function enrichWithActor(
  item: HTMLElement,
  fetchProfile: (id: number) => Promise<Profile>,
  actorUserId: number
): Promise<void> {
  try {
    const profile = await fetchProfile(actorUserId);
    const fullName = `${profile.first_name} ${profile.last_name}`.trim();

    // Обновляем аватар-слот
    const avatarSlot = item.querySelector('.notification-item__avatar--placeholder') as HTMLElement | null;
    if (avatarSlot) {
      if (profile.avatar_url) {
        const img = document.createElement('img');
        img.className = 'notification-item__avatar';
        img.alt = profile.first_name || '';
        img.decoding = 'async';
        img.src = profile.avatar_url;
        try {
          // Дожидаемся полной декодировки до вставки в DOM — плейсхолдер-шиммер
          // держится до готовности картинки, поэтому нет мигания «пусто → аватар».
          await img.decode();
          avatarSlot.replaceWith(img);
        } catch {
          // битый/недоступный аватар — откатываемся к инициалам
          avatarSlot.classList.remove('notification-item__avatar--placeholder');
          avatarSlot.classList.add('notification-item__avatar--initials');
          avatarSlot.textContent = getInitials(profile);
        }
      } else {
        avatarSlot.classList.remove('notification-item__avatar--placeholder');
        avatarSlot.classList.add('notification-item__avatar--initials');
        avatarSlot.textContent = getInitials(profile);
      }
    }

    // Обновляем слот имени
    const nameEl = item.querySelector('.notification-item__actor-name--loading') as HTMLElement | null;
    if (nameEl) {
      nameEl.classList.remove('notification-item__actor-name--loading');
      nameEl.textContent = fullName;
    }
  } catch {
    /* профиль недоступен — убираем плейсхолдеры */
    const avatarSlot = item.querySelector('.notification-item__avatar--placeholder') as HTMLElement | null;
    avatarSlot?.classList.remove('notification-item__avatar--placeholder');

    const nameEl = item.querySelector('.notification-item__actor-name--loading') as HTMLElement | null;
    if (nameEl) nameEl.remove();
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

  // Кэшируем (и дедуплицируем) запросы профилей: один и тот же актор в нескольких
  // уведомлениях не вызывает повторных запросов и резких подскоков при разной задержке.
  const profileCache = new Map<number, Promise<Profile>>();
  const fetchProfile = (id: number): Promise<Profile> => {
    let p = profileCache.get(id);
    if (!p) {
      p = api.getProfile(id);
      profileCache.set(id, p);
    }
    return p;
  };

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
        void enrichWithActor(item, fetchProfile, n.actor_user_id);
      }

      if (!n.is_read) {
        item.addEventListener('click', async () => {
          if (item.classList.contains('notification-item--unread')) {
            try {
              await api.markNotificationRead(n.notification_id);
              notifications[idx] = { ...n, is_read: true };
              item.classList.remove('notification-item--unread');
              emitUnreadCount(notifications.filter(x => !x.is_read).length);
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
      emitUnreadCount(0);
    } catch { /* ignore */ } finally {
      markAllBtn.disabled = false;
    }
  });
}
