/**
 * @fileoverview Компонент бокового меню
 * @module components/organisms/Sidebar
 */

import type { ApiClient } from '../../../utils/api';
import { escapeHtml } from '../../../utils/profilePageData';

interface SidebarUser {
  id: number;
  name: string;
  role: string;
  avatar?: string | null;
  isTrainer?: boolean;
}

interface SidebarParams {
  activePage?: string;
  currentUser?: SidebarUser | null;
  users?: SidebarUser[];
  api: ApiClient;
  onLogout?: (() => Promise<void>) | null;
}

/**
 * Обновляет активный пункт меню без перерендера всего сайдбара.
 * Вызывается при каждом переходе между страницами.
 */
export function setActivePage(sidebarEl: HTMLElement, page: string): void {
  sidebarEl.querySelectorAll('.sidebar__nav-item').forEach(item => {
    const itemPage = (item as HTMLElement).dataset.page;
    item.classList.toggle('sidebar__nav-item--active', itemPage === page);
  });
}

/** Событие, которым страницы сообщают сайдбару актуальное число непрочитанных. */
export const NOTIF_UNREAD_EVENT = 'notifications:unread';

/** Текущий смонтированный сайдбар — на него навешивается обновление бейджа. */
let activeSidebarEl: HTMLElement | null = null;
let unreadListenerInstalled = false;

/**
 * Создаёт/обновляет/удаляет бейдж непрочитанных на пункте «Уведомления».
 * При count === 0 бейдж удаляется, поэтому счётчик пропадает без перезагрузки.
 */
export function updateNotificationBadge(sidebarEl: HTMLElement, count: number): void {
  const notifLink = sidebarEl.querySelector('[data-page="notifications"]');
  if (!notifLink) return;
  let badge = notifLink.querySelector('.sidebar__nav-badge') as HTMLElement | null;
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar__nav-badge';
      notifLink.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
  } else if (badge) {
    badge.remove();
  }
}

/** Сообщить сайдбару новое число непрочитанных (из любой страницы). */
export function emitUnreadCount(count: number): void {
  document.dispatchEvent(new CustomEvent(NOTIF_UNREAD_EVENT, { detail: { count } }));
}

/** Событие, которым страницы сообщают сайдбару число непрочитанных сообщений. */
export const CHAT_UNREAD_EVENT = 'chat:unread';

/** Создаёт/обновляет/удаляет бейдж непрочитанных сообщений на пункте «Чат». */
export function updateChatBadge(sidebarEl: HTMLElement, count: number): void {
  const chatLink = sidebarEl.querySelector('[data-page="chat"]');
  if (!chatLink) return;
  let badge = chatLink.querySelector('.sidebar__nav-badge') as HTMLElement | null;
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar__nav-badge';
      chatLink.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
  } else if (badge) {
    badge.remove();
  }
}

/** Сообщить сайдбару новое число непрочитанных сообщений (из любой страницы). */
export function emitChatUnread(count: number): void {
  document.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, { detail: { count } }));
}

