import './PaymentReturnPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse, PaymentResponse } from '../../types/api.types';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';
import { formatMonthlyPrice } from '../../utils/profilePageData';

interface PaymentReturnPageParams {
  currentUser?: AuthResponse | null;
  onLogout?: (() => Promise<void>) | null;
}

function formatAmount(kopecks: number, currency: string): string {
  const roubles = kopecks / 100;
  const symbol = currency === 'RUB' ? '₽' : currency;
  return `${roubles.toLocaleString('ru-RU')} ${symbol}`;
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

function renderSuccess(el: HTMLElement, payment: PaymentResponse, navigateTo: (p: string) => void): void {
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
        <p class="payment-result__sub-tier">Тариф: <strong>${sub.tier_name}</strong></p>
        <p class="payment-result__sub-price">${formatMonthlyPrice(sub.price)}</p>
        ${expires ? `<p class="payment-result__sub-expires">Активна до: ${expires}</p>` : ''}
      </div>
    `;
  } else {
    const amountStr = formatAmount(payment.amount_value, payment.currency || 'RUB');
    details = `
      <div class="payment-result__amount">${amountStr}</div>
      <p class="payment-result__message">${payment.message || 'Спасибо за поддержку!'}</p>
    `;
  }

  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__icon payment-result__icon--success">✓</div>
      <h1 class="payment-result__title">${isSubscription ? 'Подписка оформлена!' : 'Оплата прошла!'}</h1>
      ${details}
      <div class="payment-result__actions">
        <button class="payment-result__btn payment-result__btn--primary" id="btn-home">На главную</button>
        ${trainerId ? '<button class="payment-result__btn payment-result__btn--secondary" id="btn-profile">Профиль тренера</button>' : ''}
      </div>
    </div>
  `;
  el.querySelector('#btn-home')?.addEventListener('click', () => navigateTo('/'));
  if (trainerId) {
    el.querySelector('#btn-profile')?.addEventListener('click', () =>
      navigateTo(`/profile/${trainerId}`)
    );
  }
}

function renderError(el: HTMLElement, message: string, navigateTo: (p: string) => void): void {
  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__icon payment-result__icon--error">✗</div>
      <h1 class="payment-result__title">Ошибка оплаты</h1>
      <p class="payment-result__message">${message}</p>
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
  const { currentUser = null, onLogout = null } = params;

  const template = (window as any).Handlebars.templates['PaymentReturnPage.hbs'];
  container.innerHTML = template({}).trim();

  const sidebarContainer = container.querySelector('#sidebar-container') as HTMLElement;
  const resultEl = container.querySelector('#payment-result') as HTMLElement;

  const currentUserData = currentUser?.user;
  const fullName = currentUserData
    ? `${currentUserData.first_name} ${currentUserData.last_name}`.trim() || currentUserData.username
    : '';

  await renderSidebar(sidebarContainer, {
    activePage: '',
    currentUser: currentUserData ? {
      id: currentUserData.user_id,
      name: fullName,
      role: currentUserData.is_trainer ? 'Тренер' : 'Пользователь',
      avatar: currentUserData.avatar_url
    } : null,
    api,
    onLogout
  });

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
    renderSuccess(resultEl, payment, navigateTo);
  } catch (error: unknown) {
    const err = error as { message?: string; data?: { error?: { message?: string } } };
    const msg = err.data?.error?.message || err.message || 'Не удалось подтвердить платёж.';
    renderError(resultEl, msg, navigateTo);
  }
}
