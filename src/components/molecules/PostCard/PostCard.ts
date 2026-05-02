/**
 * @fileoverview Компонент карточки публикации
 * @module components/molecules/PostCard
 */

import type { ApiClient } from '../../../utils/api';
import { openPostFormModal } from '../PostFormModal/PostFormModal';

export interface PostCardData {
  post_id: number;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  likes?: number;
  liked?: boolean;
  comments?: number;
  can_view?: boolean;
  raw_text?: string;
  isOwner?: boolean;
  api: ApiClient;
  onPostsUpdated?: (() => Promise<void>) | null;
  attachments?: Array<{ file_url: string; kind: string; post_attachment_id?: number }>;
  min_tier_id?: number | null;
  sport_type?: string;
}

interface ContentBlock {
  type: 'text' | 'attachment';
  content?: string;
  file_url?: string;
  kind?: string;
}

export async function renderPostCard(
  container: HTMLElement,
  post: PostCardData
): Promise<HTMLElement> {
  const {
    post_id: postId,
    title,
    content,
    authorName,
    authorRole,
    authorAvatar,
    likes = 0,
    liked = false,
    comments = 0,
    can_view: canView = true,
    raw_text: rawText = '',
    isOwner = false,
    api,
    onPostsUpdated,
    attachments = [],
    min_tier_id: minTierId = null,
    sport_type: sportType = ''
  } = post;

  // Собираем contentBlocks из raw_text и attachments
  const contentBlocks: ContentBlock[] = [];

  // Разбиваем raw_text на абзацы и создаём текстовые блоки
  if (rawText && rawText.trim()) {
    const paragraphs = rawText.split('\n').filter(p => p.trim());
    paragraphs.forEach(paragraph => {
      contentBlocks.push({
        type: 'text',
        content: paragraph
      });
    });
  }

  // Добавляем медиа-блоки
  attachments.forEach(att => {
    contentBlocks.push({
      type: 'attachment',
      file_url: att.file_url,
      kind: att.kind || 'image'
    });
  });

  // Если нет ни текста, ни вложений — показываем content как текст
  if (contentBlocks.length === 0 && content) {
    contentBlocks.push({
      type: 'text',
      content: content
    });
  }

  const template = (window as any).Handlebars.templates['PostCard.hbs'];
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Для краткого превью берём только первый текстовый блок (обрезанный)
  const firstTextBlock = contentBlocks.find(b => b.type === 'text');
  const shortTextContent = firstTextBlock?.content
    ? (firstTextBlock.content.length > 200 ? firstTextBlock.content.substring(0, 200) + '...' : firstTextBlock.content)
    : (content.length > 200 ? content.substring(0, 200) + '...' : content);

  const html = template({
    post_id: postId,
    title,
    content: shortTextContent,
    fullContent: content,
    authorName,
    authorRole,
    authorAvatar,
    authorInitials: initials,
    likes,
    liked,
    comments,
    can_view: canView,
    isOwner,
    contentBlocks,  // ← Главное: передаём массив блоков
    minTierId,
    sportType
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const postCard = wrapper.firstElementChild as HTMLElement;

  const likeBtn = postCard.querySelector('[data-post-like]') as HTMLButtonElement | null;
  const likeCountEl = postCard.querySelector('[data-post-like-count]') as HTMLElement | null;
  const editBtn = postCard.querySelector('[data-post-edit]') as HTMLButtonElement | null;
  const deleteBtn = postCard.querySelector('[data-post-delete]') as HTMLButtonElement | null;
  const shareBtn = postCard.querySelector('[data-post-share]') as HTMLButtonElement | null;
  const collapseBtn = postCard.querySelector('[data-post-collapse]') as HTMLButtonElement | null;
  const shortBody = postCard.querySelector('.post-card__body--short') as HTMLElement | null;
  const fullBody = postCard.querySelector('.post-card__body--full') as HTMLElement | null;

  // Клик по карточке разворачивает пост
  postCard.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-post-like]') ||
        target.closest('[data-post-edit]') ||
        target.closest('[data-post-delete]') ||
        target.closest('[data-post-share]') ||
        target.closest('[data-post-collapse]')) {
      return;
    }

    if (shortBody && fullBody) {
      shortBody.style.display = 'none';
      fullBody.style.display = 'block';
      postCard.classList.add('post-card--expanded');
    }
  });

  // Кнопка "Свернуть"
  if (collapseBtn && shortBody && fullBody) {
    collapseBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      shortBody.style.display = 'block';
      fullBody.style.display = 'none';
      postCard.classList.remove('post-card--expanded');
    });
  }

  // Лайк
  const setLikeUi = (nextLiked: boolean, nextCount: number): void => {
    if (!likeBtn || !likeCountEl) return;
    likeBtn.classList.toggle('post-card__action--liked', nextLiked);
    likeBtn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
    likeCountEl.textContent = String(nextCount);
    const svg = likeBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', nextLiked ? 'currentColor' : 'none');
  };

  if (likeBtn && api && canView) {
    likeBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      if (likeBtn.disabled) return;
      const wasLiked = likeBtn.classList.contains('post-card__action--liked');
      likeBtn.disabled = true;
      try {
        const response = wasLiked ? await api.unlikePost(postId) : await api.likePost(postId);
        setLikeUi(response.is_liked, response.likes_count);
        if (onPostsUpdated) await onPostsUpdated();
      } catch (error) { console.error('Like error:', error); }
      finally { likeBtn.disabled = false; }
    });
  }

  // Редактирование
  if (editBtn && api && isOwner) {
    editBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      await openPostFormModal({
        api, mode: 'edit', postId,
        initial: { title, raw_text: rawText || content || '' },
        onSaved: onPostsUpdated
      });
    });
  }

  // Удаление
  if (deleteBtn && api && isOwner) {
    deleteBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      deleteBtn.disabled = true;
      try { await api.deletePost(postId); onPostsUpdated?.(); }
      catch (error) { console.error('Delete error:', error); }
      finally { deleteBtn.disabled = false; }
    });
  }

  // Поделиться
  if (shareBtn) {
    shareBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      const shareData = { title, text: rawText || title, url: window.location.href };
      try {
        if (navigator.share) await navigator.share(shareData);
        else await navigator.clipboard.writeText(window.location.href);
      } catch {}
    });
  }

  container.appendChild(postCard);
  return postCard;
}
