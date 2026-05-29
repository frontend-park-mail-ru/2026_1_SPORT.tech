// src/components/molecules/StatisticsModal/StatisticsModal.ts

import type { ApiClient } from '../../../utils/api';
import { escapeHtml } from '../../../utils/profilePageData';
import { getFriendlyErrorMessage } from '../../../utils/errorMessages';
import { registerModal } from '../../../utils/modals';
import './StatisticsModal.css';

export interface StatisticsModalOptions {
  api: ApiClient;
}

export async function openStatisticsModal({ api }: StatisticsModalOptions): Promise<void> {
  const modal = document.createElement('div');
  modal.className = 'statistics-modal';
  modal.innerHTML = `
    <div data-close class="statistics-modal__backdrop"></div>
    <div class="statistics-modal__panel">
      <button data-close class="statistics-modal__close" aria-label="Закрыть">&times;</button>
      <h2 class="statistics-modal__title">Статистика</h2>
      <div id="statistics-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Двойной rAF — первый кадр коммитит изначальные стили (opacity 0, transform),
  // второй включает класс с конечным состоянием, чтобы transition действительно сыграл.
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('statistics-modal--visible')));

  // Закрытие по Escape — через общий реестр модалок (см. utils/modals).
  const unregister = registerModal(() => close());
  const close = (): void => {
    unregister();
    modal.classList.remove('statistics-modal--visible');
    setTimeout(() => modal.remove(), 220);
  };
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

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
        <div style="font-size:22px;font-weight:700;color:#1a2b3c;">${escapeHtml(value)}</div>
        <div style="font-size:13px;color:#888;margin-top:4px;">${escapeHtml(label)}</div>
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
  } catch (err: unknown) {
    const msg = getFriendlyErrorMessage(err, 'Попробуйте повторить позже.');
    console.error('[StatisticsModal] failed to load statistics:', err);
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <p style="color:#e53e3e;font-weight:600;margin:0 0 8px;">Не удалось загрузить статистику</p>
        <p style="color:#999;font-size:12px;margin:0;">${escapeHtml(msg)}</p>
      </div>
    `;
  }
}
