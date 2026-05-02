/**
 * @fileoverview Компонент контента профиля
 * @module components/organisms/ProfileContent
 */

import { loadProfilePageData } from '../../../utils/profilePageData';
import type { ApiClient } from '../../../utils/api';
import type { PostWithAuthor } from '../../../types/post.types';
import { renderButton } from '../../atoms/Button/Button';
import { renderPostCard } from '../../molecules/PostCard/PostCard';
import { openPostFormModal } from '../../molecules/PostFormModal/PostFormModal';
import { openTiersModal } from '../../molecules/TiersModal/TiersModal';
import type { Profile, TrainerDetails, PostListItem, PostAttachment } from '../../../types/api.types';
interface ProfileContentParams {
  activeTab?: string;
  posts?: PostWithAuthor[];
  popularPosts?: PostWithAuthor[];
  canAddPost?: boolean;
  api: ApiClient;
  canManagePosts?: boolean;
  onPostsUpdated?: (() => Promise<void>) | null;
  viewedUserId: number;
  isTrainer?: boolean;
}

interface FillPostsParams {
  activeTab: string;
  posts: PostWithAuthor[];
  api: ApiClient;
  canManagePosts: boolean;
  onPostsUpdated?: (() => Promise<void>) | null;
}

function setPostsContainerMessageState(container: HTMLElement, isMessageState: boolean): void {
  if (!container) return;
  container.classList.toggle('profile-content__posts-container--message', isMessageState);
  container.closest('.profile-content__main')?.classList.toggle('profile-content__main--message', isMessageState);
}

export async function fillProfilePostsSection(
  postsContainer: HTMLElement,
  params: FillPostsParams
): Promise<void> {
  const {
    activeTab,
    posts = [],
    api,
    canManagePosts = false,
    onPostsUpdated
  } = params;

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

  for (const post of posts) {
    await renderPostCard(postsContainer, {
      ...post,
      api,
      isOwner: canManagePosts,
      onPostsUpdated: onPostsUpdated ?? undefined
    });
  }
}

function getYearsWord(years: number): string {
  const lastDigit = years % 10;
  const lastTwoDigits = years % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
  if (lastDigit === 1) return 'год';
  if (lastDigit >= 2 && lastDigit <= 4) return 'года';
  return 'лет';
}

function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function showTrainerAbout(
  container: HTMLElement,
  api: ApiClient,
  userId: number
): Promise<void> {
  try {
    const [profile, sportTypesResponse] = await Promise.all([
      api.getProfile(userId),
      api.getSportTypes().catch(() => ({ sport_types: [] }))
    ]);
    const trainerDetails: TrainerDetails | undefined = profile.trainer_details;

    if (!trainerDetails) {
      setPostsContainerMessageState(container, true);
      container.innerHTML = '<div class="profile-content__empty"><p>Информация о тренере недоступна</p></div>';
      return;
    }

    setPostsContainerMessageState(container, false);

    const careerDate: Date | null = trainerDetails.career_since_date
      ? new Date(trainerDetails.career_since_date)
      : null;

    const careerDateStr: string = careerDate
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
    const sportNamesById = new Map<number, string>(
      sportTypes.map((sportType: { sport_type_id: number; name: string }) => [Number(sportType.sport_type_id), sportType.name])
    );
    const sportsList: string = sports.length > 0
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
  } catch (error: unknown) {
    console.error('Failed to load trainer about:', error);
    setPostsContainerMessageState(container, true);
    container.innerHTML = '<div class="profile-content__empty"><p>Не удалось загрузить информацию</p></div>';
  }
}

function showClientAbout(container: HTMLElement, profile: Profile): void {
  setPostsContainerMessageState(container, false);
  const fullName: string = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Не указано';

  container.innerHTML = `
    <div class="trainer-about">
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">Имя пользователя</h3>
        <p class="trainer-about__section-text">${escapeHtml(profile.username || 'Не указано')}</p>
      </div>
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">Полное имя</h3>
        <p class="trainer-about__section-text">${fullName}</p>
      </div>
      <div class="trainer-about__section">
        <h3 class="trainer-about__section-title">О себе</h3>
        <p class="trainer-about__section-text">${escapeHtml(profile.bio || 'Не указано')}</p>
      </div>
    </div>
  `;
}

interface LikedPost {
  post_id: number;
  title: string;
  content: string;
  raw_text: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  likes: number;
  liked: boolean;
  comments: number;
  can_view: boolean;
  created_at: string;
  min_tier_id: number | null;
  attachments: PostAttachment[];
  isOwner: boolean;
}

async function loadLikedPosts(api: ApiClient, userId: number): Promise<LikedPost[]> {
  try {
    const postsData = await api.getUserPosts(userId);
    const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];
    const likedPosts: PostListItem[] = postList.filter((post: PostListItem) => post.is_liked);
    const fullPosts: LikedPost[] = [];

    for (const post of likedPosts) {
      try {
        const fullPost = await api.getPost(post.post_id);
        const authorProfile = await api.getProfile(post.trainer_id).catch((): Profile => ({
          user_id: post.trainer_id,
          username: '',
          email: '',
          first_name: '',
          last_name: '',
          avatar_url: null,
          bio: null,
          is_trainer: true,
          is_admin: false,
          is_me: false,
          created_at: '',
          updated_at: ''
        }));

        fullPosts.push({
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
        });
      } catch {
        continue;
      }
    }

    return fullPosts;
  } catch (error: unknown) {
    console.error('Failed to load liked posts:', error);
    return [];
  }
}

