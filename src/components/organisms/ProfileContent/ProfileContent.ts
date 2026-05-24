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
        onPostsUpdated: onPostsUpdated ?? undefined
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
  container.innerHTML = `
    <div style="padding:4px 0;">
      <div class="page-skeleton__block" style="height:16px;width:40%;margin-bottom:20px;border-radius:6px;"></div>
      <div class="page-skeleton__block" style="height:48px;margin-bottom:14px;border-radius:8px;"></div>
      <div class="page-skeleton__block" style="height:48px;margin-bottom:14px;border-radius:8px;"></div>
      <div class="page-skeleton__block" style="height:48px;margin-bottom:14px;border-radius:8px;"></div>
      <div class="page-skeleton__block" style="height:80px;border-radius:8px;"></div>
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

        const textContent = extractTextFromBlocks(fullPost?.blocks);
        const attachments = extractAttachmentsFromBlocks(fullPost?.blocks);

        fullPosts.push({
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

async function renderStatsPanel(container: HTMLElement, api: ApiClient): Promise<void> {
  container.innerHTML = `
    <div class="profile-stats">
      <div class="page-skeleton__block" style="height:80px;border-radius:12px;flex:1;margin-bottom:0;"></div>
      <div class="page-skeleton__block" style="height:80px;border-radius:12px;flex:1;margin-bottom:0;"></div>
      <div class="page-skeleton__block" style="height:80px;border-radius:12px;flex:1;margin-bottom:0;"></div>
      <div class="page-skeleton__block" style="height:80px;border-radius:12px;flex:1;margin-bottom:0;"></div>
    </div>
  `;
  try {
    const [stats, balance] = await Promise.all([
      api.getMyStatistics(),
      api.getMyBalance().catch(() => null)
    ]);
    const currency = balance?.currency || stats.currency || 'RUB';
    const fmt = (n: number): string => n.toLocaleString('ru-RU');
    container.innerHTML = `
      <div class="profile-stats">
        <div class="profile-stats__item">
          <div class="profile-stats__value">${stats.posts_count}</div>
          <div class="profile-stats__label">Публикаций</div>
        </div>
        <div class="profile-stats__item">
          <div class="profile-stats__value">${fmt(stats.monthly_revenue)} ${currency}</div>
          <div class="profile-stats__label">Доход в месяц</div>
        </div>
        <div class="profile-stats__item">
          <div class="profile-stats__value">${fmt(stats.total_revenue)} ${currency}</div>
          <div class="profile-stats__label">Всего доходов</div>
        </div>
        <div class="profile-stats__item">
          <div class="profile-stats__value">${stats.donations_count}</div>
          <div class="profile-stats__label">Донатов</div>
        </div>
      </div>
    `;
  } catch (err: unknown) {
    console.error('[ProfileContent] failed to load stats:', err);
    container.innerHTML = `
      <div class="profile-stats profile-stats--error">
        <span style="color:#999;font-size:13px;">Статистика недоступна</span>
      </div>
    `;
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
      <h3 style="margin-bottom:16px;">Уровни подписки</h3>
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
              <span style="color:#E85A2B;font-weight:700;font-size:16px;">${formatMonthlyPrice(tier.price)}</span>
            </div>
            ${tier.description ? `<p style="color:#666;font-size:13px;margin:0;">${escapeHtml(tier.description)}</p>` : ''}
          `;
          tiersList.appendChild(card);
        });
      } catch {
        tiersList.innerHTML = '<p style="color:#999;">Не удалось загрузить уровни подписки</p>';
      }
    };

    button.addEventListener('click', () => openTiersModal({ api, onSaved: () => { void loadOwnTiers(); } }));
    void loadOwnTiers();
  } else if (!isOwnProfile && isTrainer) {
    wrapper.innerHTML = '<h3 style="margin-bottom:16px;">Уровни подписки</h3>';
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
              <span style="color:#E85A2B;font-weight:700;font-size:16px;">${formatMonthlyPrice(tier.price)}</span>
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
          const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
            : `<div style="width:36px;height:36px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#888;flex-shrink:0;">${trainerName.charAt(0).toUpperCase()}</div>`;

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
              <span style="color:#E85A2B;font-weight:700;font-size:15px;flex-shrink:0;">${formatMonthlyPrice(sub.price)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #f0f0f0;">
              <div>
                <div style="font-size:13px;color:#555;font-weight:500;">${escapeHtml(sub.tier_name)}</div>
                <div style="font-size:12px;color:#999;margin-top:2px;">Истекает: ${expiresDate}</div>
              </div>
              <span style="font-size:12px;color:#E85A2B;font-weight:600;">Перейти →</span>
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

  // «О себе» — для самого пользователя (свой профиль); «О тренере» — когда профиль тренера смотрит кто-то другой.
  const aboutLabel = isOwnProfile ? 'О себе' : (isTrainer ? 'О тренере' : 'О себе');

  const tabs = isTrainer
    ? [
      { id: 'main', label: 'Главная страница', active: activeTab === 'main' },
      { id: 'publications', label: 'Публикации', active: activeTab === 'publications' },
      ...(isOwnProfile ? [{ id: 'subscriptions', label: 'Уровни подписки', active: activeTab === 'subscriptions' }] : []),
      { id: 'about', label: aboutLabel, active: activeTab === 'about' }
    ]
    : [
      { id: 'publications', label: 'Понравившиеся', active: activeTab === 'publications' || activeTab === 'main' },
      { id: 'progress', label: 'Прогресс', active: activeTab === 'progress' },
      { id: 'about', label: aboutLabel, active: activeTab === 'about' }
    ];

  const sectionTitles: Record<string, string> = {
    main: 'Недавние публикации',
    publications: isTrainer ? 'Все публикации' : 'Понравившиеся',
    subscriptions: 'Уровни подписки',
    progress: 'История замеров',
    about: aboutLabel
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

  const wrapperHtml = document.createElement('div');
  wrapperHtml.innerHTML = html.trim();
  const element = wrapperHtml.firstElementChild as HTMLElement;
  const sectionTitleEl = element.querySelector('.profile-content__section-title') as HTMLElement;
  const filtersElement = element.querySelector('.profile-content__filters') as HTMLElement | null;
  const addButtonContainer = element.querySelector('#add-post-button-container') as HTMLElement | null;
  const postsContainer = element.querySelector('#posts-container') as HTMLElement;
  const subsContainer = element.querySelector('#subscriptions-container') as HTMLElement | null;
  const progressContainer = element.querySelector('#progress-container') as HTMLElement | null;
  const searchBlock = element.querySelector('.profile-content__search') as HTMLElement | null;
  const searchInput = searchBlock?.querySelector('.profile-content__search-input') as HTMLInputElement | null;
  const sidebarRight = element.querySelector('.profile-content__sidebar-right') as HTMLElement | null;

  if (!isTrainer) {
    if (filtersElement) filtersElement.style.display = 'none';
    if (addButtonContainer) addButtonContainer.style.display = 'none';
    // Популярные публикации — только для тренеров
    if (sidebarRight) sidebarRight.style.display = 'none';
  }

  // Панель статистики — только для собственного профиля тренера
  let statsContainer: HTMLElement | null = null;
  if (isOwnProfile && isTrainer) {
    statsContainer = document.createElement('div');
    statsContainer.className = 'profile-stats-container';
    statsContainer.style.display = 'none';
    postsContainer.insertAdjacentElement('beforebegin', statsContainer);
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

  // Клиентская фильтрация загруженного набора по тексту поиска.
  // Фильтр по видам спорта выполняется на бэкенде (см. applySportFilter).
  function refreshVisiblePosts(): void {
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
          checkbox.style.cssText = 'accent-color:#E85A2B;width:16px;height:16px;flex-shrink:0;';

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
      if (progressContainer) progressContainer.style.display = 'none';

      toggleSearchVisibility(false);
      // Правая колонка (Популярные публикации) — только для тренеров
      toggleSidebarVisibility(isTrainer);

      if (tabId === 'progress') {
        toggleSidebarVisibility(false);
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'История замеров';
        if (progressContainer) {
          progressContainer.style.display = 'block';
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
        if (postsContainer) postsContainer.style.display = 'block';
        if (isTrainer) {
          void showTrainerAbout(postsContainer, api, viewedUserId);
        } else {
          void api.getProfile(viewedUserId).then(p => showClientAbout(postsContainer, p)).catch(() => {
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
          subsContainer.style.display = 'block';
          void renderSubscriptionsSection(subsContainer, api, isTrainer, isOwnProfile, viewedUserId);
        }
      } else if (tabId === 'publications' && !isTrainer) {
        if (filtersElement) filtersElement.style.display = 'none';
        if (addButtonContainer) addButtonContainer.style.display = 'none';
        sectionTitleEl.textContent = 'Понравившиеся';
        if (postsContainer) postsContainer.style.display = 'block';
        toggleSearchVisibility(true);
        showPostsSkeleton(postsContainer);
        allPosts = (await loadLikedPosts(api, viewedUserId)) as PostWithAuthor[];
        refreshVisiblePosts();
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
        if (tabId === 'main' || tabId === 'publications') {
          if (statsContainer) {
            statsContainer.style.display = tabId === 'main' ? 'block' : 'none';
            if (tabId === 'main') void renderStatsPanel(statsContainer, api);
          }
          showPostsSkeleton(postsContainer);
          await reloadAllPosts();
        } else {
          if (statsContainer) statsContainer.style.display = 'none';
          refreshVisiblePosts();
        }
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

  // Популярные публикации тренера (сортировка по лайкам на бэке)
  if (isTrainer) {
    void loadPopularPosts(element, api, viewedUserId);
  }

  if (currentTab === 'progress' && progressContainer) {
    toggleSidebarVisibility(false);
    progressContainer.style.display = 'block';
    void renderProgressTab(progressContainer, { api, userId: viewedUserId, isOwnProfile });
  } else if (currentTab === 'about') {
    toggleSidebarVisibility(false);
    if (postsContainer) postsContainer.style.display = 'block';
    if (isTrainer) {
      void showTrainerAbout(postsContainer, api, viewedUserId);
    } else {
      void api.getProfile(viewedUserId).then(p => showClientAbout(postsContainer, p)).catch(() => {
        setPostsContainerMessageState(postsContainer, true);
        postsContainer.innerHTML = '<div class="profile-content__empty"><p>Не удалось загрузить профиль</p></div>';
      });
    }
  } else if (currentTab === 'subscriptions') {
    toggleSidebarVisibility(false);
    if (subsContainer) {
      subsContainer.style.display = 'block';
      void renderSubscriptionsSection(subsContainer, api, isTrainer, isOwnProfile, viewedUserId);
    }
  } else {
    if (postsContainer) postsContainer.style.display = 'block';
    toggleSearchVisibility(true);
    showPostsSkeleton(postsContainer);

    // Показываем статистику на главной вкладке собственного профиля тренера
    if (statsContainer) {
      if (currentTab === 'main') {
        statsContainer.style.display = 'block';
        void renderStatsPanel(statsContainer, api);
      } else {
        statsContainer.style.display = 'none';
      }
    }

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
