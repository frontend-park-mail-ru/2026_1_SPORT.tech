// src/components/molecules/StatisticsModal/StatisticsModal.ts

import type { ApiClient } from '../../../utils/api';
import type { PostListItem } from '../../../types/api.types';

export enum ProfileRole {
  TRAINER = 'trainer',
  CLIENT = 'client',
}

export async function openStatisticsModal(
  api: ApiClient,
  userId: number,
  isTrainer: boolean
): Promise<void> {
  // Создаём модальное окно из шаблона
  const template = (window as any).Handlebars.templates['StatisticsModal.hbs'];
  const html = template({});
  const root = document.createElement('div');
  root.innerHTML = html.trim();
  const modal = root.firstElementChild as HTMLElement;

  const body = modal.querySelector('#statistics-body') as HTMLElement;

  // Функция закрытия
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

  // Заполняем содержимое
  try {
    // 1. Получаем публикации пользователя
    const postsPromise = api.getUserPosts(userId).catch(() => ({ posts: [] as PostListItem[], user_id: userId }));

    if (isTrainer) {
      // Тренер: агрегируем данные по постам + баланс
      const balancePromise = api.request<{
        amount_value: number;
        currency: string;
        trainer_id: number;
      }>('/v1/balance').catch(() => null);

      const [postsData, balanceData] = await Promise.all([postsPromise, balancePromise]);

      const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];
      const postsCount = postList.length;

      // Агрегация лайков и комментариев
      let totalLikes = 0;
      let totalComments = 0;
      postList.forEach(p => {
        totalLikes += p.likes_count || 0;
        totalComments += p.comments_count || 0;
      });

      const avgLikes = postsCount > 0 ? (totalLikes / postsCount).toFixed(1) : '0';
      const avgComments = postsCount > 0 ? (totalComments / postsCount).toFixed(1) : '0';

      const balance = balanceData?.amount_value ?? null;

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
          <span class="statistics-modal__label">Общий доход (донаты + подписки)</span>
          <span class="statistics-modal__value">${balance !== null ? `${balance} ₽` : 'Нет данных'}</span>
        </div>
      `;
    } else {
      // Клиент: берём понравившиеся посты и подписки
      const subsPromise = api.getMySubscriptions().catch(() => ({ subscriptions: [] }));
      const [postsData, subsData] = await Promise.all([postsPromise, subsPromise]);

      const postList: PostListItem[] = Array.isArray(postsData?.posts) ? postsData.posts : [];
      const likedPosts = postList.filter(p => p.is_liked);
      const likesCount = likedPosts.length; // количество понравившихся

      // Суммарные лайки и комментарии понравившихся постов
      let totalLikes = 0;
      let totalComments = 0;
      likedPosts.forEach(p => {
        totalLikes += p.likes_count || 0;
        totalComments += p.comments_count || 0;
      });

      const activeSubs = subsData.subscriptions.filter(s => s.active);
      const totalCost = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);

      body.innerHTML = `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Понравившихся публикаций</span>
          <span class="statistics-modal__value">${likesCount}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Лайков на этих публикациях</span>
          <span class="statistics-modal__value">${totalLikes}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Комментариев на этих публикациях</span>
          <span class="statistics-modal__value">${totalComments}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Расходы на подписки (в месяц)</span>
          <span class="statistics-modal__value">${totalCost} ₽</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Пожертвования</span>
          <span class="statistics-modal__value">Нет данных</span>
        </div>
      `;
    }
  } catch (err) {
    body.innerHTML = '<div class="statistics-modal__loader">Ошибка загрузки</div>';
    console.error(err);
  }

  document.body.appendChild(modal);
}
