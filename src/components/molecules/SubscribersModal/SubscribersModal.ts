// src/components/molecules/SubscribersModal/SubscribersModal.ts

import type { ApiClient } from '../../../utils/api';
import { escapeHtml, formatMonthlyPrice } from '../../../utils/profilePageData';

export interface SubscribersModalOptions {
  api: ApiClient;
}

export async function openSubscribersModal({ api }: SubscribersModalOptions): Promise<void> {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div data-close data-backdrop style="position:absolute;inset:0;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.25s ease;"></div>
    <div data-dialog style="position:relative;background:#fff;border-radius:16px;padding:24px;width:min(480px,92vw);max-height:80vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,0.2);opacity:0;transform:translateY(8px) scale(0.96);transition:opacity 0.25s ease, transform 0.25s ease;">
      <button data-close style="position:absolute;top:12px;right:16px;border:none;background:none;font-size:24px;line-height:1;cursor:pointer;color:#999;">&times;</button>
      <h2 style="margin:0 0 16px;font-size:20px;color:#1a2b3c;">Мои подписчики</h2>
      <div id="subscribers-modal-list"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const backdrop = modal.querySelector('[data-backdrop]') as HTMLElement;
  const dialog = modal.querySelector('[data-dialog]') as HTMLElement;

  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translateY(0) scale(1)';
  });

  let closing = false;
  const closeModal = (): void => {
    if (closing) return;
    closing = true;
    backdrop.style.opacity = '0';
    dialog.style.opacity = '0';
    dialog.style.transform = 'translateY(8px) scale(0.96)';
    const finish = (): void => modal.remove();
    dialog.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 300);
  };
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));

  const listEl = modal.querySelector('#subscribers-modal-list') as HTMLElement;
  listEl.innerHTML = `
    <div class="page-skeleton__block" style="height:64px;border-radius:12px;margin-bottom:12px;"></div>
    <div class="page-skeleton__block" style="height:64px;border-radius:12px;"></div>
  `;

  try {
    const data = await api.getMySubscribers({ limit: 100 });
    const active = (data.subscribers || []).filter(sub => sub.active);

    if (active.length === 0) {
      listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;margin:0;">У вас пока нет подписчиков</p>';
      return;
    }

    const profiles = await Promise.all(
      active.map(sub => api.getProfile(sub.client_id).catch(() => null))
    );

    listEl.innerHTML = '';
    active.forEach((sub, idx) => {
      const client = profiles[idx];
      const name = client
        ? `${client.first_name} ${client.last_name}`.trim() || client.username
        : `Пользователь #${sub.client_id}`;
      const avatarUrl = client?.avatar_url;
      const safeAvatarUrl = avatarUrl ? escapeHtml(avatarUrl) : '';
      const safeInitial = escapeHtml(name.charAt(0).toUpperCase());
      const avatarHtml = avatarUrl
        ? `<img src="${safeAvatarUrl}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:40px;height:40px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#888;flex-shrink:0;">${safeInitial}</div>`;
      const expiresDate = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('ru-RU') : '—';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #eee;border-radius:12px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.2s;';
      row.innerHTML = `
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;color:#1a2b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
          <div style="font-size:12px;color:#999;">${escapeHtml(sub.tier_name)} · до ${escapeHtml(expiresDate)}</div>
        </div>
        <span style="color:var(--primary-orange);font-weight:700;font-size:14px;flex-shrink:0;">${formatMonthlyPrice(sub.price)}</span>
      `;
      row.addEventListener('mouseenter', () => { row.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; });
      row.addEventListener('mouseleave', () => { row.style.boxShadow = 'none'; });
      row.addEventListener('click', () => {
        closeModal();
        window.router.navigateTo(`/profile/${sub.client_id}`);
      });
      listEl.appendChild(row);
    });
  } catch {
    listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;margin:0;">Не удалось загрузить подписчиков</p>';
  }
}
