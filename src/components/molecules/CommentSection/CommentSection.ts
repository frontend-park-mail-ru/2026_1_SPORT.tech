import type { ApiClient } from '../../../utils/api';
import type { Comment } from '../../../types/api.types';

interface CommentSectionParams {
  postId: number;
  api: ApiClient;
  onCommentsChanged?: (newTotal: number) => void;
}

export async function renderCommentSection(
  container: HTMLElement,
  params: CommentSectionParams
): Promise<void> {
  const { postId, api, onCommentsChanged } = params;
  const template = (window as any).Handlebars.templates['CommentSection.hbs'];

  // Загружаем комментарии
  let comments: Comment[] = [];
  try {
    const response = await api.getPostComments(postId);
    comments = response.comments;
  } catch {
    // ошибка загрузки
  }

  const html = template({ comments, postId });
  container.innerHTML = html;

  const form = container.querySelector('[data-comment-form]') as HTMLFormElement;
  const input = container.querySelector('.comment-section__input') as HTMLInputElement;
  const list = container.querySelector('.comment-section__list') as HTMLElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    try {
      const newComment = await api.createComment(postId, text);
      // Временно добавляем комментарий в локальный список и обновляем UI
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-section__item';
      commentEl.innerHTML = `
        <img class="comment-section__avatar" src="${newComment.author_avatar_url || ''}" alt="" onerror="this.style.display='none'">
        <div class="comment-section__body">
          <div class="comment-section__author">${newComment.author_username}</div>
          <div class="comment-section__text">${newComment.text}</div>
          <div class="comment-section__time">${new Date(newComment.created_at).toLocaleString()}</div>
        </div>
      `;
      list.appendChild(commentEl);
      input.value = '';
      onCommentsChanged?.(comments.length + 1);
    } catch {
      // показать ошибку
    }
  });
}
