import type { ApiClient } from '../../../utils/api';
import { escapeHtml } from '../../../utils/profilePageData';
import { registerModal } from '../../../utils/modals';

export interface LikesModalOptions {
  api: ApiClient;
  postId: number;
}

export async function openLikesModal({ api, postId }: LikesModalOptions): Promise<void> {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div data-close style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div>
    <div style="position:relative;background:#fff;border-radius:16px;padding:24px;width:min(420px,92vw);max-height:80vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,0.2);">
      <button data-close style="position:absolute;top:12px;right:16px;border:none;background:none;font-size:24px;line-height:1;cursor:pointer;color:#999;">&times;</button>
      <h2 style="margin:0 0 16px;font-size:20px;color:#1a2b3c;">Оценили публикацию</h2>
      <div id="likes-modal-list"></div>
    </div>
  `;
  document.body.appendChild(modal);
  // Закрытие по клику и по Escape (через общий реестр модалок).
  const unregister = registerModal(() => modal.remove());
  const close = (): void => { unregister(); modal.remove(); };
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

  const listEl = modal.querySelector('#likes-modal-list') as HTMLElement;
  listEl.innerHTML = `
    <div class="page-skeleton__block" style="height:56px;border-radius:12px;margin-bottom:10px;"></div>
    <div class="page-skeleton__block" style="height:56px;border-radius:12px;"></div>
  `;

  try {
    const data = await api.listPostLikes(postId);
    const likes = data.likes || [];

    if (likes.length === 0) {
      listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;margin:0;">Пока никто не оценил</p>';
      return;
    }

    const profiles = await Promise.all(
      likes.map(like => api.getProfile(like.user_id).catch(() => null))
    );

    listEl.innerHTML = '';
    likes.forEach((like, idx) => {
      const profile = profiles[idx];
      const name = profile
        ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username
        : `Пользователь #${like.user_id}`;
      const avatarUrl = profile?.avatar_url;
      const safeInitial = escapeHtml(name.charAt(0).toUpperCase());
      const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:40px;height:40px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#888;flex-shrink:0;">${safeInitial}</div>`;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #eee;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:box-shadow 0.2s;';
      row.innerHTML = `
        ${avatarHtml}
        <div style="flex:1;min-width:0;font-weight:600;font-size:14px;color:#1a2b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
      `;
      row.addEventListener('mouseenter', () => { row.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; });
      row.addEventListener('mouseleave', () => { row.style.boxShadow = 'none'; });
      row.addEventListener('click', () => {
        close();
        window.router.navigateTo(`/profile/${like.user_id}`);
      });
      listEl.appendChild(row);
    });
  } catch {
    listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;margin:0;">Не удалось загрузить список</p>';
  }
}