function formatPostContent(textContent: string): string {
  if (!textContent) return '';
  return String(textContent)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

/**
 * Создаёт кнопку "Настроить уровни" с обработчиком открытия модального окна
 */
function renderTiersButton(container: HTMLElement, api: ApiClient): void {
  container.innerHTML = `
    <div class="tiers-settings">
      <h3 style="margin-bottom:16px;">Уровни подписки</h3>
      <p style="color:#666;margin-bottom:20px;">Настройте уровни подписки, чтобы ваши подписчики могли получать эксклюзивный контент.</p>
    </div>
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--primary-orange button--medium';
  button.style.cssText = 'width: 100%; max-width: 300px; margin: 0 auto; display: block;';
  button.textContent = 'Настроить уровни';

  button.addEventListener('click', () => {
    openTiersModal({
      api,
      onSaved: () => {
        // Уровни сохранены
      }
    }).catch((error: unknown) => {
      console.error('Failed to open tiers modal:', error);
    });
  });

  container.appendChild(button);
}
export async function renderProfileContent(
  container: HTMLElement,
  params: ProfileContentParams
): Promise<HTMLElement> {
  const {
    activeTab = 'main',
    posts: _posts = [],
    popularPosts = [],
    canAddPost = false,
    api,
    canManagePosts = false,
    onPostsUpdated = null,
    viewedUserId,
    isTrainer = true
  } = params;

  const HandlebarsGlobal = (window as unknown as { Handlebars: { templates: Record<string, (context: Record<string, unknown>) => string> } }).Handlebars;
  const template = HandlebarsGlobal.templates['ProfileContent.hbs'];

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

  const sectionTitles: Record<string, string> = {
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
    description: 'Практические советы и рекомендации'
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
  const element = wrapper.firstElementChild as HTMLElement;
  const sectionTitleEl = element.querySelector('.profile-content__section-title') as HTMLElement;
  const filtersElement = element.querySelector('.profile-content__filters') as HTMLElement | null;
  const addButtonContainer = element.querySelector('#add-post-button-container') as HTMLElement | null;
  const postsContainer = element.querySelector('#posts-container') as HTMLElement;
  const subsContainer = element.querySelector('#subscriptions-container') as HTMLElement | null;
  const searchBlock = element.querySelector('.profile-content__search') as HTMLElement | null;
  const sidebarRight = element.querySelector('.profile-content__sidebar-right') as HTMLElement | null;

  if (!isTrainer) {
    if (filtersElement) filtersElement.style.display = 'none';
    if (addButtonContainer) addButtonContainer.style.display = 'none';
  }

  function toggleSearchVisibility(show: boolean): void {
    if (searchBlock) {
      searchBlock.style.display = show ? 'block' : 'none';
    }
  }

  function toggleSidebarVisibility(show: boolean): void {
    if (sidebarRight) {
      sidebarRight.style.display = show ? 'flex' : 'none';
    }
  }

  const activeFilters = new Set<string>();
  let activeDropdown: HTMLElement | null = null;

  const updateFilterLabel = (): void => {
    if (!filtersElement) return;
    const filterSpan = filtersElement.querySelector('span');
    if (filterSpan) {
      filterSpan.textContent = activeFilters.size > 0 ? `Фильтры (${activeFilters.size})` : 'Фильтры';
    }
  };

  const applyFilters = async (): Promise<void> => {
    const freshData = await loadProfilePageData(api, viewedUserId);
    const filteredPosts = activeFilters.size > 0
      ? freshData.posts.filter(p =>
        activeFilters.has(String((p as PostWithAuthor & { sport_type?: string }).sport_type || ''))
      )
      : freshData.posts;

    await fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts: filteredPosts,
      api,
      canManagePosts,
      onPostsUpdated: onPostsUpdated ?? undefined
    });
  };

  if (filtersElement) {
    updateFilterLabel();

    filtersElement.addEventListener('click', async (e: Event) => {
      e.stopPropagation();

      if (activeDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
        return;
      }

      activeDropdown = document.createElement('div');
      activeDropdown.className = 'profile-content__filters-dropdown';
      activeDropdown.innerHTML = `
        <h4 style="margin:0 0 12px; font-size:14px; font-weight:600;">Вид спорта</h4>
        <div id="filter-sport-list"></div>
      `;
      filtersElement.appendChild(activeDropdown);

      const sportTypes = await api.getSportTypes().catch(() => ({ sport_types: [] }));
      const listContainer = activeDropdown.querySelector('#filter-sport-list') as HTMLElement;

      if (sportTypes.sport_types.length > 0) {
        sportTypes.sport_types.forEach((s: { sport_type_id: number; name: string }) => {
          const id = String(s.sport_type_id);
          const label = document.createElement('label');
          label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer;border-radius:6px;';
          label.addEventListener('mouseenter', () => { label.style.background = '#FFF5F0'; });
          label.addEventListener('mouseleave', () => { label.style.background = ''; });

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = id;
          checkbox.checked = activeFilters.has(id);
          checkbox.style.cssText = 'accent-color:#E85A2B;width:16px;height:16px;flex-shrink:0;';

          checkbox.addEventListener('click', (event: Event) => {
            event.stopPropagation();
          });

          checkbox.addEventListener('change', async () => {
            if (checkbox.checked) activeFilters.add(id);
            else activeFilters.delete(id);
            updateFilterLabel();
            await applyFilters();
          });

          const textSpan = document.createElement('span');
          textSpan.textContent = s.name;
          textSpan.style.cssText = 'font-size:14px;user-select:none;';

          label.appendChild(checkbox);
          label.appendChild(textSpan);
          listContainer.appendChild(label);
        });
      } else {
        listContainer.innerHTML = '<p style="color:#999;font-size:13px;">Нет видов спорта</p>';
      }
    });

    document.addEventListener('click', (e: Event) => {
      if (activeDropdown && !activeDropdown.contains(e.target as Node) && e.target !== filtersElement) {
        activeDropdown.remove();
        activeDropdown = null;
      }
    });
  }

  element.querySelectorAll('.profile-content__tab').forEach((tab: Element) => {
    tab.addEventListener('click', async () => {
      const htmlTab = tab as HTMLElement;
      const tabId = htmlTab.dataset.tab as string;

      element.querySelectorAll('.profile-content__tab').forEach((t: Element) => {
        t.classList.remove('profile-content__tab--active');
      });
      htmlTab.classList.add('profile-content__tab--active');

      if (postsContainer) postsContainer.style.display = 'none';
      if (subsContainer) subsContainer.style.display = 'none';

      toggleSearchVisibility(false);
      toggleSidebarVisibility(true);

      if (tabId === 'about') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = isTrainer ? 'О тренере' : 'О себе';

        if (postsContainer) postsContainer.style.display = 'block';

        if (isTrainer) {
          await showTrainerAbout(postsContainer, api, viewedUserId);
        } else {
          const profile = await api.getProfile(viewedUserId);
          showClientAbout(postsContainer, profile);
        }
      } else if (tabId === 'subscriptions') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'Подписки';

        if (subsContainer) {
          subsContainer.style.display = 'block';
          renderTiersButton(subsContainer, api);
        }
      } else if (tabId === 'publications' && !isTrainer) {
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'Понравившиеся';

        if (postsContainer) postsContainer.style.display = 'block';
        toggleSearchVisibility(true);

        const likedPosts = await loadLikedPosts(api, viewedUserId);
        await fillProfilePostsSection(postsContainer, {
          activeTab: tabId,
          posts: likedPosts as PostWithAuthor[],
          api,
          canManagePosts: false,
          onPostsUpdated: onPostsUpdated ?? undefined
        });
      } else {
        if (filtersElement) {
          filtersElement.style.display = (tabId === 'main' || tabId === 'publications') ? 'flex' : 'none';
        }
        if (addButtonContainer) {
          addButtonContainer.style.display = (canAddPost && tabId === 'publications') ? 'block' : 'none';
        }
        sectionTitleEl.textContent = sectionTitles[tabId] || 'Публикации';

        if (postsContainer) postsContainer.style.display = 'block';
        toggleSearchVisibility(true);
        await applyFilters();
      }
    });
  });

  if (canAddPost && currentTab === 'publications' && isTrainer) {
    const btnContainer = element.querySelector('#add-post-button-container') as HTMLElement | null;
    if (btnContainer) {
      await renderButton(btnContainer, {
        text: 'Добавить публикацию',
        variant: 'primary-orange',
        state: 'normal',
        size: 'medium',
        fullWidth: false,
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
    toggleSidebarVisibility(false);
    if (postsContainer) postsContainer.style.display = 'block';
    if (isTrainer) {
      await showTrainerAbout(postsContainer, api, viewedUserId);
    } else {
      const profile = await api.getProfile(viewedUserId);
      showClientAbout(postsContainer, profile);
    }
  } else if (currentTab === 'subscriptions') {
    toggleSidebarVisibility(false);
    if (subsContainer) {
      subsContainer.style.display = 'block';
      renderTiersButton(subsContainer, api);
    }
  } else if (currentTab === 'publications' && !isTrainer) {
    if (postsContainer) postsContainer.style.display = 'block';
    toggleSearchVisibility(true);
    const likedPosts = await loadLikedPosts(api, viewedUserId);
    await fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts: likedPosts as PostWithAuthor[],
      api,
      canManagePosts: false,
      onPostsUpdated: onPostsUpdated ?? undefined
    });
  } else {
    if (postsContainer) postsContainer.style.display = 'block';
    toggleSearchVisibility(true);
    await applyFilters();
  }

  container.appendChild(element);
  return element;
}
