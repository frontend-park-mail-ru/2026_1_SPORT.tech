import './PaymentReturnPage.css';
import type { ApiClient } from '../../utils/api';
import type { AuthResponse, PaymentResponse } from '../../types/api.types';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';

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
  const amountStr = formatAmount(payment.amount_value, payment.currency || 'RUB');
  el.innerHTML = `
    <div class="payment-result">
      <div class="payment-result__icon payment-result__icon--success">✓</div>
      <h1 class="payment-result__title">Оплата прошла!</h1>
      <div class="payment-result__amount">${amountStr}</div>
      <p class="payment-result__message">${payment.message || 'Спасибо за поддержку!'}</p>
      <div class="payment-result__actions">
        <button class="payment-result__btn payment-result__btn--primary" id="btn-home">На главную</button>
        ${payment.recipient_user_id ? `<button class="payment-result__btn payment-result__btn--secondary" id="btn-profile">Профиль тренера</button>` : ''}
      </div>
    </div>
  `;
  el.querySelector('#btn-home')?.addEventListener('click', () => navigateTo('/'));
  if (payment.recipient_user_id) {
    el.querySelector('#btn-profile')?.addEventListener('click', () =>
      navigateTo(`/profile/${payment.recipient_user_id}`)
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

  // Парсим параметры из URL
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIdStr = urlParams.get('payment_id');
  const confirmationToken = urlParams.get('confirmation_token');

  if (!paymentIdStr || !confirmationToken) {
    renderError(resultEl, 'Неверная ссылка возврата. Параметры оплаты не найдены.', navigateTo);
    return;
  }

  const paymentId = Number(paymentIdStr);
  if (!Number.isFinite(paymentId)) {
    renderError(resultEl, 'Неверный идентификатор платежа.', navigateTo);
    return;
  }

  try {
    const payment = await api.confirmDonationPayment(paymentId, confirmationToken);
    renderSuccess(resultEl, payment, navigateTo);
  } catch (error: unknown) {
    const err = error as { message?: string; data?: { error?: { message?: string } } };
    const msg = err.data?.error?.message || err.message || 'Не удалось подтвердить платёж.';
    renderError(resultEl, msg, navigateTo);
  }
}
