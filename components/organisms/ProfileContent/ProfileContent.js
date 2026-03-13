import { renderButton } from '../../atoms/Button/Button.js';
import { renderPostCard } from '../../molecules/PostCard/PostCard.js';

/**
 * Рендерит контент профиля с вкладками
 * @param {HTMLElement} container
 * @param {Object} params
 * @param {string} params.activeTab 
 * @param {Array} params.posts 
 * @param {Array} params.popularPosts
 * @param {boolean} params.canAddPost - может ли пользователь добавлять посты
 * @param {Function} params.onAddPost - callback для добавления поста
 */
export async function renderProfileContent(container, {
  activeTab = 'main',
  posts = [],
  popularPosts = [],
  canAddPost = false,
  onAddPost = null
}) {
  const template = Handlebars.templates['ProfileContent.hbs'];
  
  const tabs = [
    { id: 'main', label: 'Главная страница', active: activeTab === 'main' },
    { id: 'publications', label: 'Публикации', active: activeTab === 'publications' },
    { id: 'subscriptions', label: 'Подписки', active: activeTab === 'subscriptions' },
    { id: 'about', label: 'О тренере', active: activeTab === 'about' }
  ];
  
  const sectionTitles = {
    main: 'Недавние публикации',
    publications: 'Все публикации',
    subscriptions: 'Подписки',
    about: 'О тренере'
  };
  
  // Добавляем описания для популярных постов
  const popularWithDescriptions = popularPosts.map(post => ({
    ...post,
    description: post.description || 'Практические советы и рекомендации'
  }));
  
  const html = template({
    tabs,
    activeTab,
    sectionTitle: sectionTitles[activeTab],
    showFilters: activeTab === 'main' || activeTab === 'publications',
    popularPosts: popularWithDescriptions,
    canAddPost: canAddPost && activeTab === 'publications' // Показываем только на вкладке "Публикации"
  });
  
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;
  
  // Обработчики вкладок
  element.querySelectorAll('.profile-content__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      console.log('Switch to tab:', tabId);
    });
  });
  
  // Рендерим кнопку "Добавить публикацию" если нужно
  if (canAddPost && activeTab === 'publications') {
    const addButtonContainer = element.querySelector('#add-post-button-container');
    if (addButtonContainer) {
      await renderButton(addButtonContainer, {
        text: 'Добавить публикацию',
        variant: 'primary-orange', // Используем оранжевый тип
        state: 'normal',
        size: 'medium', // Добавляем размер
        onClick: onAddPost
      });
    }
  }
  
  // Рендерим посты
  const postsContainer = element.querySelector('#posts-container');
  
  if (posts.length === 0 && activeTab !== 'about') {
    postsContainer.innerHTML = `
      <div class="profile-content__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p>Пока нет публикаций</p>
      </div>
    `;
  } else {
    for (const post of posts) {
      await renderPostCard(postsContainer, post);
    }
  }
  
  container.appendChild(element);
  return element;
}
