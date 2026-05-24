// src/pages/FinancePage/FinancePage.ts

import './FinancePage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/auth.types';
import type { DonationItem } from '../../types/api.types';
import { escapeHtml } from '../../utils/profilePageData';

interface FinancePageParams {
  currentUser: AuthResponse;
}

const PAGE_SIZE = 20;

export async function renderFinancePage(
  api: ApiClient,
  container: HTMLElement,
  _params: FinancePageParams
): Promise<void> {
  container.innerHTML = `
    <div class="finance-page">
      <div class="finance-page__header">
        <h1 class="finance-page__title">Финансы</h1>
      </div>

      <div class="finance-page__cards" id="finance-cards">
        <div class="finance-page__card-skeleton"></div>
        <div class="finance-page__card-skeleton"></div>
        <div class="finance-page__card-skeleton"></div>
        <div class="finance-page__card-skeleton"></div>
      </div>

      <div class="finance-page__section">
        <h2 class="finance-page__section-title">История донатов</h2>
        <div id="finance-donations-list" class="finance-page__donations-list">
          <div class="finance-page__loading">Загрузка...</div>
        </div>
        <div id="finance-donations-pagination" class="finance-page__pagination"></div>
      </div>

      <div class="finance-page__section">
        <h2 class="finance-page__section-title">Подписчики</h2>
        <div id="finance-subscribers-list" class="finance-page__subscribers-list">
          <div class="finance-page__loading">Загрузка...</div>
        </div>
      </div>
    </div>
  `;

  // Load cards (stats + balance) in parallel
  void loadSummaryCards(api, container.querySelector('#finance-cards') as HTMLElement);
  void loadDonations(api, container, 0);
  void loadSubscribers(api, container);
}

async function loadSummaryCards(api: ApiClient, cardsEl: HTMLElement): Promise<void> {
  try {
    const [stats, balance] = await Promise.all([
      api.getMyStatistics(),
      api.getMyBalance().catch(() => null)
    ]);

    const currency = balance?.currency || stats.currency || 'RUB';
    const fmt = (n: number): string => n.toLocaleString('ru-RU');

    const card = (value: string, label: string, accent = false): string => `
      <div class="finance-page__card${accent ? ' finance-page__card--accent' : ''}">
        <div class="finance-page__card-value">${escapeHtml(value)}</div>
        <div class="finance-page__card-label">${escapeHtml(label)}</div>
      </div>
    `;

    const balanceCard = balance
      ? card(`${fmt(balance.amount_value)} ${currency}`, 'Текущий баланс', true)
      : '';

    cardsEl.innerHTML = `
      ${balanceCard}
      ${card(`${fmt(stats.total_revenue)} ${currency}`, 'Всего заработано')}
      ${card(`${fmt(stats.monthly_revenue)} ${currency}`, 'Доход в месяц')}
      ${card(String(stats.donations_count), 'Донатов получено')}
      ${card(String(stats.posts_count), 'Публикаций')}
    `;
  } catch (err: unknown) {
    const msg = (err as Error).message || 'Неизвестная ошибка';
    console.error('[FinancePage] failed to load stats:', err);
    cardsEl.innerHTML = `
      <div class="finance-page__error">
        <p>Не удалось загрузить статистику: ${escapeHtml(msg)}</p>
        <button class="finance-page__retry-btn" id="finance-stats-retry">Повторить</button>
      </div>
    `;
    cardsEl.querySelector('#finance-stats-retry')?.addEventListener('click', () => {
      cardsEl.innerHTML = '<div class="finance-page__loading">Загрузка...</div>';
      void loadSummaryCards(api, cardsEl);
    });
  }
}

