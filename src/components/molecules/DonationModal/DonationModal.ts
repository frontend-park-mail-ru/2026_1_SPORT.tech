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
  // Проверка: нельзя донатить самому себе
  try {
    const currentUser = await api.getCurrentUser();
    if (currentUser?.user?.user_id === recipientUserId) {
      alert('Нельзя отправить пожертвование самому себе.');
      return;
    }
  } catch {
    // если не удалось получить пользователя, всё равно откроем окно,
    // бэкенд сам вернёт ошибку при попытке задонатить себе
  }

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
    onChange: (value: string) => {
      // Живая валидация суммы: от 1 до 1 000 000 ₽
      const parsed = Validator.parseDonationAmount(value);
      if (value.trim() === '') {
        amountApi.setNormal();   // пустое поле не ругаем сразу
        return;
      }
      if (parsed === null) {
        amountApi.setError('Введите корректную сумму');
      } else if (parsed <= 0) {
        amountApi.setError('Сумма должна быть больше нуля');
      } else if (parsed > 1_000_000) {
        amountApi.setError('Сумма не может превышать 1 000 000 ₽');
      } else {
        amountApi.setNormal();
      }
    }
  });

  const emailApi: InputAPI = await renderInput(emailHost, {
    type: INPUT_TYPES.MAIL,
    label: 'Почта для чека',
    placeholder: 'Введите почту',
    name: 'email',
    required: true,
    autocomplete: 'email',
    onChange: (value: string) => {
      // Живая валидация email
      validator.reset();
      validator.validateField(value, 'email', validator.rules.receipt_email);
      if (validator.hasErrors()) {
        emailApi.setError(validator.getErrors()[0].message);
      } else {
        emailApi.setNormal();
      }
    }
  });

  // Поле «Сообщение» (опционально)
  const messageContainer = document.createElement('div');
  messageContainer.className = 'donation-modal__field';
  messageContainer.id = 'donation-field-message';
  // Вставляем перед кнопкой отправки внутри её родительского элемента
  submitBtn.parentNode!.insertBefore(messageContainer, submitBtn);

  const messageApi: InputAPI = await renderInput(messageContainer, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сообщение (необязательно)',
    placeholder: 'Ваше сообщение получателю',
    name: 'message',
    required: false,
    maxlength: 500,
    onChange: (value: string) => {
      // Живая проверка длины
      if (value.length > 500) {
        messageApi.setError('Максимум 500 символов');
      } else {
        messageApi.setNormal();
      }
    }
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
    const email = emailApi.getValue().trim();
    const message = messageApi.getValue().trim();

    const result = validator.validateDonationForm({
      amount: amountStr,
      email,
      message
    });

    if (!result.isValid) {
      result.errors.forEach((err: { field: string; message: string }) => {
        if (err.field === 'amount') amountApi.setError(err.message);
        if (err.field === 'email') emailApi.setError(err.message);
        if (err.field === 'message') messageApi.setError(err.message);
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
      // Сумма передаётся в целых рублях (int32)
      const amountValue = Math.round(result.amountNumber || 0);
      await api.createDonation(
        recipientUserId,
        amountValue,
        'RUB',
        message || 'Пожертвование'
      );

      // Успех
      amountApi.setValue('');
      emailApi.setValue('');
      messageApi.setValue('');

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
          Ваше пожертвование в размере <strong>${amountValue} ₽</strong> успешно отправлено.
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
