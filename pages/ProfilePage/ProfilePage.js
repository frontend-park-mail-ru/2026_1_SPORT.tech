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
  posts = [
    {
      title: 'Топ упражнений на грудные мышцы',
      content: `
        <h4>Анатомия и важность тренировки груди</h4>
        <p>Грудные мышцы — это мощный массив, состоящий в первую очередь из большой и малой грудных мышц...</p>
        <h4>Правила эффективного тренинга</h4>
        <ol>
          <li>Разминка обязательна: Разогрейте суставы и мышцы...</li>
          <li>Разнообразие углов: Грудь состоит из разных пучков...</li>
        </ol>
      `,
      authorName: 'Абдурахман Гасанов',
      authorRole: 'Фитнес-тренер',
      likes: 52,
      comments: 42
    }
  ],
  popularPosts = [
    { title: 'Топ упражнений на грудные мышцы', image: null },
    { title: 'Топ упражнений на мышцы спины', image: null }
  ]
} = {}) {
  const template = Handlebars.templates['ProfilePage.hbs'];
  const html = template({});
  
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild;
  const sidebarContainer = page.querySelector('#sidebar-container');
  await renderSidebar(sidebarContainer, {
    activePage: 'profile',
    currentUser,
    users: subscriptions
  });
  
  const profileContainer = page.querySelector('#profile-container');
  await renderProfileHeader(profileContainer, {
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar,
    isOwnProfile: profile.isOwnProfile,
    onSubscribe: () => console.log('Подписаться'),
    onEdit: () => console.log('Редактировать профиль')
  });

  await renderProfileContent(profileContainer, {
    activeTab: 'main',
    posts,
    popularPosts
  });
  
  container.appendChild(page);
  return page;
}