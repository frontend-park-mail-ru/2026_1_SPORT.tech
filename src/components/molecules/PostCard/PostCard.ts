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
  attachments?: Array<{ file_url: string; kind: string }>;
  min_tier_id?: number | null;
  sport_type?: string;
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

  const template = (window as any).Handlebars.templates['PostCard.hbs'];
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const shortContent = content.length > 200 ? content.substring(0, 200) + '...' : content;

  const html = template({
    post_id: postId, title, content: shortContent, fullContent: content,
    authorName, authorRole, authorAvatar, authorInitials: initials,
    likes, liked, comments, can_view: canView, isOwner,
    attachments, minTierId, sportType
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;

  const likeBtn = element.querySelector('[data-post-like]') as HTMLButtonElement | null;
  const likeCountEl = element.querySelector('[data-post-like-count]') as HTMLElement | null;
  const editBtn = element.querySelector('[data-post-edit]') as HTMLButtonElement | null;
  const deleteBtn = element.querySelector('[data-post-delete]') as HTMLButtonElement | null;
  const shareBtn = element.querySelector('[data-post-share]') as HTMLButtonElement | null;
  const expandBtn = element.querySelector('[data-post-expand]') as HTMLButtonElement | null;
  const collapseBtn = element.querySelector('[data-post-collapse]') as HTMLButtonElement | null;
  const shortBody = element.querySelector('.post-card__body--short') as HTMLElement | null;
  const fullBody = element.querySelector('.post-card__body--full') as HTMLElement | null;

  if (expandBtn && shortBody && fullBody) {
    expandBtn.addEventListener('click', () => {
      shortBody.style.display = 'none';
      fullBody.style.display = 'block';
      expandBtn.style.display = 'none';
      if (collapseBtn) collapseBtn.style.display = 'inline-flex';
    });
  }

  if (collapseBtn && shortBody && fullBody) {
    collapseBtn.addEventListener('click', () => {
      shortBody.style.display = 'block';
      fullBody.style.display = 'none';
      collapseBtn.style.display = 'none';
      if (expandBtn) expandBtn.style.display = 'inline-flex';
    });
  }

  const setLikeUi = (nextLiked: boolean, nextCount: number): void => {
    if (!likeBtn || !likeCountEl) return;
    likeBtn.classList.toggle('post-card__action--liked', nextLiked);
    likeBtn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
    likeCountEl.textContent = String(nextCount);
    const svg = likeBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', nextLiked ? 'currentColor' : 'none');
  };

  if (likeBtn && api && canView) {
    likeBtn.addEventListener('click', async () => {
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

  if (editBtn && api && isOwner) {
    editBtn.addEventListener('click', async () => {
      await openPostFormModal({ api, mode: 'edit', postId, initial: { title, text_content: rawText || content || '' }, onSaved: onPostsUpdated });
    });
  }

  if (deleteBtn && api && isOwner) {
    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      try { await api.deletePost(postId); onPostsUpdated?.(); }
      catch (error) { console.error('Delete error:', error); }
      finally { deleteBtn.disabled = false; }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = { title, text: rawText || title, url: window.location.href };
      try { if (navigator.share) await navigator.share(shareData); else await navigator.clipboard.writeText(window.location.href); }
      catch {}
    });
  }

  container.appendChild(element);
  return element;
}
