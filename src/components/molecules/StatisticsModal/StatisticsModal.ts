import type { ApiClient } from '../../../utils/api';

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
    // 1. Количество публикаций
    const postsPromise = api.getUserPosts(userId).catch(() => ({ posts: [] }));

    if (isTrainer) {
      // Тренер: количество постов + баланс
      const balancePromise = api.request<{
        amount_value: number;
        currency: string;
        trainer_id: number;
      }>('/v1/balance').catch(() => null);

      const [postsData, balanceData] = await Promise.all([postsPromise, balancePromise]);
      const postsCount = Array.isArray(postsData?.posts) ? postsData.posts.length : 0;
      const balance = balanceData?.amount_value ?? null;

      body.innerHTML = `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Публикаций</span>
          <span class="statistics-modal__value">${postsCount}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Общий доход (от донатов)</span>
          <span class="statistics-modal__value">${balance !== null ? `${balance} ₽` : 'Нет данных'}</span>
        </div>
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Доход от подписок</span>
          <span class="statistics-modal__value">Скоро</span>
        </div>
      `;
    } else {
      // Клиент: количество постов (лайкнутых? своих?) + расходы
      // Можно показать свои публикации? У клиента их нет, поэтому пропустим.
      const subsPromise = api.getMySubscriptions().catch(() => ({ subscriptions: [] }));
      const [postsData, subsData] = await Promise.all([postsPromise, subsPromise]);

      const postsCount = Array.isArray(postsData?.posts) ? postsData.posts.length : 0;
      const activeSubs = subsData.subscriptions.filter(s => s.active);
      const totalCost = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);

      body.innerHTML = `
        <div class="statistics-modal__item">
          <span class="statistics-modal__label">Понравившихся публикаций</span>
          <span class="statistics-modal__value">${postsCount}</span>
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
