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



// ProfileContent.js - добавить перед showTrainerAbout

function getYearsWord(years) {
  const lastDigit = years % 10;
  const lastTwoDigits = years % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
  if (lastDigit === 1) return 'год';
  if (lastDigit >= 2 && lastDigit <= 4) return 'года';
  return 'лет';
}
// ProfileContent.js - добавить перед renderProfileContent

async function showTrainerAbout(container, api, userId) {
  try {
    const profile = await api.getProfile(userId);
    const trainerDetails = profile.trainer_details;

    if (!trainerDetails) {
      container.innerHTML = `<div class="profile-content__empty"><p>Информация о тренере недоступна</p></div>`;
      return;
    }

    const careerDate = trainerDetails.career_since_date
      ? new Date(trainerDetails.career_since_date)
      : null;

    const careerDateStr = careerDate
      ? careerDate.toLocaleDateString('ru-RU')
      : 'Не указано';

    // Вычисляем стаж
    let experienceYears = 0;
    if (careerDate) {
      const today = new Date();
      experienceYears = today.getFullYear() - careerDate.getFullYear();
      const monthDiff = today.getMonth() - careerDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < careerDate.getDate())) {
        experienceYears--;
      }
      if (experienceYears < 0) experienceYears = 0;
    }
{/* <span class="trainer-about__sport-years">Опыт: ${experienceYears} ${getYearsWord(experienceYears)}</span> //нужно или нет? */}
    const sports = trainerDetails.sports || [];
    const sportsList = sports.length > 0
      ? sports.map(s => `
          <div class="trainer-about__sport-item">
            <span class="trainer-about__sport-name">${s.sports_rank || 'Вид спорта'}</span>

          </div>
        `).join('')
      : '<p class="trainer-about__section-text">Не указано</p>';

    container.innerHTML = `
      <div class="trainer-about">
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">Образование</h3>
          <p class="trainer-about__section-text">${trainerDetails.education_degree || 'Не указано'}</p>
        </div>
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">Начало карьеры</h3>
          <p class="trainer-about__section-text">${careerDateStr}</p>
        </div>
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">Стаж</h3>
          <p class="trainer-about__section-text">${experienceYears} ${getYearsWord(experienceYears)}</p>
        </div>
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">Специализация</h3>
          <div class="trainer-about__sports-list">${sportsList}</div>
        </div>
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">О себе</h3>
          <p class="trainer-about__section-text">${profile.bio || 'Не указано'}</p>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="profile-content__empty"><p>Не удалось загрузить информацию</p></div>`;
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
  onPostsUpdated = null,
  viewedUserId = null,
  isTrainer = true
}) {
  const template = Handlebars.templates['ProfileContent.hbs'];

  const tabs = isTrainer
    ? [
        { id: 'main', label: 'Главная страница', active: activeTab === 'main' },
        { id: 'publications', label: 'Публикации', active: activeTab === 'publications' },
        { id: 'subscriptions', label: 'Подписки', active: activeTab === 'subscriptions' },
        { id: 'about', label: 'О тренере', active: activeTab === 'about' }
      ]
    : [
        { id: 'subscriptions', label: 'Подписки', active: activeTab === 'subscriptions' || activeTab === 'main' },
        { id: 'about', label: 'О себе', active: activeTab === 'about' }
      ];

  const sectionTitles = {
    main: 'Недавние публикации',
    publications: 'Все публикации',
    subscriptions: 'Подписки',
    about: isTrainer ? 'О тренере' : 'О себе'
  };

  // Корректируем activeTab для клиента
  let currentTab = activeTab;
  if (!isTrainer && (currentTab === 'main' || currentTab === 'publications')) {
    currentTab = 'subscriptions';
  }

  const popularWithDescriptions = popularPosts.map(post => ({
    ...post,
    description: post.description || 'Практические советы и рекомендации'
  }));

  const html = template({
    tabs,
    activeTab: currentTab,
    sectionTitle: sectionTitles[currentTab],
    showFilters: isTrainer && (currentTab === 'main' || currentTab === 'publications'),
    popularPosts: popularWithDescriptions,
    canAddPost: canAddPost && currentTab === 'publications'
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;
  const sectionTitle = element.querySelector('.profile-content__section-title');
  const filtersElement = element.querySelector('.profile-content__filters');
  const addButtonContainer = element.querySelector('#add-post-button-container');

  // Скрываем фильтры и кнопку для клиента
  if (!isTrainer) {
    if (filtersElement) filtersElement.style.display = 'none';
    if (addButtonContainer) addButtonContainer.style.display = 'none';
  }

  // Обработчик клика по вкладкам
  element.querySelectorAll('.profile-content__tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const tabId = tab.dataset.tab;

      element.querySelectorAll('.profile-content__tab').forEach(t => {
        t.classList.remove('profile-content__tab--active');
      });
      tab.classList.add('profile-content__tab--active');

      const postsContainer = element.querySelector('#posts-container');

      if (tabId === 'about') {
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitle.textContent = isTrainer ? 'О тренере' : 'О себе';

        if (isTrainer) {
          await showTrainerAbout(postsContainer, api, viewedUserId);
        } else {
          const profile = await api.getProfile(viewedUserId);
          showClientAbout(postsContainer, profile);
        }
      } else {
        if (filtersElement) {
          filtersElement.style.display = (tabId === 'main' || tabId === 'publications') ? 'flex' : 'none';
        }
        if (addButtonContainer) {
          addButtonContainer.style.display = (canAddPost && tabId === 'publications') ? 'block' : 'none';
        }
        sectionTitle.textContent = sectionTitles[tabId] || 'Публикации';

        await fillProfilePostsSection(postsContainer, {
          activeTab: tabId,
          posts: posts,
          api,
          canManagePosts,
          onPostsUpdated
        });
      }
    });
  });

  // Кнопка "Добавить публикацию"
  if (canAddPost && currentTab === 'publications' && isTrainer) {
    const btnContainer = element.querySelector('#add-post-button-container');
    if (btnContainer) {
      await renderButton(btnContainer, {
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

  // Рендеринг постов
  const postsContainer = element.querySelector('#posts-container');
  if (currentTab !== 'about') {
    await fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts,
      api,
      canManagePosts,
      onPostsUpdated
    });
  } else {
    if (isTrainer) {
      await showTrainerAbout(postsContainer, api, viewedUserId);
    } else {
      const profile = await api.getProfile(viewedUserId);
      showClientAbout(postsContainer, profile);
    }
  }

  container.appendChild(element);
  return element;
}
