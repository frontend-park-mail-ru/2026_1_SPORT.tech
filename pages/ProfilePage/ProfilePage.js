/**
 * @fileoverview Страница профиля пользователя
 * Объединяет сайдбар, шапку профиля и контент
 * 
 * @module pages/ProfilePage
 */

import { renderProfileHeader } from '../../components/molecules/ProfileHeader/ProfileHeader.js';
import { renderProfileContent } from '../../components/organisms/ProfileContent/ProfileContent.js';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar.js';

/**
 * Рендерит страницу профиля
 * @async
 * @param {Object} api - API клиент
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} params - Параметры страницы
 * @param {Object} [params.profile] - Данные профиля
 * @param {string} [params.profile.name='Абдурахман Гасанов'] - Имя
 * @param {string} [params.profile.role='Фитнес-тренер'] - Роль
 * @param {string|null} [params.profile.avatar=null] - URL аватара
 * @param {boolean} [params.profile.isOwnProfile=false] - Свой ли профиль
 * @param {Object} [params.currentUser] - Текущий пользователь
 * @param {string} [params.currentUser.name='Абдурахман Гасанов'] - Имя
 * @param {string} [params.currentUser.role='Фитнес-тренер'] - Роль
 * @param {Array} [params.subscriptions=[]] - Список подписок
 * @param {Array} [params.posts=[]] - Список постов
 * @param {Array} [params.popularPosts=[]] - Список популярных постов
 * @param {string} [params.activeTab='main'] - Активная вкладка
 * @param {Function} [params.onLogout=null] - Обработчик выхода
 * @returns {Promise<HTMLElement>} DOM элемент страницы
 * 
 * @example
 * await renderProfilePage(api, container, {
 *   profile: {
 *     name: 'Иван Петров',
 *     role: 'Тренер',
 *     isOwnProfile: true
 *   },
 *   posts: [...],
 *   activeTab: 'publications'
 * });
 */
export async function renderProfilePage(api, container, {
  profile = {
    name: 'Абдурахман Гасанов',
    role: 'Фитнес-тренер',
    avatar: null,
    isOwnProfile: false
  },
  currentUser = {
    name: 'Абдурахман Гасанов',
    role: 'Фитнес-тренер'
  },
  subscriptions = [
    { id: 1, name: 'Ярослав-Лют... Владимиров', role: 'Физиолог' },
    { id: 2, name: 'Антон Переславль-З...', role: 'Тренер ОФП' },
    { id: 3, name: 'Ксения Бортникова', role: 'Тренер по КОНК...' }
  ],
  posts = [],
  popularPosts = [],
  activeTab = 'main',
  onLogout = null
} = {}) {
  const template = Handlebars.templates['ProfilePage.hbs'];
  const html = template({});

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild;

  /**
   * Рендеринг сайдбара
   */
  const sidebarContainer = page.querySelector('#sidebar-container');
  await renderSidebar(sidebarContainer, {
    activePage: 'profile',
    currentUser,
    users: subscriptions,
    api,
    onLogout
  });

  /**
   * Контейнер для контента профиля
   */
  const profileContainer = page.querySelector('#profile-container');

  /**
   * Отдельные контейнеры для шапки и контента
   */
  const headerContainer = document.createElement('div');
  headerContainer.className = 'profile-page__header';
  profileContainer.appendChild(headerContainer);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'profile-page__content';
  profileContainer.appendChild(contentContainer);

  /**
   * Рендеринг шапки профиля
   */
  await renderProfileHeader(headerContainer, {
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar,
    isOwnProfile: profile.isOwnProfile
  });

  /**
   * Рендеринг контента с активной вкладкой
   */
  await renderProfileContent(contentContainer, {
    activeTab: activeTab,
    posts,
    popularPosts,
    api,
    canAddPost: profile.isOwnProfile
  });

  container.appendChild(page);
  return page;
}
