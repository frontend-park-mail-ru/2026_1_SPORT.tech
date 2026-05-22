// src/components/molecules/StatisticsModal/StatisticsModal.ts

import type { ApiClient } from '../../../utils/api';

export interface StatisticsModalOptions {
  api: ApiClient;
}

export async function openStatisticsModal({ api }: StatisticsModalOptions): Promise<void> {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div data-close style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div>
    <div style="position:relative;background:#fff;border-radius:16px;padding:24px;width:min(460px,92vw);max-height:80vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,0.2);">
      <button data-close style="position:absolute;top:12px;right:16px;border:none;background:none;font-size:24px;line-height:1;cursor:pointer;color:#999;">&times;</button>
      <h2 style="margin:0 0 16px;font-size:20px;color:#1a2b3c;">Статистика</h2>
      <div id="statistics-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.remove()));

  const bodyEl = modal.querySelector('#statistics-modal-body') as HTMLElement;
  bodyEl.innerHTML = `
    <div class="page-skeleton__block" style="height:72px;border-radius:12px;margin-bottom:12px;"></div>
    <div class="page-skeleton__block" style="height:72px;border-radius:12px;"></div>
  `;

  try {
    const [stats, balance] = await Promise.all([
      api.getMyStatistics(),
      api.getMyBalance().catch(() => null)
    ]);
    const currency = balance?.currency || stats.currency || 'RUB';
    const fmt = (n: number): string => n.toLocaleString('ru-RU');

    const card = (value: string, label: string): string => `
      <div style="flex:1;min-width:120px;background:#FFF5F0;border-radius:12px;padding:16px;">
        <div style="font-size:22px;font-weight:700;color:#1a2b3c;">${value}</div>
        <div style="font-size:13px;color:#888;margin-top:4px;">${label}</div>
      </div>
    `;

    const balanceCard = balance
      ? card(`${fmt(balance.amount_value)} ${currency}`, 'Текущий баланс')
      : '';

    bodyEl.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        ${card(String(stats.posts_count), 'Публикаций')}
        ${card(String(stats.donations_count), 'Донатов')}
        ${card(`${fmt(stats.monthly_revenue)} ${currency}`, 'Доход в месяц')}
        ${card(`${fmt(stats.total_revenue)} ${currency}`, 'Всего доходов')}
        ${balanceCard}
      </div>
    `;
  } catch {
    bodyEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;margin:0;">Не удалось загрузить статистику</p>';
  }
}
