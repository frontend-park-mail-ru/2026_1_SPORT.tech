/**
 * @fileoverview Компонент контента профиля
 * Содержит вкладки, список постов и правую колонку с популярным
 *
 * @module components/organisms/ProfileContent
 */

import { renderButton } from '../../atoms/Button/Button.ts';
import { renderPostCard } from '../../molecules/PostCard/PostCard.ts';
import { openPostFormModal } from '../../molecules/PostFormModal/PostFormModal.ts';

function setPostsContainerMessageState(container, isMessageState) {
  if (!container) return;
  container.classList.toggle('profile-content__posts-container--message', isMessageState);
  container.closest('.profile-content__main')?.classList.toggle('profile-content__main--message', isMessageState);
}

/**
 * Заполняет контейнер постов
 */
export async function fillProfilePostsSection(postsContainer, {
  activeTab,
  posts = [],
  api,
  canManagePosts = false,
  onPostsUpdated
}) {
  if (posts.length === 0 && activeTab !== 'about') {
    setPostsContainerMessageState(postsContainer, true);
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

  setPostsContainerMessageState(postsContainer, false);
  postsContainer.innerHTML = '';
  await Promise.all(posts.map(post => renderPostCard(postsContainer, {
      ...post,
      api,
      isOwner: canManagePosts,
      onPostsUpdated
    })));
}

function getYearsWord(years) {
  const lastDigit = years % 10;
  const lastTwoDigits = years % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
  if (lastDigit === 1) return 'год';
  if (lastDigit >= 2 && lastDigit <= 4) return 'года';
  return 'лет';
}

function formatPostContent(textContent) {
  if (!textContent) return '';
  return String(textContent)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
    .replace(/\n/g, '<br>');
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

async function showTrainerAbout(container, api, userId) {
  try {
    const [profile, sportTypesResponse] = await Promise.all([
      api.getProfile(userId),
      api.getSportTypes?.().catch(() => ({ sport_types: [] })) ?? { sport_types: [] }
    ]);
    const trainerDetails = profile.trainer_details;

    if (!trainerDetails) {
      setPostsContainerMessageState(container, true);
      container.innerHTML = `<div class="profile-content__empty"><p>Информация о тренере недоступна</p></div>`;
      return;
    }

    setPostsContainerMessageState(container, false);

    const careerDate = trainerDetails.career_since_date
      ? new Date(trainerDetails.career_since_date)
      : null;

    const careerDateStr = careerDate
      ? careerDate.toLocaleDateString('ru-RU')
      : 'Не указано';

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

    const sports = trainerDetails.sports || [];
    const sportTypes = Array.isArray(sportTypesResponse?.sport_types) ? sportTypesResponse.sport_types : [];
    const sportNamesById = new Map(
      sportTypes.map(sportType => [Number(sportType.sport_type_id), sportType.name])
    );
    const sportsList = sports.length > 0
      ? sports.map(s => `
          <div class="trainer-about__sport-item">
            <span class="trainer-about__sport-name">${escapeHtml(sportNamesById.get(Number(s.sport_type_id)) || 'Не указано')}</span>
          </div>
        `).join('')
      : '<p class="trainer-about__section-text">Не указано</p>';

    container.innerHTML = `
      <div class="trainer-about">
        <div class="trainer-about__section">
          <h3 class="trainer-about__section-title">Образование</h3>
          <p class="trainer-about__section-text">${escapeHtml(trainerDetails.education_degree || 'Не указано')}</p>
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
          <p class="trainer-about__section-text">${escapeHtml(profile.bio || 'Не указано')}</p>
        </div>
      </div>
    `;
  } catch (error) {
    setPostsContainerMessageState(container, true);
    container.innerHTML = `<div class="profile-content__empty"><p>Не удалось загрузить информацию</p></div>`;
  }
}

function showClientAbout(container, profile) {
  setPostsContainerMessageState(container, false);
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Не указано';

  container.innerHTML = `
    <div class="trainer-about">
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">Имя пользователя</h3>
        <p class="trainer-about__section-text">${profile.username || 'Не указано'}</p>
      </div>
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">Полное имя</h3>
        <p class="trainer-about__section-text">${fullName}</p>
      </div>
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">О себе</h3>
        <p class="trainer-about__section-text">${profile.bio || 'Не указано'}</p>
      </div>
    </div>
  `;
}

async function loadLikedPosts(api, userId) {
  try {
    const postsData = await api.getUserPosts(userId);
    const postList = Array.isArray(postsData?.posts) ? postsData.posts : [];

    const likedPosts = postList.filter(post => post.is_liked);

    const fullPosts = await Promise.all(likedPosts.map(async post => {
      try {
        const fullPost = await api.getPost(post.post_id);
        const authorProfile = await api.getProfile(post.trainer_id).catch(() => ({}));

        return {
          post_id: post.post_id,
          title: post.title,
          content: formatPostContent(fullPost?.text_content || ''),
          raw_text: fullPost?.text_content || '',
          authorName: `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Автор',
          authorRole: authorProfile.is_trainer ? 'Тренер' : 'Клиент',
          authorAvatar: authorProfile.avatar_url || null,
          likes: post.likes_count || 0,
          liked: true,
          comments: 0,
          can_view: post.can_view,
          created_at: post.created_at,
          min_tier_id: post.min_tier_id ?? null,
          attachments: fullPost?.attachments || [],
          isOwner: false
        };
      } catch {
        return null;
      }
    }));

    return fullPosts.filter(p => p !== null);
  } catch (error) {
    console.error('Failed to load liked posts:', error);
    return [];
  }
}

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
        { id: 'publications', label: 'Понравившиеся', active: activeTab === 'publications' || activeTab === 'main' },
        { id: 'subscriptions', label: 'Подписки', active: activeTab === 'subscriptions' },
        { id: 'about', label: 'О себе', active: activeTab === 'about' }
      ];

  const sectionTitles = {
    main: 'Недавние публикации',
    publications: isTrainer ? 'Все публикации' : 'Понравившиеся',
    subscriptions: 'Подписки',
    about: isTrainer ? 'О тренере' : 'О себе'
  };

  let currentTab = activeTab;
  if (!isTrainer && (currentTab === 'main' || currentTab === 'publications')) {
    currentTab = 'publications';
    tabs[0].active = true;
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
  const postsContainer = element.querySelector('#posts-container');

  if (!isTrainer) {
    if (filtersElement) filtersElement.style.display = 'none';
    if (addButtonContainer) addButtonContainer.style.display = 'none';
  }

  element.querySelectorAll('.profile-content__tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const tabId = tab.dataset.tab;

      element.querySelectorAll('.profile-content__tab').forEach(t => {
        t.classList.remove('profile-content__tab--active');
      });
      tab.classList.add('profile-content__tab--active');

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
      } else if (tabId === 'publications' && !isTrainer) {
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitle.textContent = 'Понравившиеся';

        const likedPosts = await loadLikedPosts(api, viewedUserId);
        await fillProfilePostsSection(postsContainer, {
          activeTab: tabId,
          posts: likedPosts,
          api,
          canManagePosts: false,
          onPostsUpdated
        });
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

  if (currentTab === 'about') {
    if (isTrainer) {
      await showTrainerAbout(postsContainer, api, viewedUserId);
    } else {
      const profile = await api.getProfile(viewedUserId);
      showClientAbout(postsContainer, profile);
    }
  } else if (currentTab === 'publications' && !isTrainer) {
    const likedPosts = await loadLikedPosts(api, viewedUserId);
    await fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts: likedPosts,
      api,
      canManagePosts: false,
      onPostsUpdated
    });
  } else {
    await fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts,
      api,
      canManagePosts,
      onPostsUpdated
    });
  }

  container.appendChild(element);
  return element;
}
