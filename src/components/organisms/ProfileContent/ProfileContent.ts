// src/components/organisms/ProfileContent/ProfileContent.ts

import type { ApiClient } from '../../../utils/api';
import type { PostWithAuthor } from '../../../types/post.types';
import { renderButton } from '../../atoms/Button/Button';
import { renderPostCard } from '../../molecules/PostCard/PostCard';
import { openPostFormModal } from '../../molecules/PostFormModal/PostFormModal';
import { openTiersModal } from '../../molecules/TiersModal/TiersModal';
import { formatMonthlyPrice } from '../../../utils/profilePageData';
import type { Profile, TrainerDetails, PostListItem, PostBlock } from '../../../types/api.types';
import { renderProgressTab } from '../../molecules/ProgressTab/ProgressTab';

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
  isOwnProfile?: boolean;
}

const POSTS_PER_PAGE = 10;

interface FillPostsParams {
  activeTab: string;
  posts: PostWithAuthor[];
  api: ApiClient;
  canManagePosts: boolean;
  onPostsUpdated?: (() => Promise<void>) | null;
  tierNameMap?: Map<number, string>;
  tierPriceMap?: Map<number, number>;
}

interface PostAttachmentCompat {
  post_attachment_id: number;
  kind: string;
  file_url: string;
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
  attachments: PostAttachmentCompat[];
  isOwner: boolean;
}

function setPostsContainerMessageState(container: HTMLElement, isMessageState: boolean): void {
  if (!container) return;
  container.classList.toggle('profile-content__posts-container--message', isMessageState);
  container.closest('.profile-content__main')?.classList.toggle('profile-content__main--message', isMessageState);
}

function extractTextFromBlocks(blocks: PostBlock[] | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return '';
  return blocks
    .filter(block => block.text_content)
    .map(block => block.text_content)
    .join('\n');
}

function extractAttachmentsFromBlocks(blocks: PostBlock[] | undefined): PostAttachmentCompat[] {
  if (!blocks || !Array.isArray(blocks)) return [];
  return blocks
    .filter(block => block.file_url)
    .map(block => ({
      post_attachment_id: block.post_block_id,
      kind: block.kind || 'image',
      file_url: block.file_url
    }));
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
    onPostsUpdated,
    tierNameMap,
    tierPriceMap
  } = params;

  if (posts.length === 0 && activeTab !== 'about') {
    setPostsContainerMessageState(postsContainer, true);
    postsContainer.innerHTML = `
      <div class="profile-content__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>
        </svg>
        <p>Пока нет публикаций</p>
      </div>
    `;
    return;
  }

  setPostsContainerMessageState(postsContainer, false);
  postsContainer.innerHTML = '';

  // Вкладка "публикации" показывает с пагинацией (10 постов на страницу).
  // Остальные вкладки (лайкнутые, подписки, about) рендерят всё сразу.
  const usePagination = activeTab === 'publications';
  const visiblePosts = usePagination ? posts.slice(0, POSTS_PER_PAGE) : posts;

  const renderPostsBatch = async (batch: PostWithAuthor[]): Promise<void> => {
    for (const post of batch) {
      if (tierNameMap && post.min_tier_id) {
        post.tier_name = tierNameMap.get(post.min_tier_id);
        post.tier_price = tierPriceMap?.get(post.min_tier_id) ?? 0;
      }
      await renderPostCard(postsContainer, {
        ...post,
        api,
        isOwner: canManagePosts,
        onPostsUpdated: onPostsUpdated ?? undefined,
        tierName: post.tier_name,
        tierPrice: post.tier_price
      });
    }
  };

  await renderPostsBatch(visiblePosts);

  if (usePagination && posts.length > POSTS_PER_PAGE) {
    let loadedCount = POSTS_PER_PAGE;

    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'profile-content__load-more-btn';
    loadMoreBtn.textContent = `Загрузить ещё (${posts.length - loadedCount} публикаций)`;

    const updateBtn = (): void => {
      const remaining = posts.length - loadedCount;
      if (remaining <= 0) {
        loadMoreBtn.remove();
      } else {
        loadMoreBtn.textContent = `Загрузить ещё (${remaining})`;
        loadMoreBtn.disabled = false;
      }
    };

    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Загрузка...';
      // Временно убираем кнопку чтобы посты рендерились выше неё
      loadMoreBtn.remove();

      const nextBatch = posts.slice(loadedCount, loadedCount + POSTS_PER_PAGE);
      await renderPostsBatch(nextBatch);
      loadedCount += nextBatch.length;

      postsContainer.appendChild(loadMoreBtn);
      updateBtn();
    });

    postsContainer.appendChild(loadMoreBtn);
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

interface TrainerHomeParams {
  posts: PostWithAuthor[];
  api: ApiClient;
  canManagePosts: boolean;
  onPostsUpdated?: (() => Promise<void>) | null;
  tierNameMap?: Map<number, string>;
  tierPriceMap?: Map<number, number>;
  onSeeAll: () => void;
}

const HEART_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

