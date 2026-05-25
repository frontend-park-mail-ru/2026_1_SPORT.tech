import type { ApiClient } from '../../../utils/api';
import type { ContentBlockForPost } from '../../../types/post.types';
import { openPostFormModal } from '../PostFormModal/PostFormModal';
import { openLikesModal } from '../LikesModal/LikesModal';
import { getFriendlyErrorMessage } from '../../../utils/errorMessages';

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
  isVideo?: boolean;
  isImage?: boolean;
}

function isVideoBlock(block: ContentBlock): boolean {
  const kind = (block.kind || '').toLowerCase();
  const url = (block.file_url || '').toLowerCase();
  return kind === 'video' || /\.(mp4|webm|mov|quicktime)(\?|#|$)/.test(url);
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
    can_view: canView = false,
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

  const finalCanView = canView;

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

  const contentBlocksForTemplate = contentBlocks.map(block => {
    const isVideo = block.type === 'attachment' && isVideoBlock(block);
    return {
      ...block,
      isVideo,
      isImage: block.type === 'attachment' && !isVideo
    };
  });

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
    contentBlocks: contentBlocksForTemplate, minTierId, sportType, tierName, tierPrice
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const postCard = wrapper.firstElementChild as HTMLElement;

  const likeBtn = postCard.querySelector('[data-post-like]') as HTMLButtonElement | null;
  const likeCountEl = postCard.querySelector('[data-post-like-count]') as HTMLElement | null;
  const commentBtn = postCard.querySelector('[data-post-comment]') as HTMLButtonElement | null;
  const commentCountEl = postCard.querySelector('[data-post-comment-count]') as HTMLElement | null;
  const editBtn = postCard.querySelector('[data-post-edit]') as HTMLButtonElement | null;
  const deleteBtn = postCard.querySelector('[data-post-delete]') as HTMLButtonElement | null;
  const shareBtn = postCard.querySelector('[data-post-share]') as HTMLButtonElement | null;
  const collapseBtn = postCard.querySelector('[data-post-collapse]') as HTMLButtonElement | null;
  const expandBtn = postCard.querySelector('[data-post-expand-btn]') as HTMLButtonElement | null;
  const shortBody = postCard.querySelector('.post-card__body--short') as HTMLElement | null;
  const fullBody = postCard.querySelector('.post-card__body--full') as HTMLElement | null;

  const expandPost = (): void => {
    if (!shortBody || !fullBody) return;
    shortBody.classList.add('post-card__body--hidden');
    fullBody.classList.add('post-card__body--open');
    postCard.classList.add('post-card--expanded');
  };

  const collapsePost = (): void => {
    if (!shortBody || !fullBody) return;
    shortBody.classList.remove('post-card__body--hidden');
    fullBody.classList.remove('post-card__body--open');
    postCard.classList.remove('post-card--expanded');
  };

  if (expandBtn) {
    expandBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      expandPost();
    });
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      collapsePost();
    });
  }

  const setLikeUi = (nextLiked: boolean, nextCount: number): void => {
    if (!likeBtn || !likeCountEl) return;
    likeBtn.classList.toggle('post-card__action--liked', nextLiked);
    likeBtn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
    likeCountEl.textContent = String(nextCount);
    const svg = likeBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', nextLiked ? 'currentColor' : 'none');
    likeCountEl.classList.toggle('post-card__like-count--clickable', nextCount > 0);
  };

  if (likeCountEl && api && finalCanView) {
    likeCountEl.classList.toggle('post-card__like-count--clickable', likes > 0);
    likeCountEl.title = 'Кто оценил';
    likeCountEl.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const count = parseInt(likeCountEl.textContent || '0', 10) || 0;
      if (count > 0) void openLikesModal({ api, postId });
    });
  }

  if (likeBtn && api && finalCanView) {
    likeBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      if (likeBtn.disabled) return;
      const wasLiked = likeBtn.classList.contains('post-card__action--liked');
      likeBtn.disabled = true;
      try {
        const response = wasLiked ? await api.unlikePost(postId) : await api.likePost(postId);
        // Бэк (proto3) не отдаёт нулевые поля, поэтому likes_count при 0 приходит undefined.
        // Если бэк вернул 204 (response = null), определяем новое состояние оптимистично.
        const currentCount = parseInt(likeCountEl?.textContent || '0', 10) || 0;
        const newLiked = response != null ? !!response.is_liked : !wasLiked;
        const newCount = response != null
          ? (response.likes_count ?? 0)
          : (wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1);
        setLikeUi(newLiked, newCount);
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

  if (commentBtn && api && finalCanView) {
    let commentsLoaded = false;
    let commentsOpen = false;

    const commentsSection = document.createElement('div');
    commentsSection.className = 'post-card__comments';
    commentsSection.style.display = 'none';
    postCard.appendChild(commentsSection);

    const renderComments = async (): Promise<void> => {
      if (!commentsLoaded) {
        commentsSection.innerHTML = `
          <div class="post-card__comments-loading">
            <div class="page-skeleton__block" style="height:40px;border-radius:8px;margin-bottom:8px;"></div>
            <div class="page-skeleton__block" style="height:40px;border-radius:8px;"></div>
          </div>
        `;
        try {
          const data = await api.getComments(postId);
          commentsLoaded = true;
          await renderCommentsList(data.comments);
        } catch {
          commentsSection.innerHTML = '<p class="post-card__comments-error">Не удалось загрузить комментарии</p>';
        }
      }
    };

    const authorCache = new Map<number, { name: string; avatar: string | null }>();

    const renderCommentsList = async (commentsList: Array<{ comment_id: number; author_user_id: number; body: string; created_at: string }>): Promise<void> => {
      const uniqueIds = [...new Set(commentsList.map(c => c.author_user_id))].filter(id => !authorCache.has(id));
      await Promise.all(
        uniqueIds.map(async (userId) => {
          try {
            const profile = await api.getProfile(userId);
            const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.username;
            authorCache.set(userId, { name, avatar: profile.avatar_url ?? null });
          } catch {
            authorCache.set(userId, { name: `Пользователь #${userId}`, avatar: null });
          }
        })
      );

      const listHtml = commentsList.length > 0
        ? commentsList.map(c => {
          const info = authorCache.get(c.author_user_id) ?? { name: `Пользователь #${c.author_user_id}`, avatar: null };
          const initials = info.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          const avatarInner = info.avatar
            ? `<img src="${escapeHtml(info.avatar)}" alt="${escapeHtml(info.name)}">`
            : escapeHtml(initials);
          return `
            <div class="post-card__comment">
              <button type="button" class="post-card__comment-avatar" data-comment-profile="${c.author_user_id}" title="${escapeHtml(info.name)}">${avatarInner}</button>
              <div class="post-card__comment-main">
                <button type="button" class="post-card__comment-author" data-comment-profile="${c.author_user_id}">${escapeHtml(info.name)}</button>
                <div class="post-card__comment-body">${escapeHtml(c.body)}</div>
              </div>
            </div>
          `;
        }).join('')
        : '<p class="post-card__comments-empty">Комментариев пока нет</p>';

      commentsSection.innerHTML = `
        <div class="post-card__comments-list">${listHtml}</div>
        ${finalCanView ? `
          <div class="post-card__comment-form">
            <input type="text" class="post-card__comment-input" placeholder="Написать комментарий...">
            <button type="button" class="post-card__comment-submit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ` : ''}
      `;

      const input = commentsSection.querySelector('.post-card__comment-input') as HTMLInputElement | null;
      const submitBtn = commentsSection.querySelector('.post-card__comment-submit') as HTMLButtonElement | null;

      const sendComment = async (): Promise<void> => {
        if (!input || !input.value.trim() || !submitBtn) return;
        const body = input.value.trim();
        submitBtn.disabled = true;
        const errorEl = commentsSection.querySelector('.post-card__comment-error') as HTMLElement | null;
        if (errorEl) errorEl.remove();
        try {
          const resp = await api.createComment(postId, body);
          if (!resp || !resp.comment) throw new Error('Пустой ответ от сервера');
          input.value = '';
          commentsList.push(resp.comment);
          if (commentCountEl) commentCountEl.textContent = String(commentsList.length);
          await renderCommentsList(commentsList);
        } catch (err: unknown) {
          const msg = getFriendlyErrorMessage(err, 'Не удалось отправить комментарий. Попробуйте ещё раз.');
          const errDiv = document.createElement('p');
          errDiv.className = 'post-card__comment-error';
          errDiv.textContent = msg;
          commentsSection.querySelector('.post-card__comment-form')?.before(errDiv);
        } finally {
          submitBtn.disabled = false;
        }
      };

      submitBtn?.addEventListener('click', (e: Event) => { e.stopPropagation(); void sendComment(); });
      input?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendComment(); }
      });
      input?.addEventListener('click', (e: Event) => e.stopPropagation());

      commentsSection.querySelectorAll('[data-comment-profile]').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          e.stopPropagation();
          const id = (el as HTMLElement).dataset.commentProfile;
          if (id) window.router.navigateTo(`/profile/${id}`);
        });
      });
    };

    commentBtn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      commentsOpen = !commentsOpen;
      commentsSection.style.display = commentsOpen ? 'block' : 'none';
      commentBtn.classList.toggle('post-card__action--active', commentsOpen);
      if (commentsOpen) {
        expandPost();
        await renderComments();
      }
    });
  }

  container.appendChild(postCard);
  return postCard;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
