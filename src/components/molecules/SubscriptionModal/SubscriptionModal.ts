// src/components/molecules/SubscriptionModal/SubscriptionModal.ts

import type { ApiClient } from '../../../utils/api';
import type { Tier, Subscription } from '../../../types/api.types';
import { escapeHtml, formatMonthlyPrice } from '../../../utils/profilePageData';
import { icons } from '../../../utils/icons';
import { closeAllModals, registerModal } from '../../../utils/modals';

export interface SubscriptionModalOptions {
  api: ApiClient;
  trainerId: number;
  existingSubscription?: Subscription | null;
  onSubscribed?: () => void;
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
      showEmptyModal();
      return;
    }
    showModal(tiers, existingSubscription);
  } catch {
    showEmptyModal();
    return;
  }

  function showEmptyModal(): void {
    closeAllModals();
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="subscription-modal__backdrop" data-close></div>
      <div class="subscription-modal__panel">
        <button class="subscription-modal__close" data-close>×</button>
        <h2 class="subscription-modal__title">Подписки недоступны</h2>
        <div class="subscription-modal__empty">
          <p class="subscription-modal__empty-text">
            У этого тренера пока нет планов подписки.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const unregister = registerModal(() => modal.remove());
    modal.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', () => { unregister(); modal.remove(); })
    );
  }

  function showModal(tiers: Tier[], currentSubscription?: Subscription | null): void {
    closeAllModals();
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="subscription-modal__backdrop" data-close></div>
      <div class="subscription-modal__panel">
        <button class="subscription-modal__close" data-close>×</button>
        <h2 class="subscription-modal__title">
          ${currentSubscription ? 'Изменить или отменить подписку' : 'Выберите уровень подписки'}
        </h2>
        ${currentSubscription ? renderSubscriptionNotice(currentSubscription, tiers) : ''}
        <div class="subscription-modal__list">
          ${tiers.map(tier => {
    const isCurrent = currentSubscription?.tier_id === tier.tier_id;
    const canSelectCurrent = Boolean(
      isCurrent &&
      currentSubscription &&
      (currentSubscription.price_change_requires_resubscribe || currentSubscription.auto_renew === false)
    );
    const actionLabel = getTierActionLabel(isCurrent, canSelectCurrent, currentSubscription);
    const chatBadge = tier.chat_enabled
      ? `<span class="subscription-modal__chat-badge">${icons.chat}<span>Чат с тренером</span></span>`
      : '';
    const calendarBadge = tier.calendar_enabled
      ? `<span class="subscription-modal__chat-badge">${icons.calendar}<span>Запись в календарь</span></span>`
      : '';
    return `
              <div class="subscription-modal__tier ${isCurrent ? 'subscription-modal__tier--current' : ''}">
                <h3>${escapeHtml(tier.name)} (${formatMonthlyPrice(tier.price)})</h3>
                ${chatBadge}
                ${calendarBadge}
                <p>${escapeHtml(tier.description || 'Описание отсутствует')}</p>
                <button
                  class="button button--primary-orange button--small"
                  data-subscribe="${tier.tier_id}"
                  ${isCurrent && !canSelectCurrent ? 'disabled' : ''}
                >
                  ${actionLabel}
                </button>
              </div>
            `;
  }).join('')}
        </div>
        ${currentSubscription ? `
          <div class="subscription-modal__unsubscribe">
            ${currentSubscription.auto_renew ? `
              <p class="subscription-modal__unsubscribe-hint">
                Автопродление включено. После отмены доступ сохранится до конца оплаченного периода${formatPeriodEnd(currentSubscription)}.
              </p>
            ` : ''}
            ${currentSubscription.auto_renew ? '<button class="button button--text-orange button--small" data-unsubscribe>Отменить подписку</button>' : ''}
          </div>
        ` : ''}
      </div>
    `;
    document.body.appendChild(modal);
    const unregister = registerModal(() => modal.remove());

    modal.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', () => { unregister(); modal.remove(); })
    );

    // Выбор уровня → оплата через провайдер
    modal.querySelectorAll('[data-subscribe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tierId = Number((e.currentTarget as HTMLElement).dataset.subscribe);
        const button = e.currentTarget as HTMLButtonElement;
        const originalText = button.textContent || '';

        button.disabled = true;
        button.textContent = 'Перенаправление...';

        try {
          const origin = window.location.origin;
          const payment = await api.createSubscriptionPayment({
            trainer_id: trainerId,
            tier_id: tierId,
            return_url: `${origin}/payment/return`,
            cancel_url: `${origin}/payment/cancel`
          });

          if (payment.confirmation_url) {
            const confirmationUrl = getSafeRedirectUrl(payment.confirmation_url);
            if (!confirmationUrl) {
              throw new Error('Некорректная ссылка на оплату');
            }
            localStorage.setItem('sporteon_pending_payment', JSON.stringify({
              payment_id: payment.payment_id,
              confirmation_token: payment.confirmation_token
            }));
            modal.querySelector('.subscription-modal__panel')!.innerHTML = `
              <div class="subscription-modal__redirect">
                <div class="subscription-modal__redirect-spinner"></div>
                <p class="subscription-modal__redirect-text">Перенаправляем на страницу оплаты&hellip;</p>
              </div>
            `;
            setTimeout(() => {
              window.location.href = confirmationUrl;
            }, 600);
            return;
          }

          // Без confirmation_url — тестовый режим, считаем успехом
          modal.remove();
          if (onSubscribed) onSubscribed();
        } catch {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });

    // Отписка остаётся прямой (не через платёжного провайдера)
    const unsubscribeBtn = modal.querySelector('[data-unsubscribe]');
    if (unsubscribeBtn && currentSubscription) {
      unsubscribeBtn.addEventListener('click', async () => {
        const btn = unsubscribeBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = 'Отписка...';
        try {
          await api.cancelSubscription(currentSubscription.subscription_id);
          modal.remove();
          if (onSubscribed) onSubscribed();
        } catch {
          btn.disabled = false;
          btn.textContent = 'Отменить подписку';
        }
      });
    }
  }
}

function getTierActionLabel(isCurrent: boolean, canSelectCurrent: boolean, currentSubscription?: Subscription | null): string {
  if (!currentSubscription) return 'Выбрать';
  if (!isCurrent) return 'Сменить';
  if (!canSelectCurrent) return 'Текущий уровень';
  if (currentSubscription.price_change_requires_resubscribe) return 'Принять цену';
  return 'Возобновить';
}

function renderSubscriptionNotice(subscription: Subscription, tiers: Tier[]): string {
  if (subscription.price_change_requires_resubscribe) {
    const currentTier = tiers.find(tier => tier.tier_id === subscription.tier_id);
    const newPrice = currentTier ? ` Новая цена: ${formatMonthlyPrice(currentTier.price)}.` : '';
    return `
      <div class="subscription-modal__notice subscription-modal__notice--warning">
        Цена тарифа изменилась. Следующего списания не будет; доступ сохранится${formatAccessUntil(subscription)}.${newPrice}
        Чтобы продолжить, выберите тариф заново.
      </div>
    `;
  }

  if (subscription.auto_renew === false) {
    return `
      <div class="subscription-modal__notice">
        Автопродление выключено; доступ сохранится${formatAccessUntil(subscription)}.
      </div>
    `;
  }

  return '';
}

function formatPeriodEnd(subscription: Subscription): string {
  const raw = subscription.current_period_end || subscription.expires_at;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return ` (до ${date.toLocaleDateString('ru-RU')})`;
}

function formatAccessUntil(subscription: Subscription): string {
  const raw = subscription.current_period_end || subscription.expires_at;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return ` до ${date.toLocaleDateString('ru-RU')}`;
}

function getSafeRedirectUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}
