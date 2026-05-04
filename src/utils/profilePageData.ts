// src/utils/profilePageData.ts

import type { ApiClient } from './api';
import type { Profile, Post, PostListItem, AuthResponse, User} from '../types/api.types';
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
  if (!textContent) {
    return 'Нет доступа к содержимому поста';
  }
  return escapeHtml(textContent).replace(/\n/g, '<br>');
}

interface MapProfileDataResult {
  profile: {
    name: string;
    role: string;
    avatar: string | null;
    isOwnProfile: boolean;
    isTrainer: boolean;
  };
  currentUser: {
    id: number;
    name: string;
    role: string;
    avatar: string | null;
  } | null;
}

export function mapProfileData(
  apiData: Profile,
  currentUser: AuthResponse | null
): MapProfileDataResult {
  const isOwnProfile = apiData.is_me;
  const fullName = getFullName(apiData);
  const currentUserData: User | null = currentUser?.user || null;

  let currentUserAvatar: string | null = null;
  if (isOwnProfile) {
    currentUserAvatar = apiData.avatar_url;
  } else if (currentUserData) {
    currentUserAvatar = currentUserData.avatar_url || null;
  }

  return {
    profile: {
      name: fullName,
      role: getUserRoleLabel(apiData.is_trainer),
      avatar: apiData.avatar_url,
      isOwnProfile,
      isTrainer: Boolean(apiData.is_trainer)
    },
    currentUser: currentUserData ? {
      id: currentUserData.user_id,
      name: getFullName(currentUserData),
      role: getUserRoleLabel(currentUserData.is_trainer),
      avatar: currentUserAvatar
    } : null
  };
}

export async function loadProfilePageData(
  api: ApiClient,
  userId: number,
  currentUser: AuthResponse | null = null
): Promise<ProfilePageData> {
  const resolvedUserId = userId || currentUser?.user?.user_id;

  if (!resolvedUserId) {
    throw new Error('Пользователь не авторизован');
  }

  // Загружаем профиль, посты и виды спорта параллельно
  const [profileData, postsData, sportTypesData] = await Promise.all([
    api.getProfile(resolvedUserId),
    api.getUserPosts(resolvedUserId).catch(() => ({ posts: [] as PostListItem[], user_id: resolvedUserId })),
    api.getSportTypes().catch(() => ({ sport_types: [] }))
  ]);

  // Мапа для sport_type_id -> название
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

    // Собираем contentBlocks с сохранением порядка из blocks
    const contentBlocks: ContentBlockForPost[] = [];
    if (fullPost?.blocks) {
      for (const block of fullPost.blocks) {
        if (block.text_content) {
          contentBlocks.push({
            type: 'text',
            content: block.text_content
          });
        }
        if (block.file_url) {
          contentBlocks.push({
            type: 'attachment',
            file_url: block.file_url,
            kind: block.kind || 'image'
          });
        }
      }
    }

    // Преобразуем sport_type_id в название
    const sportTypeName = post.sport_type_id
      ? sportNamesById.get(post.sport_type_id) || ''
      : '';

    // Текстовый контент для краткого превью
    const allText = contentBlocks
      .filter(b => b.type === 'text')
      .map(b => b.content)
      .join('\n');

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
      contentBlocks: contentBlocks,
      attachments: []
    };
  }));

  const mappedData = mapProfileData(profileData, currentUser);

  return {
    ...mappedData,
    posts,
    subscriptions: [],
    popularPosts: [],
    viewedUserId: resolvedUserId
  };
}
