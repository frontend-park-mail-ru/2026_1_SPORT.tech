import type { ApiClient } from '../../../utils/api';
import type { InputAPI } from '../../atoms/Input/Input';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { MIN_DONATION_AMOUNT_RUB, MAX_DONATION_AMOUNT_RUB, Validator } from '../../../utils/validator';
import { getFriendlyErrorMessage } from '../../../utils/errorMessages';
import { icons } from '../../../utils/icons';
import { closeAllModals, registerModal } from '../../../utils/modals';

export interface DonationModalOptions {
  api: ApiClient;
  recipientUserId: number;
}

export async function openDonationModal({
  api,
  recipientUserId
}: DonationModalOptions): Promise<void> {
  const template = (window as any).Handlebars.templates['DonationModal.hbs'];
  const root = document.createElement('div');
  root.innerHTML = template({}).trim();
  const modal = root.firstElementChild as HTMLElement;

  const form = modal.querySelector('.donation-modal__form') as HTMLFormElement;
  const amountHost = modal.querySelector('#donation-field-amount') as HTMLElement;
  const messageHost = modal.querySelector('#donation-field-message') as HTMLElement;
  const globalErr = modal.querySelector('[data-donation-global-error]') as HTMLElement;
  const submitBtn = modal.querySelector('.donation-modal__cta') as HTMLButtonElement;
  const validator = new Validator();

  const amountApi: InputAPI = await renderInput(amountHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сумма (₽)',
    placeholder: `От ${MIN_DONATION_AMOUNT_RUB}`,
    name: 'amount',
    required: true,
    message: `Минимальная сумма — ${MIN_DONATION_AMOUNT_RUB} ₽`,
    onChange: () => amountApi.setNormal()
  });
  amountApi.input.inputMode = 'numeric';
  amountApi.input.min = String(MIN_DONATION_AMOUNT_RUB);
  amountApi.input.max = String(MAX_DONATION_AMOUNT_RUB);

  const messageApi: InputAPI = await renderInput(messageHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сообщение тренеру (необязательно)',
    placeholder: 'Напишите что-нибудь приятное',
    name: 'message',
    required: false,
    onChange: () => messageApi.setNormal()
  });

  let unregister: (() => void) | null = null;
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    if (unregister) unregister();
    modal.remove();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };

  modal.querySelectorAll('[data-donation-close]').forEach(el => {
    el.addEventListener('click', close);
  });

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    globalErr.hidden = true;
    globalErr.textContent = '';

    const amountStr = amountApi.getValue();
    const result = validator.validateDonationPaymentForm({ amount: amountStr });

    if (!result.isValid) {
      result.errors.forEach((err: { field: string; message: string }) => {
        if (err.field === 'amount') amountApi.setError(err.message);
      });
      return;
    }

    submitBtn.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.textContent = 'Перенаправление...';

    try {
      const amountValue = Math.round(result.amountNumber || 0);
      const message = messageApi.getValue().trim() || 'Пожертвование';
      const origin = window.location.origin;

      const payment = await api.createDonationPayment({
        user_id: recipientUserId,
        amount_value: amountValue,
        currency: 'RUB',
        message,
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
        // Показываем сообщение об уходе на страницу оплаты
        form.innerHTML = `
          <div class="donation-modal__redirect">
            <div class="donation-modal__redirect-spinner"></div>
            <p class="donation-modal__redirect-text">
              Перенаправляем вас на страницу оплаты&hellip;
            </p>
            <p class="donation-modal__redirect-hint">
              Сумма: <strong>${result.amountNumber} ₽</strong>
            </p>
          </div>
        `;
        // Небольшая задержка чтобы пользователь увидел сообщение
        setTimeout(() => {
          window.location.href = confirmationUrl;
        }, 800);
        return;
      }

      // Если confirmation_url нет — считаем успехом (тестовый режим)
      showSuccess(form, submitBtn, result.amountNumber || 0, close);
    } catch (error: unknown) {
      const err = error as { message?: string; data?: { error?: { message?: string } } };
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;

      const errorMessage = getFriendlyErrorMessage(
        err.data?.error?.message || err.message,
        'Не удалось создать платёж. Попробуйте ещё раз.'
      );

      globalErr.textContent = errorMessage;
      globalErr.hidden = false;
    }
  });

  closeAllModals();
  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  unregister = registerModal(close);
  modal.focus({ preventScroll: true } as FocusOptions);
  amountApi.focus();
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

function showSuccess(form: HTMLFormElement, submitBtn: HTMLButtonElement, amount: number, close: () => void): void {
  form.querySelectorAll('.donation-modal__field').forEach(field => {
    (field as HTMLElement).style.display = 'none';
  });
  submitBtn.style.display = 'none';

  const successMessage = document.createElement('div');
  successMessage.className = 'donation-modal__success';
  successMessage.innerHTML = `
    <div class="donation-modal__success-icon">${icons.successCircle}</div>
    <h3 class="donation-modal__success-title">Спасибо!</h3>
    <p class="donation-modal__success-text">
      Ваше пожертвование в размере <strong>${amount} ₽</strong> успешно отправлено.
    </p>
    <button class="donation-modal__success-btn" type="button">Закрыть</button>
  `;
  form.appendChild(successMessage);
  successMessage.querySelector('.donation-modal__success-btn')?.addEventListener('click', close);
  setTimeout(close, 3000);
}
