/**
 * @fileoverview Загрузка и маппинг данных страницы профиля (посты, шапка)
 * @module src/utils/profilePageData
 */

import { mapPostEngagement } from './postEngagement.js';

/**
 * Получить текстовую метку роли пользователя
 * @param {boolean} isTrainer - Является ли пользователь тренером
 * @returns {string}
 */
export function getUserRoleLabel(isTrainer) {
  return isTrainer ? 'Тренер' : 'Клиент';
}

/**
 * Получить полное имя из профиля
 * @param {Object} profile
 * @returns {string}
 */
export function getFullName(profile = {}) {
  const first = profile.first_name || '';
  const last = profile.last_name || '';
  return `${first} ${last}`.trim() || profile.username || 'Пользователь';
}

/**
 * Экранирует HTML-спецсимволы
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

/**
 * Форматирует содержимое поста для отображения
 * @param {string} textContent
 * @returns {string}
 */
export function formatPostContent(textContent) {
  if (!textContent) {
    return 'Нет доступа к содержимому поста';
  }
  return escapeHtml(textContent).replace(/\n/g, '<br>');
}

/**
 * Преобразует данные из API в формат для компонентов
 * @param {Object} apiData
 * @param {Object|null} currentUser
 * @returns {Object}
 */
export function mapProfileData(apiData, currentUser) {
  const isOwnProfile = apiData.is_me;
  const fullName = getFullName(apiData);

  return {
    profile: {
      name: fullName,
      role: getUserRoleLabel(apiData.is_trainer),
      avatar: apiData.avatar_url,                // ← поле напрямую
      isOwnProfile,
      isTrainer: Boolean(apiData.is_trainer)
    },
    currentUser: currentUser?.user ? {
      id: currentUser.user.user_id,
      name: getFullName(currentUser.user),
      role: getUserRoleLabel(currentUser.user.is_trainer),
      avatar: currentUser.user.avatar_url
    } : null
  };
}

/**
 * Загружает данные для страницы профиля
 * @async
 * @param {import('./api.js').ApiClient} api
 * @param {number} userId
 * @param {Object|null} [currentUser=null]
 * @returns {Promise<Object>}
 */


export async function loadProfilePageData(api, userId, currentUser = null) {
  const resolvedUserId = userId || currentUser?.user?.user_id;

  if (!resolvedUserId) {
    throw new Error('Пользователь не авторизован');
  }

  const [profileData, postsData] = await Promise.all([
    api.getProfile(resolvedUserId),
    api.getUserPosts(resolvedUserId).catch(() => ({ posts: [] }))
  ]);

  const authorName = getFullName(profileData);
  const authorRole = getUserRoleLabel(profileData.is_trainer);
  const authorAvatar = profileData.avatar_url || null;  // ← добавить
  const postList = Array.isArray(postsData?.posts) ? postsData.posts : [];

  const posts = await Promise.all(postList.map(async post => {
    let fullPost = null;
    if (post.can_view) {
      try {
        fullPost = await api.getPost(post.post_id);
      } catch {
        // отдельный пост может быть недоступен
      }
    }
    const textContent = fullPost?.text_content || '';
    const engagement = mapPostEngagement(fullPost);

    return {
      post_id: post.post_id,
      title: post.title,
      content: post.can_view ? formatPostContent(textContent) : 'Нет доступа к содержимому поста',
      raw_text: textContent,
      authorName,
      authorRole,
      authorAvatar,  // ← добавить
      likes: engagement.likes,
      liked: engagement.liked,
      comments: engagement.comments,
      can_view: post.can_view,
      created_at: post.created_at,
      min_tier_id: post.min_tier_id ?? null,
      attachments: fullPost?.attachments || []
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
