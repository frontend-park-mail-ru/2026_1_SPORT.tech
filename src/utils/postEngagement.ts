/**
 * @fileoverview Нормализация счётчиков лайков/комментариев из ответа API поста
 * @module src/utils/postEngagement
 */

import type { PostEngagement } from '../types/post.types';

interface RawPostData {
  likes_count?: number;
  like_count?: number;
  likes?: number;
  comments_count?: number;
  comments?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  is_liked?: boolean;
  liked?: boolean;
  user_liked?: boolean;
  [key: string]: unknown;
}

/**
 * Извлекает счётчики и признак «лайкнуто мной» из объекта поста
 */
export function mapPostEngagement(fullPost: RawPostData | null | undefined): PostEngagement {
  if (!fullPost || typeof fullPost !== 'object') {
    return { likes: 0, liked: false, comments: 0 };
  }

  const likesRaw = fullPost.likes_count ?? fullPost.like_count ?? fullPost.likes ?? 0;
  const commentsRaw = fullPost.comments_count ?? fullPost.comments ?? fullPost.comment_count ?? 0;

  const likes = Number(likesRaw);
  const comments = Number(commentsRaw);

  const liked = Boolean(
    fullPost.liked_by_me ??
      fullPost.is_liked ??
      fullPost.liked ??
      fullPost.user_liked
  );

  return {
    likes: Number.isFinite(likes) ? likes : 0,
    liked,
    comments: Number.isFinite(comments) ? comments : 0
  };
}
