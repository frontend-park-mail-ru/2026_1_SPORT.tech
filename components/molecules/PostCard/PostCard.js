/**
 * @fileoverview Компонент карточки публикации
 * Отображает пост в ленте или на странице профиля
 *
 * @module components/molecules/PostCard
 */

import { mapPostEngagement } from '/src/utils/postEngagement.js';
import { openPostFormModal } from '../PostFormModal/PostFormModal.js';

/**
 * Рендерит карточку публикации
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} post - Данные поста
 * @param {number} post.post_id - ID поста
 * @param {string} post.title - Заголовок
 * @param {string} post.content - HTML-содержимое поста
 * @param {string} post.authorName - Имя автора
 * @param {string} post.authorRole - Роль автора
 * @param {number} [post.likes=0] - Количество лайков
 * @param {boolean} [post.liked=false] - Лайкнуто текущим пользователем
 * @param {number} [post.comments=0] - Комментарии
 * @param {boolean} [post.can_view=true] - Доступ к содержимому
 * @param {string} [post.raw_text=''] - Сырой текст для редактора
 * @param {boolean} [post.isOwner=false] - Можно ли редактировать/удалять
 * @param {import('/src/utils/api.js').ApiClient} post.api - API
 * @param {Function} [post.onPostsUpdated] - После изменений списка постов
 * @returns {Promise<HTMLElement>} DOM элемент карточки
 */
export async function renderPostCard(container, post) {
  const {
    post_id: postId,
    title,
    content,
    authorName,
    authorRole,
    likes = 0,
    liked = false,
    comments = 0,
    can_view: canView = true,
    raw_text: rawText = '',
    isOwner = false,
    api,
    onPostsUpdated
  } = post;

  const template = Handlebars.templates['PostCard.hbs'];

  const initials = authorName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const html = template({
    post_id: postId,
    title,
    content,
    authorName,
    authorRole,
    authorInitials: initials,
    likes,
    liked,
    comments,
    can_view: canView,
    isOwner
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;

  const likeBtn = element.querySelector('[data-post-like]');
  const likeCountEl = element.querySelector('[data-post-like-count]');
  const editBtn = element.querySelector('[data-post-edit]');
  const deleteBtn = element.querySelector('[data-post-delete]');
  const shareBtn = element.querySelector('[data-post-share]');

  /**
   * Обновляет UI лайка
   * @param {boolean} nextLiked
   * @param {number} nextCount
   */
  const setLikeUi = (nextLiked, nextCount) => {
    if (!likeBtn || !likeCountEl) return;
    likeBtn.classList.toggle('post-card__action--liked', nextLiked);
    likeBtn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
    likeCountEl.textContent = String(nextCount);
    const svg = likeBtn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', nextLiked ? 'currentColor' : 'none');
    }
  };

  if (likeBtn && api && canView) {
  likeBtn.addEventListener('click', async () => {
    if (likeBtn.disabled) return;
    const wasLiked = likeBtn.classList.contains('post-card__action--liked');
    likeBtn.disabled = true;
    try {
      let response;
      if (wasLiked) {
        response = await api.unlikePost(postId);
      } else {
        response = await api.likePost(postId);
      }
      // Ответ должен быть { post_id, likes_count, is_liked }
      setLikeUi(response.is_liked, response.likes_count);
    } catch (error) {
      console.error('Не удалось обновить лайк:', error);
    } finally {
      likeBtn.disabled = false;
    }
  });
}

  if (editBtn && api && isOwner) {
    editBtn.addEventListener('click', async () => {
      await openPostFormModal({
        api,
        mode: 'edit',
        postId,
        initial: { title, text_content: rawText },
        onSaved: onPostsUpdated
      });
    });
  }

  if (deleteBtn && api && isOwner) {
    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      try {
        await api.deletePost(postId);
        onPostsUpdated?.();
      } catch (error) {

      } finally {
        deleteBtn.disabled = false;
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title,
        text: rawText || title,
        url: window.location.href
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(window.location.href);
        }
      } catch {
        // пользователь отменил share
      }
    });
  }

  container.appendChild(element);
  return element;
}
