/**
 * @fileoverview Вкладка «Финансы» — доходы и баланс тренера.
 * Показывается только на своём профиле тренера.
 */

import type { ApiClient } from '../../../utils/api';
import { escapeHtml } from '../../../utils/profilePageData';
import { getFriendlyErrorMessage } from '../../../utils/errorMessages';
import { icons } from '../../../utils/icons';
import './FinanceTab.css';

export interface FinanceTabOptions {
  api: ApiClient;
}

function fmtMoney(value: number, currency: string): string {
  const sym = currency === 'RUB' ? '₽' : currency;
  return `${value.toLocaleString('ru-RU')} ${sym}`;
}

function card(value: string, label: string, sub?: string): string {
  return `
    <div class="finance-card">
      <div class="finance-card__value">${escapeHtml(value)}</div>
      <div class="finance-card__label">${escapeHtml(label)}</div>
      ${sub ? `<div class="finance-card__sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}

export async function renderFinanceTab(container: HTMLElement, { api }: FinanceTabOptions): Promise<void> {
  container.innerHTML = `
    <div class="finance-tab">
      <div class="finance-tab__loading">Загрузка финансов...</div>
    </div>
  `;
  const root = container.querySelector('.finance-tab') as HTMLElement;

  try {
    const [stats, balance] = await Promise.all([
      api.getMyStatistics(),
      api.getMyBalance().catch(() => null),
    ]);

    const cur = balance?.currency || stats.currency || 'RUB';

    root.innerHTML = `
      <div class="finance-tab__header">
        <h2 class="finance-tab__title">Финансы</h2>
        <p class="finance-tab__desc">Ваши доходы за всё время и текущий баланс</p>
      </div>

      <div class="finance-tab__grid">
        ${balance ? card(fmtMoney(balance.amount_value, cur), 'Текущий баланс', 'Доступно к выводу') : ''}
        ${card(fmtMoney(stats.total_revenue, cur), 'Всего заработано', 'За всё время')}
        ${card(fmtMoney(stats.monthly_revenue, cur), 'Доход в этом месяце', 'Подписки + донаты')}
        ${card(String(stats.donations_count), 'Донатов получено', 'За всё время')}
        ${card(String(stats.posts_count), 'Публикаций', 'Создано вами')}
      </div>

      <div class="finance-tab__disclaimer">
        <p><span class="finance-tab__disclaimer-icon">${icons.bulb}</span>Доходы рассчитываются по завершённым платежам. Актуализируются в реальном времени.</p>
      </div>
    `;
  } catch (err: unknown) {
    const msg = getFriendlyErrorMessage(err, 'Попробуйте повторить позже.');
    root.innerHTML = `
      <div class="finance-tab__error">
        <div class="finance-tab__error-icon">${icons.warning}</div>
        <p class="finance-tab__error-text">Не удалось загрузить финансовые данные</p>
        <p class="finance-tab__error-detail">${escapeHtml(msg)}</p>
        <button class="finance-tab__retry-btn">Попробовать снова</button>
      </div>
    `;
    root.querySelector('.finance-tab__retry-btn')?.addEventListener('click', () => {
      void renderFinanceTab(container, { api });
    });
  }
}
