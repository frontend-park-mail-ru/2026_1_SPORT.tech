import './PaymentReturnPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse, PaymentResponse } from '../../types/api.types';
import { escapeHtml, formatMonthlyPrice } from '../../utils/profilePageData';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import { emitSubscriptionsChanged } from '../../components/organisms/Sidebar/Sidebar';
import { icons } from '../../utils/icons';

interface PaymentReturnPageParams {
  currentUser?: AuthResponse | null;
  onLogout?: (() => Promise<void>) | null;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === 'RUB' ? '₽' : currency;
  return `${amount.toLocaleString('ru-RU')} ${symbol}`;
}

function renderProcessing(el: HTMLElement): void {
  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__spinner"></div>
      <h1 class="payment-result__title">Подтверждаем оплату</h1>
      <p class="payment-result__subtitle">Пожалуйста, подождите…</p>
    </div>
  `;
}

async function renderSuccess(
  el: HTMLElement,
  payment: PaymentResponse,
  navigateTo: (p: string) => void,
  api: ApiClient
): Promise<void> {
  const isSubscription = !!payment.subscription;
  const trainerId = isSubscription
    ? payment.subscription!.trainer_id
    : payment.recipient_user_id;

  let details = '';
  if (isSubscription) {
    const sub = payment.subscription!;
    const expires = sub.expires_at
      ? new Date(sub.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    details = `
      <div class="payment-result__sub-info">
        <p class="payment-result__sub-tier">Тариф: <strong>${escapeHtml(sub.tier_name)}</strong></p>
        <p class="payment-result__sub-price">${escapeHtml(formatMonthlyPrice(sub.price))}</p>
        ${expires ? `<p class="payment-result__sub-expires">Активна до: ${escapeHtml(expires)}</p>` : ''}
      </div>
    `;
  } else {
    const amountStr = formatAmount(payment.amount_value, payment.currency || 'RUB');
    details = `
      <div class="payment-result__amount">${escapeHtml(amountStr)}</div>
      <p class="payment-result__message">${escapeHtml(payment.message || 'Спасибо за поддержку!')}</p>
    `;
  }

  // Определяем, включён ли чат в купленном тире подписки
  let chatEnabled = false;
  if (isSubscription && trainerId && payment.subscription?.tier_id) {
    try {
      const tiersResp = await api.getTrainerTiers(trainerId);
      const tier = (tiersResp?.tiers || []).find(t => t.tier_id === payment.subscription!.tier_id);
      chatEnabled = tier?.chat_enabled ?? false;
    } catch { /* игнорируем */ }
  }

  const chatBtn = chatEnabled && trainerId
    ? `<button class="payment-result__btn payment-result__btn--secondary payment-result__btn--with-icon" id="btn-chat">${icons.chat}<span>Написать тренеру</span></button>`
    : '';

  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__icon payment-result__icon--success">${icons.successCircle}</div>
      <h1 class="payment-result__title">${isSubscription ? 'Подписка оформлена!' : 'Оплата прошла!'}</h1>
      ${details}
      ${chatEnabled ? '<p class="payment-result__chat-hint">Ваша подписка включает чат с тренером — напишите ему прямо сейчас!</p>' : ''}
      <div class="payment-result__actions">
        <button class="payment-result__btn payment-result__btn--primary" id="btn-home">На главную</button>
        ${trainerId ? '<button class="payment-result__btn payment-result__btn--secondary" id="btn-profile">Профиль тренера</button>' : ''}
        ${chatBtn}
      </div>
    </div>
  `;
  el.querySelector('#btn-home')?.addEventListener('click', () => navigateTo('/'));
  if (trainerId) {
    el.querySelector('#btn-profile')?.addEventListener('click', () =>
      navigateTo(`/profile/${trainerId}`)
    );
    if (chatEnabled) {
      el.querySelector('#btn-chat')?.addEventListener('click', () =>
        navigateTo(`/chat/${trainerId}`)
      );
    }
  }
}

function renderError(el: HTMLElement, message: string, navigateTo: (p: string) => void): void {
  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__icon payment-result__icon--error">${icons.errorCircle}</div>
      <h1 class="payment-result__title">Ошибка оплаты</h1>
      <p class="payment-result__message">${escapeHtml(message)}</p>
      <div class="payment-result__actions">
        <button class="payment-result__btn payment-result__btn--primary" id="btn-home">На главную</button>
        <button class="payment-result__btn payment-result__btn--secondary" id="btn-back">Назад</button>
      </div>
    </div>
  `;
  el.querySelector('#btn-home')?.addEventListener('click', () => navigateTo('/'));
  el.querySelector('#btn-back')?.addEventListener('click', () => history.back());
}

export async function renderPaymentReturnPage(
  api: ApiClient,
  container: HTMLElement,
  params: PaymentReturnPageParams
): Promise<void> {
  void params; // sidebar managed by main.ts

  const template = (window as any).Handlebars.templates['PaymentReturnPage.hbs'];
  container.innerHTML = template({}).trim();

  const resultEl = container.querySelector('#payment-result') as HTMLElement;

  renderProcessing(resultEl);

  const navigateTo = (path: string): void => window.router.navigateTo(path);

  // Сначала пробуем URL-параметры, иначе берём из localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let paymentIdStr = urlParams.get('payment_id');
  let confirmationToken = urlParams.get('confirmation_token');

  if (!paymentIdStr || !confirmationToken) {
    try {
      const stored = localStorage.getItem('sporteon_pending_payment');
      if (stored) {
        const parsed = JSON.parse(stored) as { payment_id?: number; confirmation_token?: string };
        if (parsed.payment_id) paymentIdStr = String(parsed.payment_id);
        if (parsed.confirmation_token) confirmationToken = parsed.confirmation_token;
      }
    } catch {
      // ignore parse errors
    }
  }

  if (!paymentIdStr || !confirmationToken) {
    renderError(resultEl, 'Параметры оплаты не найдены. Попробуйте снова или обратитесь в поддержку.', navigateTo);
    return;
  }

  const paymentId = Number(paymentIdStr);
  if (!Number.isFinite(paymentId)) {
    renderError(resultEl, 'Неверный идентификатор платежа.', navigateTo);
    return;
  }

  try {
    const payment = await api.confirmPayment(paymentId, confirmationToken);
    localStorage.removeItem('sporteon_pending_payment');
    if (payment.subscription) {
      emitSubscriptionsChanged();
    }
    await renderSuccess(resultEl, payment, navigateTo, api);
  } catch (error: unknown) {
    const err = error as { message?: string; data?: { error?: { message?: string } } };
    const msg = getFriendlyErrorMessage(err.data?.error?.message || err.message, 'Не удалось подтвердить платёж. Попробуйте позже.');
    renderError(resultEl, msg, navigateTo);
  }
}
