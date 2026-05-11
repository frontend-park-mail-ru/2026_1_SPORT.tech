// src/components/molecules/StatisticsModal/StatisticsModal.ts

import type { ApiClient } from '../../../utils/api';
import type { PostListItem } from '../../../types/api.types';

export async function openStatisticsModal(
  api: ApiClient,
  userId: number,
  isTrainer: boolean,
  isOwnProfile: boolean
): Promise<void> {
  const template = (window as any).Handlebars.templates['StatisticsModal.hbs'];
  const html = template({});
  const root = document.createElement('div');
  root.innerHTML = html.trim();
  const modal = root.firstElementChild as HTMLElement;

  const body = modal.querySelector('#statistics-body') as HTMLElement;

  const close = () => {
    document.removeEventListener('keydown', escHandler);
    modal.remove();
  };
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  modal.querySelectorAll('[data-close-statistics]').forEach(el => {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', escHandler);

  try {
    if (isTrainer) {
      // Тренер
      const postsPromise = api.getUserPosts(userId).catch(() => ({ posts: [] as PostListItem[], user_id: userId }));
      const balancePromise = api.request<{ amount_value: number; currency: string; trainer_id: number }>('/v1/balance').catch(() => null);

      let ownSubCost = 0;
      if (isOwnProfile) {
        try {
          const subs = await api.getMySubscriptions();
          ownSubCost = subs.subscriptions
            .filter(s => s.active)
            .reduce((sum, s) => sum + (s.price || 0), 0);
        } catch {}
      }

      const [postsData, balanceData] = await Promise.all([postsPromise, balancePromise]);
      const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];
      const postsCount = postList.length;

      let totalLikes = 0;
      let totalComments = 0;
      postList.forEach(p => {
        totalLikes += p.likes_count || 0;
        totalComments += p.comments_count || 0;
      });

      const avgLikes = postsCount > 0 ? (totalLikes / postsCount).toFixed(1) : '0';
      const avgComments = postsCount > 0 ? (totalComments / postsCount).toFixed(1) : '0';

      const donationBalance = balanceData?.amount_value ?? null;

      body.innerHTML = `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Публикаций</span>
          <span class="statistics-modal__value">${postsCount}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Всего лайков</span>
          <span class="statistics-modal__value">${totalLikes}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Всего комментариев</span>
          <span class="statistics-modal__value">${totalComments}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Среднее лайков на пост</span>
          <span class="statistics-modal__value">${avgLikes}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Среднее комментариев на пост</span>
          <span class="statistics-modal__value">${avgComments}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Доход от донатов</span>
          <span class="statistics-modal__value">${donationBalance !== null ? `${donationBalance} ₽` : 'Нет данных'}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Доход от подписок (в месяц)</span>
          <span class="statistics-modal__value">Нет данных (нужен бэкенд)</span>
        </div>
        ${isOwnProfile ? `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Расходы на подписки</span>
          <span class="statistics-modal__value">${ownSubCost} ₽</span>
        </div>` : ''}
      `;
    } else {
      // Клиент
      const subsPromise = api.getMySubscriptions().catch(() => ({ subscriptions: [] }));
      const [subsData] = await Promise.all([subsPromise]);
      const activeSubs = subsData.subscriptions.filter(s => s.active);
      const subscriptionCost = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);

      body.innerHTML = `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Расходы на подписки (в месяц)</span>
          <span class="statistics-modal__value">${subscriptionCost} ₽</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Пожертвования (всего)</span>
          <span class="statistics-modal__value">Нет данных (нужен бэкенд)</span>
        </div>
      `;
    }
  } catch (err) {
    body.innerHTML = '<div class="statistics-modal__loader">Ошибка загрузки</div>';
    console.error(err);
  }

  document.body.appendChild(modal);
}
