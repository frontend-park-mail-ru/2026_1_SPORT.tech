/**
 * @fileoverview Модальное окно создания и редактирования поста
 * @module components/molecules/PostFormModal
 */

import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button.ts';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.ts';
import { Validator } from '/src/utils/validator.ts';

/**
 * Открывает форму поста
 * @async
 * @param {Object} options
 * @param {import('/src/utils/api.ts').ApiClient} options.api - API
 * @param {'create'|'edit'} options.mode - Режим
 * @param {number} [options.postId] - ID поста для редактирования
 * @param {{ title?: string, text_content?: string }} [options.initial] - Начальные значения
 * @param {Function} [options.onSaved] - Вызывается после успешного сохранения
 * @returns {Promise<void>}
 */
export async function openPostFormModal({
  api,
  mode,
  postId,
  initial = {},
  onSaved
}) {
  const template = Handlebars.templates['PostFormModal.hbs'];
  const modalTitle = mode === 'edit' ? 'Изменить публикацию' : 'Новая публикация';

  const root = document.createElement('div');
  root.innerHTML = template({ modalTitle }).trim();
  const modal = root.firstElementChild;

  const form = modal.querySelector('.post-form-modal__form');
  const titleHost = modal.querySelector('#post-form-title-field');
  const bodyInput = modal.querySelector('#post-form-body-input');
  const bodyErr = modal.querySelector('[data-post-body-error]');
  const globalErr = modal.querySelector('[data-post-form-global-error]');
  const cancelWrap = modal.querySelector('#post-form-cancel-wrap');
  const submitWrap = modal.querySelector('#post-form-submit-wrap');
  const validator = new Validator();

  const titleApi = await renderInput(titleHost, {
    type: INPUT_TYPES.WITHOUTS,
    label: 'Заголовок',
    placeholder: 'Введите заголовок',
    name: 'title',
    value: initial.title || '',
    required: true,
    maxlength: 200,
    onChange: () => titleApi.setNormal()
  });

  const textContent = initial.text_content || initial.raw_text || '';
if (textContent) {
  bodyInput.value = textContent;
}

  /**
   * @param {string} msg
   */
  const setBodyError = msg => {
    if (!msg) {
      bodyErr.hidden = true;
      bodyErr.textContent = '';
      bodyInput.classList.remove('post-form-modal__textarea--error');
      return;
    }
    bodyErr.hidden = false;
    bodyErr.textContent = msg;
    bodyInput.classList.add('post-form-modal__textarea--error');
  };

  bodyInput.addEventListener('input', () => setBodyError(''));

  /**
   * @param {KeyboardEvent} e
   */
  function onKey(e) {
    if (e.key === 'Escape') {
      close();
    }
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  }

  await renderButton(cancelWrap, {
  text: 'Отмена',
  variant: BUTTON_VARIANTS.TEXT_ORANGE,
  size: BUTTON_SIZES.MEDIUM,
  type: 'button',
  onClick: () => close()
});

const saveBtn = await renderButton(submitWrap, {
  text: mode === 'edit' ? 'Сохранить' : 'Опубликовать',
  variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
  size: BUTTON_SIZES.MEDIUM,
  type: 'submit'
});

  modal.querySelectorAll('[data-post-form-close]').forEach(el => {
    el.addEventListener('click', close);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    globalErr.hidden = true;
    globalErr.textContent = '';
    setBodyError('');

    const title = titleApi.getValue();
    const text_content = bodyInput.value;

    const validation = validator.validatePostEditor({ title, text_content });
    if (!validation.isValid) {
      validation.errors.forEach(err => {
        if (err.field === 'title') {
          titleApi.setError(err.message);
        }
        if (err.field === 'text_content') {
          setBodyError(err.message);
        }
      });
      return;
    }

    saveBtn.setDisabled(true);
    try {
      const payload = {
        title: title.trim(),
        text_content: text_content.trim()
      };

      if (mode === 'edit' && postId != null) {
        await api.updatePost(postId, payload);
      } else {
        await api.createPost(payload);
      }

      onSaved?.();
      close();
    } catch (error) {
      globalErr.textContent = error.message || 'Не удалось сохранить публикацию';
      globalErr.hidden = false;
    } finally {
      saveBtn.setDisabled(false);
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true });
  titleApi.focus();
}
