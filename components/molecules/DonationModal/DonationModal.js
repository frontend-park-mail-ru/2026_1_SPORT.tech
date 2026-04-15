/**
 * @fileoverview Модальное окно пожертвования (оверлей поверх приложения)
 * @module components/molecules/DonationModal
 */

import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.js';
import { Validator } from '/src/utils/validator.js';

/**
 * Показывает модальное окно пожертвования
 * @async
 * @param {Object} options
 * @param {import('/src/utils/api.js').ApiClient} options.api - Клиент API
 * @param {number} options.recipientUserId - ID получателя (тренера)
 * @returns {Promise<void>}
 */


export async function openDonationModal({ api, recipientUserId }) {
  const template = Handlebars.templates['DonationModal.hbs'];
  const root = document.createElement('div');
  root.innerHTML = template({}).trim();
  const modal = root.firstElementChild;

  const form = modal.querySelector('.donation-modal__form');
  const amountHost = modal.querySelector('#donation-field-amount');
  const emailHost = modal.querySelector('#donation-field-email');
  const globalErr = modal.querySelector('[data-donation-global-error]');
  const submitBtn = modal.querySelector('.donation-modal__cta');
  const validator = new Validator();

  const amountApi = await renderInput(amountHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Сумма (Российский Рубль)',
    placeholder: 'Введите сумму',
    name: 'amount',
    required: true,
    onChange: () => amountApi.setNormal()
  });

  const emailApi = await renderInput(emailHost, {
    type: INPUT_TYPES.MAIL,
    label: 'Почта для чека',
    placeholder: 'Введите почту',
    name: 'email',
    required: true,
    autocomplete: 'email',
    onChange: () => emailApi.setNormal()
  });

  const close = () => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = e => {
    if (e.key === 'Escape') close();
  };

  modal.querySelectorAll('[data-donation-close]').forEach(el => {
    el.addEventListener('click', close);
  });



form.addEventListener('submit', async e => {
  e.preventDefault();
  globalErr.hidden = true;
  globalErr.textContent = '';

  const amountStr = amountApi.getValue();
  const email = emailApi.getValue();

  console.log('🔍 [DonationModal] Step 1 - Raw input:', { amountStr, email });

  const result = validator.validateDonationForm({ amount: amountStr, email });
  console.log('🔍 [DonationModal] Step 2 - Validation result:', {
    isValid: result.isValid,
    amountNumber: result.amountNumber,
    errors: result.errors
  });

  if (!result.isValid) {
    result.errors.forEach(err => {
      if (err.field === 'amount') amountApi.setError(err.message);
      if (err.field === 'email') emailApi.setError(err.message);
    });
    return;
  }

  submitBtn.disabled = true;
  try {
    const amountInCents = Math.round(result.amountNumber * 100);

    console.log('🔍 [DonationModal] Step 3 - Prepared data:', {
      recipientUserId,
      amountInCents,
      originalAmount: result.amountNumber,
      currency: 'RUB',
      message: ''
    });

    const response = await api.createDonation(
  recipientUserId,
  amountInCents,
  'RUB',
  'Пожертвование'
);

    console.log('✅ [DonationModal] Step 4 - Success response:', response);
    close();
  } catch (error) {
    console.error('❌ [DonationModal] Step 4 - Error:', {
      message: error.message,
      data: error.data,
      status: error.status,
      fullError: error
    });

    let errorMessage = 'Не удалось отправить данные.';
    if (error.data?.error?.message) {
      errorMessage = error.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    globalErr.textContent = errorMessage;
    globalErr.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true });
  amountApi.focus();
}
