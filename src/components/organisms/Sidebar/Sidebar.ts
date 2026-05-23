/**
 * @fileoverview Компонент бокового меню
 * @module components/organisms/Sidebar
 */

import type { ApiClient } from '../../../utils/api';

interface SidebarUser {
  id: number;
  name: string;
  role: string;
  avatar?: string | null;
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
    'notifications': '/notifications'
  };

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

  if (currentUser) {
    // Load unread notification badge
    void (async () => {
      try {
        const data = await api.getNotifications({ limit: 50 });
        const unreadCount = (data.notifications || []).filter(n => !n.is_read).length;
        if (unreadCount > 0) {
          const notifLink = element.querySelector('[data-page="notifications"]');
          if (notifLink) {
            let badge = notifLink.querySelector('.sidebar__nav-badge') as HTMLElement | null;
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'sidebar__nav-badge';
              notifLink.appendChild(badge);
            }
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
          }
        }
      } catch { /* ignore */ }
    })();

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

          const item = document.createElement('div');
          item.className = 'sidebar__user-item';
          item.dataset.userId = String(sub.trainer_id);
          item.innerHTML = `
            <div class="sidebar__user-avatar">
              ${profile?.avatar_url
        ? `<img src="${profile.avatar_url}" alt="${name}">`
        : initials}
            </div>
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">${name}</div>
              <div class="sidebar__user-role">${sub.tier_name}</div>
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