// Компактный тизер поста для обзорной вкладки «Главная страница». В отличие от
// полноразмерных карточек в «Публикациях» — только заголовок, краткий отрывок и
// метрики; клик уводит в «Публикации» к самому посту.
function postTeaserRow(post: PostWithAuthor): string {
  const date = post.created_at ? new Date(post.created_at).toLocaleDateString('ru-RU') : '';
  const flat = (post.raw_text || '').replace(/\s+/g, ' ').trim();
  const snippet = flat.slice(0, 130);
  const locked = !post.can_view;
  return `
    <button class="profile-home__teaser" data-post-id="${post.post_id}" type="button">
      <div class="profile-home__teaser-title">${escapeHtml(post.title || 'Без названия')}</div>
      ${snippet ? `<div class="profile-home__teaser-snippet">${escapeHtml(snippet)}${flat.length > 130 ? '…' : ''}</div>` : ''}
      <div class="profile-home__teaser-meta">
        ${date ? `<span>${escapeHtml(date)}</span>` : ''}
        <span class="profile-home__teaser-stat">${HEART_SVG}${post.likes || 0}</span>
        <span class="profile-home__teaser-stat">💬 ${post.comments || 0}</span>
        ${locked ? '<span class="profile-home__teaser-lock">🔒 по подписке</span>' : ''}
      </div>
    </button>`;
}

