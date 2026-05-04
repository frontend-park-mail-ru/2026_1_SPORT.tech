// src/utils/profilePageData.ts

import type { ApiClient } from './api';
import type { Post, PostListItem, AuthResponse, User, Tier } from '../types/api.types';
import type { PostWithAuthor, ProfilePageData, ContentBlockForPost } from '../types/post.types';

export function getUserRoleLabel(isTrainer: boolean): string {
  return isTrainer ? 'Тренер' : 'Клиент';
}

export function getFullName(profile: { first_name?: string; last_name?: string; username?: string } = {}): string {
  const first = profile.first_name || '';
  const last = profile.last_name || '';
  return `${first} ${last}`.trim() || profile.username || 'Пользователь';
}

export function escapeHtml(value: string = ''): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPostContent(textContent: string): string {
  if (!textContent) return 'Нет доступа к содержимому поста';
  return escapeHtml(textContent).replace(/\n/g, '<br>');
}

export async function loadProfilePageData(
  api: ApiClient,
  userId: number,
  currentUser: AuthResponse | null = null
): Promise<ProfilePageData> {
  const resolvedUserId = userId || currentUser?.user?.user_id;
  if (!resolvedUserId) throw new Error('Пользователь не авторизован');

  // Загружаем профиль, посты, виды спорта
  const [profileData, postsData, sportTypesData] = await Promise.all([
    api.getProfile(resolvedUserId),
    api.getUserPosts(resolvedUserId).catch(() => ({ posts: [] as PostListItem[], user_id: resolvedUserId })),
    api.getSportTypes().catch(() => ({ sport_types: [] }))
  ]);

  // Загружаем уровни подписки, если просматриваем тренера
  let tierNameById = new Map<number, string>();
  let tierPriceById = new Map<number, number>();
  if (profileData.is_trainer) {
    try {
      const tiersResp = await api.getTrainerTiers(resolvedUserId);
      if (tiersResp?.tiers) {
        tiersResp.tiers.forEach((tier: Tier) => {
          tierNameById.set(tier.tier_id, tier.name);
          tierPriceById.set(tier.tier_id, tier.price);
        });
      }
    } catch {
      // игнорируем ошибку – уровни могут отсутствовать
    }
  }

  const sportNamesById = new Map<number, string>(
    (sportTypesData?.sport_types || []).map(s => [s.sport_type_id, s.name])
  );

  const authorName = getFullName(profileData);
  const authorRole = getUserRoleLabel(profileData.is_trainer);
  const authorAvatar = profileData.avatar_url || null;
  const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];

  const posts: PostWithAuthor[] = await Promise.all(postList.map(async (post: PostListItem): Promise<PostWithAuthor> => {
    let fullPost: Post | null = null;
    if (post.can_view) {
      try {
        fullPost = await api.getPost(post.post_id);
      } catch {
        // отдельный пост может быть недоступен
      }
    }

    const contentBlocks: ContentBlockForPost[] = [];
    if (fullPost?.blocks) {
      for (const block of fullPost.blocks) {
        if (block.text_content) {
          contentBlocks.push({ type: 'text', content: block.text_content });
        }
        if (block.file_url) {
          contentBlocks.push({ type: 'attachment', file_url: block.file_url, kind: block.kind || 'image' });
        }
      }
    }

    const sportTypeName = post.sport_type_id ? sportNamesById.get(post.sport_type_id) || '' : '';
    const allText = contentBlocks.filter(b => b.type === 'text').map(b => b.content).join('\n');

    // Определяем название и цену уровня подписки
    let tierName: string | undefined = undefined;
    let tierPrice: number | undefined = undefined;
    if (post.min_tier_id) {
      tierName = tierNameById.get(post.min_tier_id);
      tierPrice = tierPriceById.get(post.min_tier_id);
      // Если цена не определена (нет в мапе), ставим 0 (бесплатно)
      if (tierPrice === undefined) tierPrice = 0;
    }

    return {
      post_id: post.post_id,
      title: post.title,
      content: post.can_view ? formatPostContent(allText) : 'Нет доступа к содержимому поста',
      raw_text: allText,
      authorName,
      authorRole,
      authorAvatar,
      likes: post.likes_count,
      liked: post.is_liked,
      comments: post.comments_count ?? 0,
      can_view: post.can_view,
      created_at: post.created_at,
      min_tier_id: post.min_tier_id ?? null,
      sport_type_id: post.sport_type_id ?? null,
      sport_type: sportTypeName,
      tier_name: tierName,
      tier_price: tierPrice,
      contentBlocks,
      attachments: []
    };
  }));

  const isOwnProfile = profileData.is_me;
  const fullProfileName = getFullName(profileData);
  const currentUserData: User | null = currentUser?.user || null;

  let currentUserAvatar: string | null = null;
  if (isOwnProfile) {
    currentUserAvatar = profileData.avatar_url;
  } else if (currentUserData) {
    currentUserAvatar = currentUserData.avatar_url || null;
  }

  const profile = {
    name: fullProfileName,
    role: getUserRoleLabel(profileData.is_trainer),
    avatar: profileData.avatar_url,
    isOwnProfile,
    isTrainer: Boolean(profileData.is_trainer)
  };

  const currentUserMapped = currentUserData
    ? {
      id: currentUserData.user_id,
      name: getFullName(currentUserData),
      role: getUserRoleLabel(currentUserData.is_trainer),
      avatar: currentUserAvatar
    }
    : null;

  return {
    profile,
    currentUser: currentUserMapped,
    posts,
    subscriptions: [],
    popularPosts: [],
    viewedUserId: resolvedUserId
  };
}
