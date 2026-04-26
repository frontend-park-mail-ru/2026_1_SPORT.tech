/**
 * @fileoverview Страница профиля пользователя
 * Объединяет сайдбар, шапку профиля и контент
 *
 * @module pages/ProfilePage
 */

import { openDonationModal } from '../../components/molecules/DonationModal/DonationModal.ts';
import { renderProfileHeader } from '../../components/molecules/ProfileHeader/ProfileHeader.ts';
import {
  fillProfilePostsSection,
  renderProfileContent
} from '../../components/organisms/ProfileContent/ProfileContent.ts';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar.ts';
import { loadProfilePageData } from '/src/utils/profilePageData.ts';

/**
 * Рендерит страницу профиля
 * @async
 * @param {import('/src/utils/api.ts').ApiClient} api - API клиент
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} params - Параметры страницы
 * @param {number} params.viewedUserId - ID пользователя, чей профиль открыт
 * @param {Object} [params.profile] - Данные профиля
 * @param {Object} [params.currentUser] - Текущий пользователь
 * @param {Array} [params.subscriptions=[]] - Подписки для сайдбара
 * @param {Array} [params.posts=[]] - Посты
 * @param {Array} [params.popularPosts=[]] - Популярные посты
 * @param {string} [params.activeTab='publications'] - Вкладка
 * @param {Function} [params.onLogout=null] - Выход
 * @returns {Promise<HTMLElement>} Корневой элемент страницы
 */
export async function renderProfilePage(api, container, {
  viewedUserId,
  profile = {
    name: 'Абдурахман Гасанов',
    role: 'Фитнес-тренер',
    avatar: null,
    isOwnProfile: false,
    isTrainer: false
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
  activeTab = 'publications',
  onLogout = null
} = {}) {
  const template = Handlebars.templates['ProfilePage.hbs'];
  const html = template({});

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild;

  container.innerHTML = '';
  container.appendChild(page);

  const sidebarContainer = page.querySelector('#sidebar-container');
  const profileContainer = page.querySelector('#profile-container');

  const headerContainer = document.createElement('div');
  headerContainer.className = 'profile-page__header';
  profileContainer.appendChild(headerContainer);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'profile-page__content';
  profileContainer.appendChild(contentContainer);

  /**
   * Перезагрузка списка постов после лайка, редактирования и т.д.
   */
  async function reloadPosts() {
    const data = await loadProfilePageData(api, viewedUserId);
    const postsContainer = contentContainer.querySelector('#posts-container');
    if (!postsContainer) return;
    await fillProfilePostsSection(postsContainer, {
      activeTab: 'publications',
      posts: data.posts,
      api,
      canManagePosts: profile.isOwnProfile,
      onPostsUpdated: reloadPosts
    });
  }

  await Promise.all([
    renderSidebar(sidebarContainer, {
      activePage: 'profile',
      currentUser,
      users: subscriptions,
      api,
      onLogout
    }),
    renderProfileHeader(headerContainer, {
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar,
      isOwnProfile: profile.isOwnProfile,
      showDonate: profile.isTrainer,
      api,
      onDonate: () => {
        openDonationModal({
          api,
          recipientUserId: viewedUserId
        });
      }
    }),
    renderProfileContent(contentContainer, {
      activeTab,
      posts,
      popularPosts,
      api,
      canAddPost: profile.isOwnProfile && profile.isTrainer,
      canManagePosts: profile.isOwnProfile && profile.isTrainer,
      onPostsUpdated: reloadPosts,
      viewedUserId,
      isTrainer: profile.isTrainer
    })
  ]);

  return page;
}