// Обзор профиля тренера: «главный пост» (свежайшая публикация крупной карточкой)
// + лента последних публикаций тизерами. Это и есть «стена», а не дубль списка
// из вкладки «Публикации».
async function renderTrainerHome(
  container: HTMLElement,
  params: TrainerHomeParams
): Promise<void> {
  const { posts, api, canManagePosts, onPostsUpdated, tierNameMap, tierPriceMap, onSeeAll } = params;

  if (posts.length === 0) {
    setPostsContainerMessageState(container, true);
    container.innerHTML = `
      <div class="profile-content__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>
        </svg>
        <p>Пока нет публикаций</p>
      </div>`;
    return;
  }

  setPostsContainerMessageState(container, false);

  const sorted = [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const featured = sorted.find(post => post.is_pinned) ?? sorted[0];
  const recent = sorted.filter(post => post.post_id !== featured.post_id).slice(0, 4);

  container.innerHTML = `
    <div class="profile-home">
      <section class="profile-home__block">
        <div class="profile-home__block-head">
          <h3 class="profile-home__block-title">Главный пост</h3>
        </div>
        <div class="profile-home__featured" id="profile-home-featured"></div>
      </section>
      ${recent.length ? `
      <section class="profile-home__block">
        <div class="profile-home__block-head">
          <h3 class="profile-home__block-title">Последние публикации</h3>
          <button type="button" class="profile-home__see-all" id="profile-home-see-all">Все публикации →</button>
        </div>
        <div class="profile-home__recent">
          ${recent.map(postTeaserRow).join('')}
        </div>
      </section>` : ''}
    </div>`;

  const featuredEl = container.querySelector('#profile-home-featured') as HTMLElement;
  if (tierNameMap && featured.min_tier_id) {
    featured.tier_name = tierNameMap.get(featured.min_tier_id);
    featured.tier_price = tierPriceMap?.get(featured.min_tier_id) ?? 0;
  }
  await renderPostCard(featuredEl, {
    ...featured,
    api,
    isOwner: canManagePosts,
    onPostsUpdated: onPostsUpdated ?? undefined,
    tierName: featured.tier_name,
    tierPrice: featured.tier_price
  });

  container.querySelector('#profile-home-see-all')?.addEventListener('click', onSeeAll);

  container.querySelectorAll<HTMLElement>('.profile-home__teaser').forEach(el => {
    el.addEventListener('click', () => {
      const postId = el.dataset.postId;
      onSeeAll();
      // После переключения на «Публикации» доскролливаем к выбранному посту.
      window.setTimeout(() => {
        const card = document.querySelector<HTMLElement>(`[data-post-id="${postId}"][data-post-expand]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    });
  });
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

async function showTrainerAbout(
  container: HTMLElement,
  api: ApiClient,
  userId: number
): Promise<void> {
  setPostsContainerMessageState(container, false);
  const skeletonSection = `
    <div class="trainer-about__section">
      <div class="page-skeleton__block" style="height:20px;width:38%;margin-bottom:14px;border-radius:6px;"></div>
      <div class="page-skeleton__block" style="height:22px;width:60%;border-radius:6px;"></div>
    </div>
  `;
  container.innerHTML = `
    <div class="trainer-about" aria-busy="true">
      ${skeletonSection.repeat(4)}
      <div class="trainer-about__section">
        <div class="page-skeleton__block" style="height:20px;width:38%;margin-bottom:14px;border-radius:6px;"></div>
        <div class="page-skeleton__block" style="height:14px;width:90%;margin-bottom:8px;border-radius:6px;"></div>
        <div class="page-skeleton__block" style="height:14px;width:70%;border-radius:6px;"></div>
      </div>
    </div>
  `;
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

function showClientAbout(container: HTMLElement, profile: Profile, isOwnProfile = false): void {
  setPostsContainerMessageState(container, false);
  const fullName: string = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Не указано';
  const bioLabel = isOwnProfile ? 'О себе' : 'О клиенте';

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
        <h3 class="trainer-about__section-title">${bioLabel}</h3>
        <p class="trainer-about__section-text">${escapeHtml(profile.bio || 'Не указано')}</p>
      </div>
    </div>
  `;
}

async function loadLikedPosts(api: ApiClient, userId: number): Promise<LikedPost[]> {
  try {
    const postsData = await api.getUserPosts(userId);
    const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];
    const likedPosts: PostListItem[] = postList.filter((post: PostListItem) => post.is_liked);

    // Грузим все понравившиеся посты параллельно (раньше был последовательный
    // for с двумя запросами на каждый пост — N+1, секунды ожидания).
    const settled = await Promise.all(
      likedPosts.map(async (post): Promise<LikedPost | null> => {
        try {
          const [fullPost, authorProfile] = await Promise.all([
            api.getPost(post.post_id),
            api.getProfile(post.trainer_id).catch((): Profile => ({
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
            }))
          ]);

          const textContent = extractTextFromBlocks(fullPost?.blocks);
          const attachments = extractAttachmentsFromBlocks(fullPost?.blocks);

          return {
            post_id: post.post_id,
            title: post.title,
            content: formatPostContent(textContent),
            raw_text: textContent,
            authorName: `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Автор',
            authorRole: authorProfile.is_trainer ? 'Тренер' : 'Клиент',
            authorAvatar: authorProfile.avatar_url || null,
            likes: post.likes_count || 0,
            liked: true,
            comments: post.comments_count || 0,
            can_view: post.can_view,
            created_at: post.created_at,
            min_tier_id: post.min_tier_id ?? null,
            attachments: attachments,
            isOwner: false
          };
        } catch {
          return null;
        }
      })
    );

    return settled.filter((p): p is LikedPost => p !== null);
  } catch (error: unknown) {
    console.error('Failed to load liked posts:', error);
    return [];
  }
}

function showPostsSkeleton(container: HTMLElement): void {
  const card = `
    <div class="post-skeleton">
      <div class="post-skeleton__header">
        <div class="page-skeleton__block post-skeleton__avatar"></div>
        <div class="post-skeleton__meta">
          <div class="page-skeleton__block post-skeleton__name"></div>
          <div class="page-skeleton__block post-skeleton__role"></div>
        </div>
      </div>
      <div class="page-skeleton__block post-skeleton__title"></div>
      <div class="page-skeleton__block post-skeleton__line"></div>
      <div class="page-skeleton__block post-skeleton__line post-skeleton__line--short"></div>
    </div>
  `;
  container.innerHTML = card + card + card;
}

function showAboutSkeleton(container: HTMLElement): void {
  setPostsContainerMessageState(container, false);
  container.innerHTML = `
    <div class="trainer-about">
      <div class="trainer-about__section">
        <div class="page-skeleton__block" style="height:18px;width:160px;margin-bottom:14px;border-radius:6px;"></div>
        <div class="page-skeleton__block" style="height:18px;width:70%;border-radius:6px;"></div>
      </div>
      <div class="trainer-about__section">
        <div class="page-skeleton__block" style="height:18px;width:140px;margin-bottom:14px;border-radius:6px;"></div>
        <div class="page-skeleton__block" style="height:18px;width:54%;border-radius:6px;"></div>
      </div>
      <div class="trainer-about__section">
        <div class="page-skeleton__block" style="height:18px;width:120px;margin-bottom:14px;border-radius:6px;"></div>
        <div class="page-skeleton__block" style="height:42px;width:100%;border-radius:8px;"></div>
      </div>
    </div>
  `;
}

async function renderSubscriptionsSection(
  container: HTMLElement,
  api: ApiClient,
  isTrainer: boolean,
  isOwnProfile: boolean,
  viewedUserId: number
): Promise<void> {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'tiers-settings';

  if (isOwnProfile && isTrainer) {
    const header = document.createElement('div');
    header.innerHTML = `
      <p style="color:#666;margin-bottom:20px;">Настройте уровни подписки, чтобы ваши подписчики могли получать эксклюзивный контент.</p>
    `;
    wrapper.appendChild(header);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button--primary-orange button--medium';
    button.style.cssText = 'width:100%;max-width:300px;margin:0 auto 20px;display:block;';
    button.textContent = 'Настроить уровни';
    wrapper.appendChild(button);

    const tiersList = document.createElement('div');
    wrapper.appendChild(tiersList);
    container.appendChild(wrapper);

    const loadOwnTiers = async (): Promise<void> => {
      tiersList.innerHTML = `
        <div class="page-skeleton__block" style="height:76px;border-radius:12px;margin-bottom:12px;"></div>
        <div class="page-skeleton__block" style="height:76px;border-radius:12px;"></div>
      `;
      try {
        const tiersData = await api.getTrainerTiers(viewedUserId);
        const tiers = tiersData?.tiers ?? [];
        tiersList.innerHTML = '';

        if (tiers.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'text-align:center;padding:32px 16px;';
          empty.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="color:#ccc;">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <p style="margin:12px 0 4px;font-weight:600;color:#555;">Вы ещё не настроили уровни подписки</p>
            <p style="color:#999;font-size:13px;">Нажмите «Настроить уровни», чтобы добавить.</p>
          `;
          tiersList.appendChild(empty);
          return;
        }

        tiers.forEach(tier => {
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;';
          card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${tier.description ? '8px' : '0'};">
              <strong style="font-size:15px;">${escapeHtml(tier.name)}</strong>
              <span style="color:var(--primary-orange);font-weight:700;font-size:16px;">${formatMonthlyPrice(tier.price)}</span>
            </div>
            ${tier.description ? `<p style="color:#666;font-size:13px;margin:0;">${escapeHtml(tier.description)}</p>` : ''}
          `;
          tiersList.appendChild(card);
        });
      } catch {
        tiersList.innerHTML = '<p style="color:#999;">Не удалось загрузить уровни подписки</p>';
      }
    };

    button.addEventListener('click', () => {
      if (button.disabled) return;
      button.disabled = true;
      openTiersModal({
        api,
        onSaved: () => { void loadOwnTiers(); },
        onClose: () => { button.disabled = false; }
      });
    });
    void loadOwnTiers();
  } else if (!isOwnProfile && isTrainer) {
    const skeletonEl = document.createElement('div');
    skeletonEl.innerHTML = `
      <div class="page-skeleton__block" style="height:76px;border-radius:12px;margin-bottom:12px;"></div>
      <div class="page-skeleton__block" style="height:76px;border-radius:12px;"></div>
    `;
    wrapper.appendChild(skeletonEl);
    container.appendChild(wrapper);

    try {
      const tiersData = await (api as any).getTrainerTiers(viewedUserId);
      skeletonEl.remove();
      const tiers: Array<{ tier_id: number; name: string; price: number; description?: string }> =
        tiersData?.tiers ?? [];

      if (tiers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tiers-empty';
        empty.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="color:#ccc;">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          <p style="margin:12px 0 4px;font-weight:600;color:#555;">Тренер не настроил уровни подписки</p>
          <p style="color:#999;font-size:13px;">Возможно, они появятся позже</p>
        `;
        empty.style.cssText = 'text-align:center;padding:32px 16px;';
        wrapper.appendChild(empty);
      } else {
        tiers.forEach(tier => {
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;';
          card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${tier.description ? '8px' : '0'};">
              <strong style="font-size:15px;">${escapeHtml(tier.name)}</strong>
              <span style="color:var(--primary-orange);font-weight:700;font-size:16px;">${formatMonthlyPrice(tier.price)}</span>
            </div>
            ${tier.description ? `<p style="color:#666;font-size:13px;margin:0;">${escapeHtml(tier.description)}</p>` : ''}
          `;
          wrapper.appendChild(card);
        });
        const hint = document.createElement('p');
        hint.style.cssText = 'color:#999;font-size:13px;margin-top:12px;text-align:center;';
        hint.textContent = 'Для оформления подписки используйте кнопку в шапке профиля';
        wrapper.appendChild(hint);
      }
    } catch {
      skeletonEl.remove();
      const errorEl = document.createElement('p');
      errorEl.style.cssText = 'color:#999;';
      errorEl.textContent = 'Не удалось загрузить уровни подписки';
      wrapper.appendChild(errorEl);
    }
  } else {
    const skeletonEl = document.createElement('div');
    skeletonEl.innerHTML = `
      <div class="page-skeleton__block" style="height:76px;border-radius:12px;margin-bottom:12px;"></div>
      <div class="page-skeleton__block" style="height:76px;border-radius:12px;"></div>
    `;
    wrapper.appendChild(skeletonEl);
    container.appendChild(wrapper);

    try {
      const subs = await api.getMySubscriptions();
      skeletonEl.remove();
      const activeSubs = subs.subscriptions.filter(s => s.active);

      if (activeSubs.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color:#999;text-align:center;padding:20px;';
        empty.textContent = 'У вас пока нет активных подписок';
        wrapper.appendChild(empty);
      } else {
        // Загружаем профили тренеров параллельно
        const trainerProfiles = await Promise.all(
          activeSubs.map(sub =>
            api.getProfile(sub.trainer_id).catch(() => null)
          )
        );

        activeSubs.forEach((sub, idx) => {
          const trainer = trainerProfiles[idx];
          const trainerName = trainer
            ? `${trainer.first_name} ${trainer.last_name}`.trim() || trainer.username
            : `Тренер #${sub.trainer_id}`;
          const avatarUrl = trainer?.avatar_url;
          const safeAvatarUrl = escapeHtml(avatarUrl);
          const safeInitial = escapeHtml(trainerName.charAt(0).toUpperCase());
          const avatarHtml = avatarUrl
            ? `<img src="${safeAvatarUrl}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
            : `<div style="width:36px;height:36px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#888;flex-shrink:0;">${safeInitial}</div>`;

          const expiresDate = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('ru-RU') : 'Не указано';

          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;cursor:pointer;transition:box-shadow 0.2s;';
          card.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              ${avatarHtml}
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:15px;color:#1a2b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(trainerName)}</div>
                <div style="font-size:12px;color:#999;">Тренер</div>
              </div>
              <span style="color:var(--primary-orange);font-weight:700;font-size:15px;flex-shrink:0;">${formatMonthlyPrice(sub.price)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #f0f0f0;">
              <div>
                <div style="font-size:13px;color:#555;font-weight:500;">${escapeHtml(sub.tier_name)}</div>
                <div style="font-size:12px;color:#999;margin-top:2px;">Истекает: ${escapeHtml(expiresDate)}</div>
              </div>
              <span style="font-size:12px;color:var(--primary-orange);font-weight:600;">Перейти →</span>
            </div>
          `;
          card.addEventListener('mouseenter', () => { card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; });
          card.addEventListener('mouseleave', () => { card.style.boxShadow = 'none'; });
          card.addEventListener('click', () => {
            window.router.navigateTo(`/profile/${sub.trainer_id}`);
          });
          wrapper.appendChild(card);
        });
      }
    } catch {
      skeletonEl.remove();
      const errorEl = document.createElement('p');
      errorEl.style.cssText = 'color:#999;';
      errorEl.textContent = 'Не удалось загрузить подписки';
      wrapper.appendChild(errorEl);
    }
  }
}

async function loadPopularPosts(
  element: HTMLElement,
  api: ApiClient,
  trainerId: number
): Promise<void> {
  const listEl = element.querySelector('.profile-content__popular-list') as HTMLElement | null;
  if (!listEl) return;

  try {
    const response = await api.searchPosts({
      trainer_ids: [trainerId],
      sort: 'popular',
      only_available: false,
      limit: 5
    });
    const posts = response.posts || [];

    if (posts.length === 0) {
      listEl.innerHTML = '<p style="color:#999;font-size:13px;padding:8px 0;margin:0;">Пока нет публикаций</p>';
      return;
    }

    listEl.innerHTML = posts.map((post, idx) => `
      <div class="profile-content__popular-item" data-post-id="${post.post_id}" style="cursor:pointer;">
        <div class="profile-content__popular-rank">#${idx + 1}</div>
        <div class="profile-content__popular-info">
          <div class="profile-content__popular-title">${escapeHtml(post.title)}</div>
          <div class="profile-content__popular-stats">
            <span class="profile-content__popular-likes">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              ${post.likes_count || 0}
            </span>
          </div>
        </div>
      </div>
    `).join('');

    // Навигация к посту: скролл + раскрытие карточки в ленте
    listEl.querySelectorAll<HTMLElement>('.profile-content__popular-item').forEach(item => {
      item.addEventListener('click', () => {
        const postId = item.dataset.postId;
        if (!postId) return;

        // Ищем карточку поста в основном контейнере
        const postCard = element.querySelector<HTMLElement>(
          `[data-post-id="${postId}"][data-post-expand]`
        );

        if (postCard) {
          postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Раскрываем карточку если она ещё не развёрнута
          const expandBtn = postCard.querySelector<HTMLElement>('[data-post-expand-btn]');
          if (expandBtn && !postCard.classList.contains('post-card--expanded')) {
            expandBtn.click();
          }
        }
      });
    });
  } catch {
    // не критично — оставляем пустым
  }
}

export async function renderProfileContent(
  container: HTMLElement,
  params: ProfileContentParams
): Promise<HTMLElement> {
  const {
    activeTab = 'main',
    posts: initialPosts = [],
    popularPosts = [],
    canAddPost = false,
    api,
    canManagePosts = false,
    onPostsUpdated = null,
    viewedUserId,
    isTrainer = false,
    isOwnProfile = false
  } = params;

  const HandlebarsGlobal = (window as unknown as { Handlebars: { templates: Record<string, (context: Record<string, unknown>) => string> } }).Handlebars;
  const template = HandlebarsGlobal.templates['ProfileContent.hbs'];

  let tierNameMap: Map<number, string> | undefined;
  let tierPriceMap: Map<number, number> | undefined;

  // «О себе» — для самого пользователя (свой профиль); «О тренере»/«О клиенте» — для чужого профиля.
  const aboutLabel = isOwnProfile ? 'О себе' : (isTrainer ? 'О тренере' : 'О клиенте');

  const tabs = isTrainer
    ? [
      { id: 'main', label: 'Главная страница', active: activeTab === 'main' },
      { id: 'publications', label: 'Публикации', active: activeTab === 'publications' },
      ...(isOwnProfile ? [{ id: 'subscriptions', label: 'Уровни подписки', active: activeTab === 'subscriptions' }] : []),
      { id: 'about', label: aboutLabel, active: activeTab === 'about' }
    ]
    : isOwnProfile
      ? [
        { id: 'publications', label: 'Понравившиеся', active: activeTab === 'publications' || activeTab === 'main' },
        { id: 'progress', label: 'Прогресс', active: activeTab === 'progress' },
        { id: 'about', label: aboutLabel, active: activeTab === 'about' }
      ]
      : [
        // Тренер смотрит профиль клиента: лайки клиента нерелевантны, показываем прогресс и инфо
        { id: 'progress', label: 'Прогресс', active: activeTab === 'progress' || activeTab === 'publications' || activeTab === 'main' },
        { id: 'about', label: aboutLabel, active: activeTab === 'about' }
      ];

  const sectionTitles: Record<string, string> = {
    main: 'Главная страница профиля',
    publications: isTrainer ? 'Все публикации' : 'Понравившиеся',
    subscriptions: 'Уровни подписки',
    progress: 'История замеров',
    about: aboutLabel
  };

  let currentTab = activeTab;
  if (!isTrainer && (currentTab === 'main' || currentTab === 'publications')) {
    // Свой клиентский профиль открывается на «Понравившихся»; чужой
    // (тренер смотрит клиента) — на «Прогрессе», т.к. вкладки лайков там нет.
    currentTab = isOwnProfile ? 'publications' : 'progress';
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
    canAddPost: canAddPost && isTrainer
  });

  const wrapperHtml = document.createElement('div');
  wrapperHtml.innerHTML = html.trim();
  const element = wrapperHtml.firstElementChild as HTMLElement;
  const tabsElement = element.querySelector('.profile-content__tabs') as HTMLElement | null;
  const sectionTitleEl = element.querySelector('.profile-content__section-title') as HTMLElement;
  const filtersElement = element.querySelector('.profile-content__filters') as HTMLElement | null;
  const addButtonContainer = element.querySelector('#add-post-button-container') as HTMLElement | null;
  const postsPanel = element.querySelector('#posts-panel') as HTMLElement | null;
  const postsContainer = element.querySelector('#posts-container') as HTMLElement;
  const subsContainer = element.querySelector('#subscriptions-container') as HTMLElement | null;
  const progressContainer = element.querySelector('#progress-container') as HTMLElement | null;
  const searchBlock = element.querySelector('.profile-content__search') as HTMLElement | null;
  const searchInput = searchBlock?.querySelector('.profile-content__search-input') as HTMLInputElement | null;
  const sidebarRight = element.querySelector('.profile-content__sidebar-right') as HTMLElement | null;
  const tabTransitionMs = 260;

  type TabPanelKey = 'posts' | 'subscriptions' | 'progress';

  const panelByKey: Record<TabPanelKey, HTMLElement | null> = {
    posts: postsPanel ?? postsContainer,
    subscriptions: subsContainer,
    progress: progressContainer
  };

  const getTabPanelKey = (tabId: string): TabPanelKey => {
    if (tabId === 'progress') return 'progress';
    if (tabId === 'subscriptions') return 'subscriptions';
    return 'posts';
  };

  const prefersReducedMotion = (): boolean => (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );

  let activePanel = panelByKey[getTabPanelKey(currentTab)] ?? postsContainer;
  let panelTransitionToken = 0;

  function clearPanelAnimationClasses(panel: HTMLElement): void {
    panel.classList.remove(
      'profile-content__tab-panel--enter',
      'profile-content__tab-panel--exit',
      'profile-content__tab-panel--active',
      'profile-content__tab-panel--refresh'
    );
  }

  function initializeTabPanels(): void {
    Object.values(panelByKey).forEach(panel => {
      if (!panel) return;
      clearPanelAnimationClasses(panel);
      panel.hidden = panel !== activePanel;
      panel.style.display = '';
    });
    activePanel.hidden = false;
    activePanel.classList.add('profile-content__tab-panel--active');
  }

  function updateTabIndicator(): void {
    if (!tabsElement) return;
    const activeTabElement = tabsElement.querySelector('.profile-content__tab--active') as HTMLElement | null;
    if (!activeTabElement) return;

    tabsElement.style.setProperty('--tab-indicator-left', `${activeTabElement.offsetLeft}px`);
    tabsElement.style.setProperty('--tab-indicator-width', `${activeTabElement.offsetWidth}px`);
    tabsElement.style.setProperty('--tab-indicator-opacity', '1');
  }

  function setActiveTabButton(tabId: string): void {
    element.querySelectorAll('.profile-content__tab').forEach((tabButton: Element) => {
      const button = tabButton as HTMLElement;
      const isActive = button.dataset.tab === tabId;
      button.classList.toggle('profile-content__tab--active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
    window.requestAnimationFrame(updateTabIndicator);
  }

  function showTabPanel(tabId: string, animate = true): boolean {
    const nextPanel = panelByKey[getTabPanelKey(tabId)] ?? postsContainer;
    const previousPanel = activePanel.hidden ? null : activePanel;
    const shouldAnimate = animate && Boolean(previousPanel) && previousPanel !== nextPanel && !prefersReducedMotion();
    panelTransitionToken += 1;
    const token = panelTransitionToken;

    Object.values(panelByKey).forEach(panel => {
      if (!panel || panel === nextPanel) return;
      panel.hidden = true;
      panel.style.display = '';
      clearPanelAnimationClasses(panel);
    });

    if (previousPanel === nextPanel) {
      nextPanel.hidden = false;
      nextPanel.style.display = '';
      clearPanelAnimationClasses(nextPanel);
      nextPanel.classList.add('profile-content__tab-panel--active');
      activePanel = nextPanel;
      return false;
    }

    if (previousPanel) {
      previousPanel.hidden = true;
      previousPanel.style.display = '';
      clearPanelAnimationClasses(previousPanel);
    }

    nextPanel.hidden = false;
    nextPanel.style.display = '';
    clearPanelAnimationClasses(nextPanel);

    if (shouldAnimate) {
      nextPanel.classList.add('profile-content__tab-panel--enter');
      window.requestAnimationFrame(() => {
        if (token !== panelTransitionToken) return;
        nextPanel.classList.remove('profile-content__tab-panel--enter');
        nextPanel.classList.add('profile-content__tab-panel--active');
      });
    } else {
      nextPanel.classList.add('profile-content__tab-panel--active');
    }

    activePanel = nextPanel;
    return true;
  }

  function animateCurrentPanelRefresh(panel: HTMLElement): void {
    if (prefersReducedMotion()) return;
    panel.classList.remove('profile-content__tab-panel--refresh');
    void panel.offsetWidth;
    panel.classList.add('profile-content__tab-panel--refresh');
    window.setTimeout(() => {
      panel.classList.remove('profile-content__tab-panel--refresh');
    }, tabTransitionMs);
  }

  initializeTabPanels();

  if (!isTrainer) {
    if (filtersElement) filtersElement.style.display = 'none';
    if (addButtonContainer) addButtonContainer.style.display = 'none';
    // Популярные публикации — только для тренеров
    if (sidebarRight) sidebarRight.style.display = 'none';
  }

  let allPosts: PostWithAuthor[] = initialPosts || [];
  let searchQuery = '';

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

  // Программное переключение на вкладку «Публикации» (из обзора главной).
  function goToPublications(): void {
    const pubTab = element.querySelector<HTMLElement>('.profile-content__tab[data-tab="publications"]');
    pubTab?.click();
  }

  // Клиентская фильтрация загруженного набора по тексту поиска.
  // Фильтр по видам спорта выполняется на бэкенде (см. applySportFilter).
  function refreshVisiblePosts(): void {
    // Вкладка «Главная страница» тренера — это обзор (главный пост + последние),
    // а не полный список постов: рендерим её отдельно.
    if (currentTab === 'main' && isTrainer) {
      void renderTrainerHome(postsContainer, {
        posts: allPosts,
        api,
        canManagePosts,
        onPostsUpdated: onPostsUpdated ?? undefined,
        tierNameMap,
        tierPriceMap,
        onSeeAll: goToPublications
      });
      return;
    }

    let filteredPosts = allPosts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredPosts = filteredPosts.filter(p => {
        const title = (p.title || '').toLowerCase();
        const text = (p.raw_text || '').toLowerCase();
        const sportName = (p.sport_type || '').toLowerCase();
        return title.includes(query) || text.includes(query) || sportName.includes(query);
      });
    }

    fillProfilePostsSection(postsContainer, {
      activeTab: currentTab,
      posts: filteredPosts,
      api,
      canManagePosts,
      onPostsUpdated: onPostsUpdated ?? undefined,
      tierNameMap,
      tierPriceMap
    });
  }

  // Фильтр по видам спорта у тренера выполняется запросом на бэкенд (searchPosts).
  async function applySportFilter(): Promise<void> {
    showPostsSkeleton(postsContainer);
    try {
      const dataModule = await import('../../../utils/profilePageData');
      if (isTrainer && activeFilters.size > 0) {
        allPosts = await dataModule.searchProfilePosts(api, viewedUserId, {
          sportTypeIds: Array.from(activeFilters).map(Number)
        });
      } else {
        allPosts = (await dataModule.loadProfilePageData(api, viewedUserId)).posts;
      }
    } catch {
      allPosts = [];
    }
    refreshVisiblePosts();
  }

  async function reloadAllPosts(): Promise<void> {
    try {
      const freshData = await import('../../../utils/profilePageData').then(m => m.loadProfilePageData(api, viewedUserId));
      allPosts = freshData.posts;
    } catch {}
    refreshVisiblePosts();
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      refreshVisiblePosts();
    });
  }

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
      // Клики внутри выпадашки не должны всплывать к кнопке фильтра (иначе она закроется),
      // чтобы можно было выбирать пункт кликом по названию, а не только по галочке.
      activeDropdown.addEventListener('click', (ev: Event) => ev.stopPropagation());
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
          checkbox.style.cssText = 'accent-color:var(--primary-orange);width:16px;height:16px;flex-shrink:0;';

          checkbox.addEventListener('click', (event: Event) => {
            event.stopPropagation();
          });

          checkbox.addEventListener('change', () => {
            if (checkbox.checked) activeFilters.add(id);
            else activeFilters.delete(id);
            updateFilterLabel();
            void applySportFilter();
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

    // Слушатель самоудаляется, когда компонент уже выгружен из DOM,
    // иначе они накапливались бы при каждом переходе в профиль.
    const onDocClick = (e: Event): void => {
      if (!document.body.contains(element)) {
        document.removeEventListener('click', onDocClick);
        return;
      }
      if (activeDropdown && !activeDropdown.contains(e.target as Node) && e.target !== filtersElement) {
        activeDropdown.remove();
        activeDropdown = null;
      }
    };
    document.addEventListener('click', onDocClick);
  }

  element.querySelectorAll('.profile-content__tab').forEach((tab: Element) => {
    tab.addEventListener('click', async () => {
      const htmlTab = tab as HTMLElement;
      const tabId = htmlTab.dataset.tab as string;

      if (tabId === currentTab) {
        setActiveTabButton(tabId);
        return;
      }

      setActiveTabButton(tabId);
      const currentPanel = panelByKey[getTabPanelKey(tabId)] ?? postsContainer;
      showTabPanel(tabId);
      currentTab = tabId;

      toggleSearchVisibility(false);
      // Правая колонка (Популярные публикации) — только для тренеров
      toggleSidebarVisibility(isTrainer);

      if (tabId === 'progress') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'История замеров';
        if (progressContainer) {
          progressContainer.innerHTML = '';
          void renderProgressTab(progressContainer, {
            api,
            userId: viewedUserId,
            isOwnProfile
          });
        }
      } else if (tabId === 'about') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = aboutLabel;
        if (isTrainer) {
          void showTrainerAbout(postsContainer, api, viewedUserId);
        } else {
          showAboutSkeleton(postsContainer);
          void api.getProfile(viewedUserId).then(p => showClientAbout(postsContainer, p, isOwnProfile)).catch(() => {
            setPostsContainerMessageState(postsContainer, true);
            postsContainer.innerHTML = '<div class="profile-content__empty"><p>Не удалось загрузить профиль</p></div>';
          });
        }
      } else if (tabId === 'subscriptions') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'Уровни подписки';
        if (subsContainer) {
          void renderSubscriptionsSection(subsContainer, api, isTrainer, isOwnProfile, viewedUserId);
        }
      } else if (tabId === 'publications' && !isTrainer) {
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'Понравившиеся';
        toggleSearchVisibility(true);
        showPostsSkeleton(postsContainer);
        allPosts = (await loadLikedPosts(api, viewedUserId)) as PostWithAuthor[];
        refreshVisiblePosts();
      } else {
        // Поиск и фильтры относятся к полному списку «Публикаций»; на обзорной
        // «Главной странице» они не нужны.
        const isPublications = tabId === 'publications';
        if (filtersElement) {
          filtersElement.style.display = isPublications ? 'flex' : 'none';
        }
        if (addButtonContainer) {
          addButtonContainer.style.display = (canAddPost && isPublications) ? 'block' : 'none';
        }
        sectionTitleEl.textContent = tabId === 'main' ? 'Главная страница профиля' : (sectionTitles[tabId] || 'Публикации');
        toggleSearchVisibility(isPublications);
        if (tabId === 'main' || tabId === 'publications') {
          showPostsSkeleton(postsContainer);
          await reloadAllPosts();
        } else {
          refreshVisiblePosts();
        }
      }

      animateCurrentPanelRefresh(currentPanel);
    });
  });

  if (canAddPost && isTrainer) {
    const btnContainer = element.querySelector('#add-post-button-container') as HTMLElement | null;
    if (btnContainer) {
      // Кнопка создаётся один раз, видимостью управляет переключение вкладок.
      btnContainer.style.display = currentTab === 'publications' ? 'block' : 'none';
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
            onSaved: async () => {
              if (onPostsUpdated) await onPostsUpdated();
              await reloadAllPosts();
            }
          });
        }
      });
    }
  }

  // Добавляем элемент в DOM сразу — данные грузятся асинхронно
  container.appendChild(element);
  window.requestAnimationFrame(updateTabIndicator);

  const onWindowResize = (): void => {
    if (!document.body.contains(element)) {
      window.removeEventListener('resize', onWindowResize);
      return;
    }
    updateTabIndicator();
  };
  window.addEventListener('resize', onWindowResize);

  // Популярные публикации тренера (сортировка по лайкам на бэке)
  if (isTrainer) {
    void loadPopularPosts(element, api, viewedUserId);
  }

  toggleSearchVisibility(false);
  toggleSidebarVisibility(isTrainer);

  if (currentTab === 'progress' && progressContainer) {
    toggleSidebarVisibility(false);
    void renderProgressTab(progressContainer, { api, userId: viewedUserId, isOwnProfile });
  } else if (currentTab === 'about') {
    toggleSidebarVisibility(false);
    if (isTrainer) {
      void showTrainerAbout(postsContainer, api, viewedUserId);
    } else {
      showAboutSkeleton(postsContainer);
      void api.getProfile(viewedUserId).then(p => showClientAbout(postsContainer, p, isOwnProfile)).catch(() => {
        setPostsContainerMessageState(postsContainer, true);
        postsContainer.innerHTML = '<div class="profile-content__empty"><p>Не удалось загрузить профиль</p></div>';
      });
    }
  } else if (currentTab === 'subscriptions') {
    toggleSidebarVisibility(false);
    if (subsContainer) {
      void renderSubscriptionsSection(subsContainer, api, isTrainer, isOwnProfile, viewedUserId);
    }
  } else {
    // На обзорной «Главной странице» тренера поиск/фильтры скрыты — они для
    // полного списка «Публикаций».
    const initialIsPublications = currentTab === 'publications';
    toggleSearchVisibility(initialIsPublications);
    if (filtersElement && isTrainer) {
      filtersElement.style.display = initialIsPublications ? 'flex' : 'none';
    }
    showPostsSkeleton(postsContainer);

    void (async () => {
      if (currentTab === 'publications' && !isTrainer) {
        allPosts = (await loadLikedPosts(api, viewedUserId)) as PostWithAuthor[];
        refreshVisiblePosts();
      } else {
        // Загружаем тиры и посты вместе
        if (isTrainer) {
          try {
            const tiersResp = await api.getTrainerTiers(viewedUserId);
            if (tiersResp?.tiers) {
              tierNameMap = new Map(tiersResp.tiers.map(t => [t.tier_id, t.name]));
              tierPriceMap = new Map(tiersResp.tiers.map(t => [t.tier_id, t.price]));
            }
          } catch {}
        }
        await reloadAllPosts();
      }
    })();
  }

  return element;
}
