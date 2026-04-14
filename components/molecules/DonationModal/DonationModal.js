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

  /**
   * Закрыть модальное окно и снять обработчики
   */
  const close = () => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  /**
   * @param {KeyboardEvent} e
   */
  const onKey = e => {
    if (e.key === 'Escape') {
      close();
    }
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

    const result = validator.validateDonationForm({ amount: amountStr, email });

    if (!result.isValid) {
      result.errors.forEach(err => {
        if (err.field === 'amount') {
          amountApi.setError(err.message);
        }
        if (err.field === 'email') {
          emailApi.setError(err.message);
        }
      });
      return;
    }

    submitBtn.disabled = true;
    try {
      await api.createDonation({
        amount_rub: result.amountNumber,
        email,
        recipient_user_id: recipientUserId
      });
      close();
    } catch (error) {
      globalErr.textContent =
        error.message ||
        'Не удалось отправить данные. Проверьте соединение или попробуйте позже.';
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