async function loadDonations(api: ApiClient, container: HTMLElement, offset: number): Promise<void> {
  const listEl = container.querySelector('#finance-donations-list') as HTMLElement;
  const paginationEl = container.querySelector('#finance-donations-pagination') as HTMLElement;

  if (!listEl) return;
  listEl.innerHTML = '<div class="finance-page__loading">Загрузка...</div>';

  try {
    const data = await api.getMyReceivedDonations({ limit: PAGE_SIZE, offset });
    const donations = data.donations || [];
    const total = data.total || 0;

    if (donations.length === 0 && offset === 0) {
      listEl.innerHTML = '<div class="finance-page__empty">Донатов пока нет</div>';
      paginationEl.innerHTML = '';
      return;
    }

    // Enrich with sender profile names asynchronously
    const senderIds = [...new Set(donations.map(d => d.sender_user_id))];
    const profileMap: Record<number, { name: string; avatarUrl: string | null }> = {};

    await Promise.all(
      senderIds.map(id =>
        api.getProfile(id).then(p => {
          profileMap[id] = {
            name: `${p.first_name} ${p.last_name}`.trim() || p.username,
            avatarUrl: p.avatar_url ?? null
          };
        }).catch(() => {
          profileMap[id] = { name: `Пользователь #${id}`, avatarUrl: null };
        })
      )
    );

    listEl.innerHTML = donations.map(d => renderDonationRow(d, profileMap[d.sender_user_id])).join('');

    // Pagination
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE);
    if (totalPages > 1) {
      paginationEl.innerHTML = renderPagination(currentPage, totalPages);
      paginationEl.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt((btn as HTMLElement).dataset.page || '0', 10);
          void loadDonations(api, container, page * PAGE_SIZE);
          listEl.scrollIntoView({ behavior: 'smooth' });
        });
      });
    } else {
      paginationEl.innerHTML = '';
    }
  } catch (err: unknown) {
    const msg = (err as Error).message || 'Неизвестная ошибка';
    console.error('[FinancePage] failed to load donations:', err);
    listEl.innerHTML = `
      <div class="finance-page__error">
        <p>Не удалось загрузить донаты: ${escapeHtml(msg)}</p>
        <button class="finance-page__retry-btn" id="finance-donations-retry">Повторить</button>
      </div>
    `;
    listEl.querySelector('#finance-donations-retry')?.addEventListener('click', () => {
      void loadDonations(api, container, offset);
    });
  }
}

