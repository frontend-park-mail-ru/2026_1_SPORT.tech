import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar.js';
import { renderProfileHeader } from '../../components/molecules/ProfileHeader/ProfileHeader.js';
import { renderProfileContent } from '../../components/organisms/ProfileContent/ProfileContent.js';

/**
 * Рендерит страницу профиля тренера
 * @param {HTMLElement} container
 * @param {Object} params
 */
export async function renderProfilePage(container, {
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
  activeTab = 'main', // ← ДОБАВЛЕНО: активная вкладка
  onLogout = null
} = {}) {
  const template = Handlebars.templates['ProfilePage.hbs'];
  const html = template({});
  
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild;
  
  // Саидбар
  const sidebarContainer = page.querySelector('#sidebar-container');
  await renderSidebar(sidebarContainer, {
    activePage: 'profile',
    currentUser,
    users: subscriptions
  });
  
  // Контейнер для контента профиля
  const profileContainer = page.querySelector('#profile-container');
  
  // Создаем отдельные контейнеры для шапки и контента
  const headerContainer = document.createElement('div');
  headerContainer.className = 'profile-page__header';
  profileContainer.appendChild(headerContainer);
  
  const contentContainer = document.createElement('div');
  contentContainer.className = 'profile-page__content';
  profileContainer.appendChild(contentContainer);
  
  // Рендерим шапку
  await renderProfileHeader(headerContainer, {
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar,
    isOwnProfile: profile.isOwnProfile,
    onEdit: () => console.log('Редактировать профиль')
    // Убрали onSubscribe
  });

  // Рендерим контент с активной вкладкой
  await renderProfileContent(contentContainer, {
    activeTab: activeTab,
    posts,
    popularPosts,
    canAddPost: profile.isOwnProfile, // Только свой профиль может добавлять посты
    onAddPost: () => console.log('Добавить публикацию')
  });
  
  container.appendChild(page);
  return page;
}
