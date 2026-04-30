/**
 * @fileoverview Модальное окно создания и редактирования поста
 * @module components/molecules/PostFormModal
 */

import type { ApiClient } from '../../../utils/api';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { InputAPI } from '../../atoms/Input/Input';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { Validator } from '../../../utils/validator';

export interface PostFormModalOptions {
  api: ApiClient;
  mode: 'create' | 'edit';
  postId?: number;
  initial?: {
    title?: string;
    text_content?: string;
    raw_text?: string;
  };
  onSaved?: (() => void) | null;
}

/**
 * Открывает форму поста
 */
export async function openPostFormModal({
  api,
  mode,
  postId,
  initial = {},
  onSaved
}: PostFormModalOptions): Promise<void> {
  const template = (window as any).Handlebars.templates['PostFormModal.hbs'];
  const modalTitle = mode === 'edit' ? 'Изменить публикацию' : 'Новая публикация';

  const root = document.createElement('div');
  root.innerHTML = template({ modalTitle }).trim();
  const modal = root.firstElementChild as HTMLElement;

  const form = modal.querySelector('.post-form-modal__form') as HTMLFormElement;
  const titleHost = modal.querySelector('#post-form-title-field') as HTMLElement;
  const bodyInput = modal.querySelector('#post-form-body-input') as HTMLTextAreaElement;
  const bodyErr = modal.querySelector('[data-post-body-error]') as HTMLElement;
  const globalErr = modal.querySelector('[data-post-form-global-error]') as HTMLElement;
  const cancelWrap = modal.querySelector('#post-form-cancel-wrap') as HTMLElement;
  const submitWrap = modal.querySelector('#post-form-submit-wrap') as HTMLElement;
  const validator = new Validator();

  const titleApi: InputAPI = await renderInput(titleHost, {
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

  const setBodyError = (msg: string | null): void => {
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

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
    }
  }

  function close(): void {
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

  const saveBtn: ButtonAPI = await renderButton(submitWrap, {
    text: mode === 'edit' ? 'Сохранить' : 'Опубликовать',
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'submit'
  });

  modal.querySelectorAll('[data-post-form-close]').forEach(el => {
    el.addEventListener('click', close);
  });

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    globalErr.hidden = true;
    globalErr.textContent = '';
    setBodyError('');

    const title = titleApi.getValue();
    const text_content = bodyInput.value;

    const validation = validator.validatePostEditor({ title, text_content });
    if (!validation.isValid) {
      validation.errors.forEach((err: { field: string; message: string }) => {
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
    }  catch (error: unknown) {
      const err = error as { message?: string };
      globalErr.textContent = err.message || 'Не удалось сохранить публикацию';
      globalErr.hidden = false;
    } finally {
      saveBtn.setDisabled(false);
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true } as FocusOptions);
  titleApi.focus();
}
