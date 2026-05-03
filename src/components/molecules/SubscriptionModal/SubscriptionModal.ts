/**
 * @fileoverview Модальное окно подписки на тренера
 * @module components/molecules/SubscriptionModal
 */

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';

export interface SubscriptionModalOptions {
  api: ApiClient;
  trainerId: number;
  onSubscribed?: () => void;
}

export function openSubscriptionModal({ api, trainerId, onSubscribed }: SubscriptionModalOptions): void {
  // Используем публичный эндпоинт для получения уровней тренера
  api.request<Tier[]>(`/v1/trainers/${trainerId}/tiers`)
    .then(response => {
      // Ответ может быть обёрнут в { tiers: [...] } или сразу массив
      const tiers = Array.isArray(response) ? response : (response as unknown as { tiers: Tier[] })?.tiers || [];
      showModal(tiers);
    })
    .catch(() => {
      alert('Не удалось загрузить уровни подписки тренера');
    });

  function showModal(tiers: Tier[]): void {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="subscription-modal__backdrop" data-close></div>
      <div class="subscription-modal__panel">
        <button class="subscription-modal__close" data-close>×</button>
        <h2 class="subscription-modal__title">Выберите уровень подписки</h2>
        <div class="subscription-modal__list">
          ${tiers.map(tier => `
            <div class="subscription-modal__tier">
              <h3>${tier.name} (${tier.price} ₽/мес)</h3>
              <p>${tier.description || 'Описание отсутствует'}</p>
              <button class="button button--primary-orange button--small" data-subscribe="${tier.tier_id}">Выбрать</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Закрытие по клику на backdrop или кнопку
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.remove()));

    // Обработчик кнопок "Выбрать"
    modal.querySelectorAll('[data-subscribe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tierId = Number((e.currentTarget as HTMLElement).dataset.subscribe);
        try {
          await api.request(`/v1/trainers/${trainerId}/subscribe`, {
            method: 'POST',
            body: JSON.stringify({ tier_id: tierId })
          });
          alert('Подписка оформлена!');
          modal.remove();
          onSubscribed?.();
        } catch (error) {
          console.error('Subscribe failed:', error);
          alert('Не удалось оформить подписку');
        }
      });
    });
  }
}
