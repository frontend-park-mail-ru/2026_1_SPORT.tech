/**
 * @fileoverview Модальное окно пожертвования (оверлей поверх приложения)
 * @module components/molecules/DonationModal
 */

import type { ApiClient } from '../../../utils/api';
import type { InputAPI } from '../../atoms/Input/Input';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { Validator } from '../../../utils/validator';

export interface DonationModalOptions {
  api: ApiClient;
  recipientUserId: number;
}

/**
 * Показывает модальное окно пожертвования
 */
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
  const emailHost = modal.querySelector('#donation-field-email') as HTMLElement;
  const globalErr = modal.querySelector('[data-donation-global-error]') as HTMLElement;
  const submitBtn = modal.querySelector('.donation-modal__cta') as HTMLButtonElement;
  const validator = new Validator();

  const amountApi: InputAPI = await renderInput(amountHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сумма (Российский Рубль)',
    placeholder: 'Введите сумму',
    name: 'amount',
    required: true,
    onChange: () => amountApi.setNormal()
  });

  const emailApi: InputAPI = await renderInput(emailHost, {
    type: INPUT_TYPES.MAIL,
    label: 'Почта для чека',
    placeholder: 'Введите почту',
    name: 'email',
    required: true,
    autocomplete: 'email',
    onChange: () => emailApi.setNormal()
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
    const email = emailApi.getValue();

    const result = validator.validateDonationForm({ amount: amountStr, email });

    if (!result.isValid) {
      result.errors.forEach((err: { field: string; message: string }) => {
        if (err.field === 'amount') amountApi.setError(err.message);
        if (err.field === 'email') emailApi.setError(err.message);
      });
      return;
    }

    submitBtn.disabled = true;

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span class="donation-modal__cta-text">Отправка...</span>
      <span class="donation-modal__sbp" aria-hidden="true">
        <span class="donation-modal__sbp-icon"></span>
        <span class="donation-modal__sbp-label">сбп система быстрых платежей</span>
      </span>
    `;

    try {
      const amountInCents = Math.round((result.amountNumber || 0) * 100);

      await api.createDonation(
        recipientUserId,
        amountInCents,
        'RUB',
        'Пожертвование'
      );

      // Успех
      amountApi.setValue('');
      emailApi.setValue('');

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
          Ваше пожертвование в размере <strong>${result.amountNumber} ₽</strong> успешно отправлено.
        </p>
        <button class="donation-modal__success-btn" type="button">Закрыть</button>
      `;

      form.appendChild(successMessage);

      const successBtn = successMessage.querySelector('.donation-modal__success-btn');
      if (successBtn) {
        successBtn.addEventListener('click', () => {
          close();
        });
      }

      setTimeout(() => {
        close();
      }, 3000);

    } catch (error: unknown) {
      const err = error as { message?: string; data?: { error?: { message?: string } } };
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;

      form.querySelectorAll('.donation-modal__field').forEach(field => {
        (field as HTMLElement).style.display = 'block';
      });

      let errorMessage = 'Не удалось отправить данные.';
      if (err.data?.error?.message) {
        errorMessage = err.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      globalErr.textContent = errorMessage;
      globalErr.hidden = false;
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true } as FocusOptions);
  amountApi.focus();
}
