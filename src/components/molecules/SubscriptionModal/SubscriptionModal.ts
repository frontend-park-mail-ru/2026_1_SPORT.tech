// src/components/molecules/SubscriptionModal/SubscriptionModal.ts

import type { ApiClient } from '../../../utils/api';
import type { Tier, Subscription } from '../../../types/api.types';

export interface SubscriptionModalOptions {
  api: ApiClient;
  trainerId: number;
  existingSubscription?: Subscription | null; // если уже подписан
  onSubscribed?: () => void; // вызывается после успешной операции (создание или обновление)
}

export async function openSubscriptionModal({
  api,
  trainerId,
  existingSubscription,
  onSubscribed
}: SubscriptionModalOptions): Promise<void> {
  try {
    const response = await api.getTrainerTiers(trainerId);
    const tiers: Tier[] = response?.tiers || [];
    if (tiers.length === 0) {
      alert('У этого тренера пока нет уровней подписки');
      return;
    }
    showModal(tiers);
  } catch (error) {
    console.error('[SubscriptionModal] Ошибка загрузки уровней:', error);
    alert('Не удалось загрузить уровни подписки тренера');
  }

  function showModal(tiers: Tier[]): void {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="subscription-modal__backdrop" data-close></div>
      <div class="subscription-modal__panel">
        <button class="subscription-modal__close" data-close>×</button>
        <h2 class="subscription-modal__title">
          ${existingSubscription ? 'Изменить уровень подписки' : 'Выберите уровень подписки'}
        </h2>
        <div class="subscription-modal__list">
          ${tiers.map(tier => {
    const price = (typeof tier.price === 'number' && !isNaN(tier.price)) ? tier.price : 0;
    const isCurrent = existingSubscription?.tier_id === tier.tier_id;
    return `
              <div class="subscription-modal__tier ${isCurrent ? 'subscription-modal__tier--current' : ''}">
                <h3>${escapeHtml(tier.name)} (${price} ₽/мес)</h3>
                <p>${escapeHtml(tier.description || 'Описание отсутствует')}</p>
                <button
                  class="button button--primary-orange button--small"
                  data-subscribe="${tier.tier_id}"
                  ${isCurrent ? 'disabled' : ''}
                >
                  ${isCurrent ? 'Текущий уровень' : (existingSubscription ? 'Сменить' : 'Выбрать')}
                </button>
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
        const button = e.currentTarget as HTMLButtonElement;
        const originalText = button.textContent || '';

        button.disabled = true;
        button.textContent = 'Обработка...';

        try {
          if (existingSubscription) {
            // Обновляем существующую подписку
            await api.updateSubscription(existingSubscription.subscription_id, tierId);
            alert('Уровень подписки изменён!');
          } else {
            // Создаём новую подписку
            await api.subscribeToTrainer(trainerId, tierId);
            alert('Подписка оформлена!');
          }
          modal.remove();
          if (onSubscribed) await onSubscribed();
        } catch (error: any) {
          console.error('Subscribe/update failed:', error);
          const message = error?.message || 'Не удалось выполнить операцию';
          alert(message);
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
