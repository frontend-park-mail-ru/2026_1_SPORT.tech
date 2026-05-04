import type { ApiClient } from '../../../utils/api';
import type { ContentBlockForPost } from '../../../types/post.types';
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
  contentBlocks?: ContentBlockForPost[];
  min_tier_id?: number | null;
  sport_type?: string;
  tierName?: string;
  tierPrice?: number;
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
    contentBlocks: existingContentBlocks,
    min_tier_id: minTierId = null,
    sport_type: sportType = '',
    tierName = '',
    tierPrice = 0
  } = post;

  // Если пост имеет бесплатный уровень (min_tier_id задан и цена 0), то он доступен всем
  let finalCanView = canView;
  if (minTierId != null && tierPrice == 0) {
    finalCanView = true;
  }

  let contentBlocks: ContentBlock[] = [];
  if (existingContentBlocks && existingContentBlocks.length > 0) {
    contentBlocks = existingContentBlocks.map(block => ({
      type: block.type,
      content: block.content,
      file_url: block.file_url,
      kind: block.kind
    }));
  } else {
    if (rawText && rawText.trim()) {
      const paragraphs = rawText.split('\n').filter(p => p.trim());
      paragraphs.forEach(paragraph => {
        contentBlocks.push({ type: 'text', content: paragraph });
      });
    }
    attachments.forEach(att => {
      contentBlocks.push({ type: 'attachment', file_url: att.file_url, kind: att.kind || 'image' });
    });
    if (contentBlocks.length === 0 && content) {
      contentBlocks.push({ type: 'text', content: content });
    }
  }

  const template = (window as any).Handlebars.templates['PostCard.hbs'];
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const firstTextBlock = contentBlocks.find(b => b.type === 'text');
  const shortTextContent = firstTextBlock?.content
    ? (firstTextBlock.content.length > 200 ? firstTextBlock.content.substring(0, 200) + '...' : firstTextBlock.content)
    : (content.length > 200 ? content.substring(0, 200) + '...' : content);

  const html = template({
    post_id: postId, title, content: shortTextContent, fullContent: content,
    authorName, authorRole, authorAvatar, authorInitials: initials,
    likes, liked, comments, can_view: finalCanView, isOwner,
    contentBlocks, minTierId, sportType, tierName, tierPrice
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

  postCard.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-post-like]') ||
        target.closest('[data-post-edit]') ||
        target.closest('[data-post-delete]') ||
        target.closest('[data-post-share]') ||
        target.closest('[data-post-collapse]')) return;
    if (shortBody && fullBody) {
      shortBody.style.display = 'none';
      fullBody.style.display = 'block';
      postCard.classList.add('post-card--expanded');
    }
  });

  if (collapseBtn && shortBody && fullBody) {
    collapseBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      shortBody.style.display = 'block';
      fullBody.style.display = 'none';
      postCard.classList.remove('post-card--expanded');
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

  if (likeBtn && api && finalCanView) {
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

  if (deleteBtn && api && isOwner) {
    deleteBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      deleteBtn.disabled = true;
      try { await api.deletePost(postId); onPostsUpdated?.(); }
      catch (error) { console.error('Delete error:', error); }
      finally { deleteBtn.disabled = false; }
    });
  }

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
