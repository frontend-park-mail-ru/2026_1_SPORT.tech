/**
 * @fileoverview Компонент бокового меню
 * Отображает навигацию, список подписок и текущего пользователя
 * 
 * @module components/organisms/Sidebar
 */

/**
 * Рендерит боковое меню
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} params - Параметры отображения
 * @param {string} [params.activePage='home'] - Активная страница
 * @param {Object} params.currentUser - Текущий пользователь
 * @param {number} params.currentUser.id - ID пользователя
 * @param {string} params.currentUser.name - Имя пользователя
 * @param {string} params.currentUser.role - Роль пользователя
 * @param {string} [params.currentUser.avatar] - URL аватара
 * @param {Array} [params.users=[]] - Список подписок
 * @param {Object} [params.api] - API клиент
 * @param {Function} [params.onLogout=null] - Обработчик выхода
 * @returns {Promise<HTMLElement>} DOM элемент сайдбара
 * 
 * @example
 * await renderSidebar(container, {
 *   activePage: 'profile',
 *   currentUser: {
 *     id: 123,
 *     name: 'Иван Петров',
 *     role: 'Тренер'
 *   },
 *   users: subscriptions,
 *   onLogout: async () => await api.logout()
 * });
 */
export async function renderSidebar(container, {
  activePage = 'home',
  currentUser = {},
  users = [],
  api,
  onLogout = null
}) {
  const template = Handlebars.templates['Sidebar.hbs'];

  /**
   * @constant {Array} navItems - Пункты навигации
   * @property {string} id - ID пункта
   * @property {string} label - Текст пункта
   * @property {string} url - URL для перехода
   * @property {string} icon - HTML иконки
   * @property {boolean} active - Активен ли пункт
   */
  const navItems = [
    {
      id: 'home',
      label: 'На главную',
      url: '/',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      active: activePage === 'home'
    },
    {
      id: 'profile',
      label: 'Профиль',
      url: '/profile',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      active: activePage === 'profile'
    },
    {
      id: 'feed',
      label: 'Лента',
      url: '/feed',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
      active: activePage === 'feed'
    },
    {
      id: 'workouts',
      label: 'Обзор тренировок',
      url: '/workouts',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      active: activePage === 'workouts'
    },
    {
      id: 'messenger',
      label: 'Мессенджер',
      url: '/messenger',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
      active: activePage === 'messenger'
    },
    {
      id: 'notifications',
      label: 'Уведомления',
      url: '/notifications',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      active: activePage === 'notifications'
    },
    {
      id: 'settings',
      label: 'Настройки',
      url: '/settings',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      active: activePage === 'settings'
    }
  ];

  /**
   * Добавляет инициалы пользователям
   * @param {Array} userList - Список пользователей
   * @returns {Array} Пользователи с инициалами
   */
  const usersWithInitials = users.map(u => ({
    ...u,
    initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }));

  /**
   * Текущий пользователь с инициалами
   */
  const currentWithInitials = {
    ...currentUser,
    initials: currentUser.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  };

  const html = template({
    navItems,
    users: usersWithInitials,
    currentUser: currentWithInitials
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;

  /**
   * @constant {Object} urls - Маппинг страниц в URL
   */
  const urls = {
    'profile': '/profile',
    'home': '/',
    'auth': '/auth'
  };

  /**
   * Обработчик клика по пунктам навигации
   * @param {MouseEvent} e - Событие клика
   */
  element.querySelectorAll('.sidebar__nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;

      if (urls[page]) {
        window.router.navigateTo(urls[page]);
      }
    });
  });

  /**
   * Обработчик клика по подписке
   * @param {MouseEvent} _event - Событие клика
   */
  element.querySelectorAll('.sidebar__user-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = item.dataset.userId;
      // TODO: Переход на профиль другого пользователя
    });
  });

  const logoutBtn = element.querySelector('.sidebar__logout-option');
  if (logoutBtn && onLogout) {
    logoutBtn.addEventListener('click', async e => {
      e.preventDefault();
      await onLogout();
    });
  }

  container.appendChild(element);
  return element;
}
