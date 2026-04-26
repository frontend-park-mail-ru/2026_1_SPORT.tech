/**
 * @fileoverview Нормализация счётчиков лайков/комментариев из ответа API поста
 * @module src/utils/postEngagement
 */

/**
 * Извлекает счётчики и признак «лайкнуто мной» из объекта поста (разные имена полей на бэкенде)
 * @param {Object|null|undefined} fullPost - Тело ответа GET /posts/:id или вложенный объект
 * @returns {{ likes: number, liked: boolean, comments: number }}
 */
export function mapPostEngagement(fullPost) {
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
