// src/utils/profilePageData.ts

import type { ApiClient } from './api';
import type { Profile, Post, PostListItem, AuthResponse, User, PostBlock } from '../types/api.types';
import type { PostWithAuthor, ProfilePageData } from '../types/post.types';

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

function extractTextFromBlocks(blocks: PostBlock[] | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return '';
  return blocks
    .filter(block => block.text_content)
    .map(block => block.text_content)
    .join('\n');
}

function extractAttachmentsFromBlocks(blocks: PostBlock[] | undefined): Array<{ post_attachment_id: number; kind: string; file_url: string }> {
  if (!blocks || !Array.isArray(blocks)) return [];
  return blocks
    .filter(block => block.file_url)
    .map(block => ({
      post_attachment_id: block.post_block_id,
      kind: block.kind || 'image',
      file_url: block.file_url
    }));
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

  const [profileData, postsData] = await Promise.all([
    api.getProfile(resolvedUserId),
    api.getUserPosts(resolvedUserId).catch(() => ({ posts: [] as PostListItem[], user_id: resolvedUserId }))
  ]);

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

    const textContent = extractTextFromBlocks(fullPost?.blocks);
    const attachments = extractAttachmentsFromBlocks(fullPost?.blocks);

    return {
      post_id: post.post_id,
      title: post.title,
      content: post.can_view ? formatPostContent(textContent) : 'Нет доступа к содержимому поста',
      raw_text: textContent,
      authorName,
      authorRole,
      authorAvatar,
      likes: post.likes_count,
      liked: post.is_liked,
      comments: post.comments_count ?? 0,
      can_view: post.can_view,
      created_at: post.created_at,
      min_tier_id: post.min_tier_id ?? null,
      attachments: attachments
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
