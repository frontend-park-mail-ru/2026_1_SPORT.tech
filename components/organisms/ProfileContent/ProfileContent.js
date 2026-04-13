/**
 * @fileoverview Компонент контента профиля
 * Содержит вкладки, список постов и правую колонку с популярным
 * 
 * @module components/organisms/ProfileContent
 */

import { renderButton } from '../../atoms/Button/Button.js';
import { renderPostCard } from '../../molecules/PostCard/PostCard.js';
import { openPostFormModal } from '../../molecules/PostFormModal/PostFormModal.js';

/**
 * Заполняет контейнер постов (используется при первой отрисовке и при обновлении)
 * @async
 * @param {HTMLElement} postsContainer
 * @param {Object} opts
 * @param {string} opts.activeTab
 * @param {Array} opts.posts
 * @param {import('/src/utils/api.js').ApiClient|null} opts.api
 * @param {boolean} [opts.canManagePosts=false]
 * @param {Function} [opts.onPostsUpdated]
 * @returns {Promise<void>}
 */
export async function fillProfilePostsSection(postsContainer, {
  activeTab,
  posts = [],
  api,
  canManagePosts = false,
  onPostsUpdated
}) {
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
    return;
  }

  postsContainer.innerHTML = '';
  for (const post of posts) {
    await renderPostCard(postsContainer, {
      ...post,
      api,
      isOwner: canManagePosts,
      onPostsUpdated
    });
  }
}

/**
 * Рендерит контент профиля с вкладками
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} params - Параметры отображения
 * @param {string} [params.activeTab='main'] - Активная вкладка
 * @param {Array} [params.posts=[]] - Массив постов
 * @param {Array} [params.popularPosts=[]] - Массив популярных постов
 * @param {boolean} [params.canAddPost=false] - Может ли пользователь добавлять посты
 * @param {Object} [params.api] - API клиент
 * @param {boolean} [params.canManagePosts=false] - Управление своими постами
 * @param {Function} [params.onPostsUpdated] - Обновление списка постов
 * @returns {Promise<HTMLElement>} DOM элемент контента
 * 
 * @example
 * await renderProfileContent(container, {
 *   activeTab: 'publications',
 *   posts: [...],
 *   popularPosts: [...],
 *   canAddPost: true,
 *   canManagePosts: true,
 *   onPostsUpdated: async () => {}
 * });
 */
export async function renderProfileContent(container, {
  activeTab = 'main',
  posts = [],
  popularPosts = [],
  canAddPost = false,
  api,
  canManagePosts = false,
  onPostsUpdated = null
}) {
  const template = Handlebars.templates['ProfileContent.hbs'];

  /**
   * @constant {Array} tabs - Конфигурация вкладок
   * @property {string} id - ID вкладки
   * @property {string} label - Текст вкладки
   * @property {boolean} active - Активна ли вкладка
   */
  const tabs = [
    { id: 'main', label: 'Главная страница', active: activeTab === 'main' },
    { id: 'publications', label: 'Публикации', active: activeTab === 'publications' },
    { id: 'subscriptions', label: 'Подписки', active: activeTab === 'subscriptions' },
    { id: 'about', label: 'О тренере', active: activeTab === 'about' }
  ];

  /**
   * @constant {Object} sectionTitles - Заголовки секций для разных вкладок
   */
  const sectionTitles = {
    main: 'Недавние публикации',
    publications: 'Все публикации',
    subscriptions: 'Подписки',
    about: 'О тренере'
  };

  /**
   * Добавляет описания для популярных постов
   * @param {Array} posts - Массив постов
   * @returns {Array} Посты с описаниями
   */
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
    canAddPost: canAddPost && activeTab === 'publications'
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;

  /**
   * Обработчик клика по вкладке
   * @param {MouseEvent} _event - Событие клика
   */
  element.querySelectorAll('.profile-content__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      // TODO: Реализовать переключение вкладок
    });
  });

  /**
   * Рендеринг кнопки "Добавить публикацию"
   */
  if (canAddPost && activeTab === 'publications') {
    const addButtonContainer = element.querySelector('#add-post-button-container');
    if (addButtonContainer) {
      await renderButton(addButtonContainer, {
        text: 'Добавить публикацию',
        variant: 'primary-orange',
        state: 'normal',
        size: 'medium',
        onClick: async () => {
          await openPostFormModal({
            api,
            mode: 'create',
            onSaved: onPostsUpdated
          });
        }
      });
    }
  }

  /**
   * Рендеринг постов
   */
  const postsContainer = element.querySelector('#posts-container');

  await fillProfilePostsSection(postsContainer, {
    activeTab,
    posts,
    api,
    canManagePosts,
    onPostsUpdated
  });

  container.appendChild(element);
  return element;
}
