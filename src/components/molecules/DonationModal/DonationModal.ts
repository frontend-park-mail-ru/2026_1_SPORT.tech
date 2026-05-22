import type { ApiClient } from '../../../utils/api';
import type { InputAPI } from '../../atoms/Input/Input';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { Validator } from '../../../utils/validator';

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
    placeholder: 'Например, 500',
    name: 'amount',
    required: true,
    onChange: () => amountApi.setNormal()
  });

  const messageApi: InputAPI = await renderInput(messageHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сообщение тренеру (необязательно)',
    placeholder: 'Напишите что-нибудь приятное',
    name: 'message',
    required: false,
    onChange: () => messageApi.setNormal()
  });

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
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
      const amountInKopecks = Math.round((result.amountNumber || 0) * 100);
      const message = messageApi.getValue().trim() || 'Пожертвование';
      const origin = window.location.origin;

      const payment = await api.createDonationPayment({
        user_id: recipientUserId,
        amount_value: amountInKopecks,
        currency: 'RUB',
        message,
        return_url: `${origin}/payment/return`,
        cancel_url: `${origin}/payment/cancel`
      });

      if (payment.confirmation_url) {
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
          window.location.href = payment.confirmation_url;
        }, 800);
        return;
      }

      // Если confirmation_url нет — считаем успехом (тестовый режим)
      showSuccess(form, submitBtn, result.amountNumber || 0, close);
    } catch (error: unknown) {
      const err = error as { message?: string; data?: { error?: { message?: string } } };
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;

      let errorMessage = 'Не удалось создать платёж. Попробуйте ещё раз.';
      if (err.data?.error?.message) errorMessage = err.data.error.message;
      else if (err.message) errorMessage = err.message;

      globalErr.textContent = errorMessage;
      globalErr.hidden = false;
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true } as FocusOptions);
  amountApi.focus();
}

function showSuccess(form: HTMLFormElement, submitBtn: HTMLButtonElement, amount: number, close: () => void): void {
  form.querySelectorAll('.donation-modal__field').forEach(field => {
    (field as HTMLElement).style.display = 'none';
  });
  submitBtn.style.display = 'none';

  const successMessage = document.createElement('div');
  successMessage.className = 'donation-modal__success';
  successMessage.innerHTML = `
    <div class="donation-modal__success-icon">✓</div>
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