function renderDonationRow(
  d: DonationItem,
  sender: { name: string; avatarUrl: string | null } | undefined
): string {
  const name = sender?.name ?? `Пользователь #${d.sender_user_id}`;
  const avatarUrl = sender?.avatarUrl;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const safeName = escapeHtml(name);
  const safeAvatarUrl = avatarUrl ? escapeHtml(avatarUrl) : '';
  const safeInitials = escapeHtml(initials);
  const safeCurrency = escapeHtml(d.currency);
  const date = new Date(d.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const safeDate = escapeHtml(date);
  const fmt = (n: number) => n.toLocaleString('ru-RU');

  return `
    <div class="finance-page__donation-row">
      <div class="finance-page__donation-avatar">
        ${avatarUrl
    ? `<img src="${safeAvatarUrl}" alt="${safeName}" class="finance-page__avatar-img">`
    : `<span class="finance-page__avatar-initials">${safeInitials}</span>`}
      </div>
      <div class="finance-page__donation-info">
        <div class="finance-page__donation-sender">${safeName}</div>
        ${d.message ? `<div class="finance-page__donation-message">"${escapeHtml(d.message)}"</div>` : ''}
        <div class="finance-page__donation-date">${safeDate}</div>
      </div>
      <div class="finance-page__donation-amount">
        +${escapeHtml(fmt(d.amount_value))} ${safeCurrency}
      </div>
    </div>
  `;
}

function renderPagination(currentPage: number, totalPages: number): string {
  const pages: string[] = [];
  const start = Math.max(0, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  if (start > 0) {
    pages.push('<button class="finance-page__page-btn" data-page="0">1</button>');
    if (start > 1) pages.push('<span class="finance-page__page-ellipsis">…</span>');
  }
  for (let i = start; i <= end; i++) {
    pages.push(`<button class="finance-page__page-btn${i === currentPage ? ' finance-page__page-btn--active' : ''}" data-page="${i}">${i + 1}</button>`);
  }
  if (end < totalPages - 1) {
    if (end < totalPages - 2) pages.push('<span class="finance-page__page-ellipsis">…</span>');
    pages.push(`<button class="finance-page__page-btn" data-page="${totalPages - 1}">${totalPages}</button>`);
  }

  return `<div class="finance-page__pagination-inner">${pages.join('')}</div>`;
}

async function loadSubscribers(api: ApiClient, container: HTMLElement): Promise<void> {
  const listEl = container.querySelector('#finance-subscribers-list') as HTMLElement;
  if (!listEl) return;

  try {
    const data = await api.getMySubscribers({ limit: 50, offset: 0 });
    const subscribers = data.subscribers || [];

    if (subscribers.length === 0) {
      listEl.innerHTML = '<div class="finance-page__empty">Подписчиков пока нет</div>';
      return;
    }

    // Enrich with client profiles
    const clientIds = [...new Set(subscribers.map(s => s.client_id))];
    const profileMap: Record<number, { name: string; avatarUrl: string | null }> = {};

    await Promise.all(
      clientIds.map(id =>
        api.getProfile(id).then(p => {
          profileMap[id] = {
            name: `${p.first_name} ${p.last_name}`.trim() || p.username,
            avatarUrl: p.avatar_url ?? null
          };
        }).catch(() => {
          profileMap[id] = { name: `Пользователь #${id}`, avatarUrl: null };
        })
      )
    );

    listEl.innerHTML = subscribers.map(s => {
      const profile = profileMap[s.client_id];
      const name = profile?.name ?? `Пользователь #${s.client_id}`;
      const avatarUrl = profile?.avatarUrl;
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const expiresAt = s.expires_at
        ? new Date(s.expires_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
      const statusClass = s.active ? 'finance-page__sub-status--active' : 'finance-page__sub-status--inactive';
      const statusLabel = s.active ? 'Активна' : 'Истекла';
      const safeName = escapeHtml(name);
      const safeAvatarUrl = avatarUrl ? escapeHtml(avatarUrl) : '';
      const safeInitials = escapeHtml(initials);
      const safeTierName = escapeHtml(s.tier_name);
      const safeExpiresAt = escapeHtml(expiresAt);
      const safePrice = escapeHtml(s.price.toLocaleString('ru-RU'));

      return `
        <div class="finance-page__subscriber-row" data-user-id="${s.client_id}" style="cursor:pointer;">
          <div class="finance-page__donation-avatar">
            ${avatarUrl
    ? `<img src="${safeAvatarUrl}" alt="${safeName}" class="finance-page__avatar-img">`
    : `<span class="finance-page__avatar-initials">${safeInitials}</span>`}
          </div>
          <div class="finance-page__donation-info">
            <div class="finance-page__donation-sender">${safeName}</div>
            <div class="finance-page__donation-date">${safeTierName} · ${safePrice} ₽/мес · до ${safeExpiresAt}</div>
          </div>
          <span class="finance-page__sub-status ${statusClass}">${statusLabel}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-user-id]').forEach(row => {
      row.addEventListener('click', () => {
        const userId = (row as HTMLElement).dataset.userId;
        if (userId) window.router.navigateTo(`/profile/${userId}`);
      });
    });
  } catch (err: unknown) {
    const msg = (err as Error).message || 'Неизвестная ошибка';
    console.error('[FinancePage] failed to load subscribers:', err);
    listEl.innerHTML = `
      <div class="finance-page__error">
        <p>Не удалось загрузить подписчиков: ${escapeHtml(msg)}</p>
        <button class="finance-page__retry-btn" id="finance-subs-retry">Повторить</button>
      </div>
    `;
    listEl.querySelector('#finance-subs-retry')?.addEventListener('click', () => {
      void loadSubscribers(api, container);
    });
  }
}
