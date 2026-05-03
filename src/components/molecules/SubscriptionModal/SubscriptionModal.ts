// src/components/molecules/SubscriptionModal/SubscriptionModal.ts

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';

export interface SubscriptionModalOptions {
  api: ApiClient;
  trainerId: number;
  onSubscribed?: () => void;
}

export function openSubscriptionModal({ api, trainerId, onSubscribed }: SubscriptionModalOptions): void {
  // Используем api.getTrainerTiers – он уже возвращает { tiers: Tier[] }
  api.getTrainerTiers(trainerId)
    .then(response => {
      const tiers: Tier[] = response?.tiers || [];
      // Отладка: посмотрим, что пришло с бэкенда
      console.log('[SubscriptionModal] Получены уровни:', tiers);
      showModal(tiers);
    })
    .catch(error => {
      console.error('[SubscriptionModal] Ошибка загрузки уровней:', error);
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
          ${tiers.map(tier => {
    // Нормализуем цену: если нет или не число, то 0
    const price = (typeof tier.price === 'number' && !isNaN(tier.price)) ? tier.price : 0;
    return `
              <div class="subscription-modal__tier">
                <h3>${escapeHtml(tier.name)} (${price} ₽/мес)</h3>
                <p>${escapeHtml(tier.description || 'Описание отсутствует')}</p>
                <button class="button button--primary-orange button--small" data-subscribe="${tier.tier_id}">Выбрать</button>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.remove()));

    modal.querySelectorAll('[data-subscribe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tierId = Number((e.currentTarget as HTMLElement).dataset.subscribe);
        try {
          await api.subscribeToTrainer(trainerId, tierId);
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

// Простая функция для экранирования HTML, чтобы избежать XSS
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}   