export async function renderSidebar(
  container: HTMLElement,
  params: SidebarParams
): Promise<HTMLElement> {
  const {
    activePage = 'home',
    currentUser = null,
    users = [],
    api,
    onLogout = null
  } = params;

  const template = (window as any).Handlebars.templates['Sidebar.hbs'];

  const navItems = [
    {
      id: 'home',
      label: 'На главную',
      url: '/',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      active: activePage === 'home'
    },
    {
      id: 'profile',
      label: 'Профиль',
      url: '/profile',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      active: activePage === 'profile'
    },
    {
      id: 'notifications',
      label: 'Уведомления',
      url: '/notifications',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
      active: activePage === 'notifications',
      badge: 0
    },
    {
      id: 'chat',
      label: 'Чат',
      url: '/chat',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      active: activePage === 'chat'
    },
    {
      id: 'meetings',
      label: 'Календарь',
      url: '/meetings',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      active: activePage === 'meetings'
    },
    ...(currentUser?.isTrainer ? [{
      id: 'finance',
      label: 'Финансы',
      url: '/finance',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      active: activePage === 'finance'
    }] : [])
  ];

  const usersWithInitials = users.map((u: SidebarUser) => ({
    ...u,
    initials: u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  }));

  const currentWithInitials = currentUser ? {
    ...currentUser,
    initials: currentUser.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  } : null;

  const html = template({
    navItems,
    users: usersWithInitials,
    currentUser: currentWithInitials
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;

  const urls: Record<string, string> = {
    'profile': '/profile',
    'home': '/',
    'auth': '/auth',
    'notifications': '/notifications',
    'finance': '/finance',
    'chat': '/chat',
    'meetings': '/meetings'
  };

  const logo = element.querySelector('.sidebar__logo') as HTMLElement | null;
  if (logo) {
    logo.setAttribute('role', 'button');
    logo.setAttribute('tabindex', '0');
    logo.addEventListener('click', () => {
      window.router.navigateTo('/');
    });
    logo.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.router.navigateTo('/');
      }
    });
  }

  element.querySelectorAll('.sidebar__nav-item').forEach((item: Element) => {
    item.addEventListener('click', (e: Event) => {
      e.preventDefault();
      const page = (item as HTMLElement).dataset.page;
      if (page && urls[page]) {
        window.router.navigateTo(urls[page]);
      }
    });
  });

  element.querySelectorAll('.sidebar__user-item').forEach((item: Element) => {
    item.addEventListener('click', () => {
      const userId = (item as HTMLElement).dataset.userId;
      if (userId) window.router.navigateTo(`/profile/${userId}`);
    });
  });

  const currentUserEl = element.querySelector('.sidebar__current-user') as HTMLElement | null;
  if (currentUserEl) {
    currentUserEl.style.cursor = 'pointer';
    currentUserEl.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('.sidebar__logout-btn')) return;
      window.router.navigateTo('/profile');
    });
  }

  const logoutBtn = element.querySelector('.sidebar__logout-option') as HTMLElement;
  if (logoutBtn && onLogout) {
    logoutBtn.addEventListener('click', async (e: Event) => {
      e.preventDefault();
      await onLogout();
    });
  }

  container.appendChild(element);

  // Сайдбар живёт всю сессию; страницы шлют сюда актуальный счётчик непрочитанных.
  activeSidebarEl = element;
  if (!unreadListenerInstalled) {
    document.addEventListener(NOTIF_UNREAD_EVENT, (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
      if (activeSidebarEl) updateNotificationBadge(activeSidebarEl, count);
    });
    document.addEventListener(CHAT_UNREAD_EVENT, (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
      if (activeSidebarEl) updateChatBadge(activeSidebarEl, count);
    });
    unreadListenerInstalled = true;
  }

  if (currentUser) {
    // Load unread notification badge
    void (async () => {
      try {
        const data = await api.getNotifications({ limit: 50 });
        const unreadCount = (data.notifications || []).filter(n => !n.is_read).length;
        updateNotificationBadge(element, unreadCount);
      } catch { /* ignore */ }
    })();

    // Бейдж непрочитанных сообщений + периодический опрос (живёт всю сессию).
    const refreshChatBadge = async (): Promise<void> => {
      try {
        const data = await api.listChatConversations();
        const total = (data.conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
        updateChatBadge(element, total);
      } catch { /* ignore */ }
    };
    void refreshChatBadge();
    window.setInterval(() => { void refreshChatBadge(); }, 15000);

    // Load subscriptions into sidebar
    void (async () => {
      const listEl = element.querySelector('.sidebar__users-list') as HTMLElement | null;
      if (!listEl) return;
      try {
        const subsData = await api.getMySubscriptions();
        const activeSubs = (subsData.subscriptions || []).filter(s => s.active);

        listEl.innerHTML = '';

        if (activeSubs.length === 0) {
          listEl.innerHTML = '<p style="color:rgba(255,255,255,0.5);font-size:12px;padding:8px;text-align:center;margin:0;">Вы пока ни на кого не подписаны</p>';
          return;
        }

        const profiles = await Promise.all(
          activeSubs.map(s => api.getProfile(s.trainer_id).catch(() => null))
        );

        activeSubs.forEach((sub, idx) => {
          const profile = profiles[idx];
          const name = profile
            ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username
            : `Тренер #${sub.trainer_id}`;
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          const safeName = escapeHtml(name);
          const safeInitials = escapeHtml(initials);
          const safeAvatarUrl = profile?.avatar_url ? escapeHtml(profile.avatar_url) : '';
          const safeTierName = escapeHtml(sub.tier_name);

          const item = document.createElement('div');
          item.className = 'sidebar__user-item';
          item.dataset.userId = String(sub.trainer_id);
          item.innerHTML = `
            <div class="sidebar__user-avatar">
              ${profile?.avatar_url
        ? `<img src="${safeAvatarUrl}" alt="${safeName}">`
        : safeInitials}
            </div>
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">${safeName}</div>
              <div class="sidebar__user-role">${safeTierName}</div>
            </div>
          `;
          item.addEventListener('click', () => {
            window.router.navigateTo(`/profile/${sub.trainer_id}`);
          });
          listEl.appendChild(item);
        });
      } catch { /* ignore */ }
    })();
  }

  return element;
}
