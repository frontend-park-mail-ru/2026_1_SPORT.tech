/**
 * @fileoverview Модальное окно создания и редактирования поста
 * @module components/molecules/PostFormModal
 */

import type { ApiClient } from '../../../utils/api';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { InputAPI } from '../../atoms/Input/Input';
import type { SportTypeFieldApi } from '../../../types/components.types';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { Validator } from '../../../utils/validator';
import { createSportTypesField, loadSportTypes } from '../../organisms/AuthForm/AuthForm';

export interface PostFormModalOptions {
  api: ApiClient;
  mode: 'create' | 'edit';
  postId?: number;
  initial?: {
    title?: string;
    text_content?: string;
    raw_text?: string;
    sport_type?: string;
    min_tier_id?: number;
  };
  onSaved?: (() => void) | null;
}

interface ContentBlock {
  id: string;
  type: 'text' | 'media';
  value: string;
  file: File | null;
}

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
  const globalErr = modal.querySelector('[data-post-form-global-error]') as HTMLElement;
  const cancelWrap = modal.querySelector('#post-form-cancel-wrap') as HTMLElement;
  const submitWrap = modal.querySelector('#post-form-submit-wrap') as HTMLElement;
  const sportFieldContainer = modal.querySelector('#post-form-sport-container') as HTMLElement;
  const tierContainer = modal.querySelector('#post-form-tier-container') as HTMLElement;
  const blocksContainer = modal.querySelector('#post-form-blocks') as HTMLElement;
  const _validator = new Validator();

  // Блоки контента
  const blocks: ContentBlock[] = [];
  let blockCounter = 0;

  // Загружаем виды спорта и создаём чекбоксы
  let sportFieldApi: SportTypeFieldApi | null = null;
  const sportTypes = await loadSportTypes(api);
  if (sportFieldContainer && sportTypes.length > 0) {
    sportFieldApi = createSportTypesField(sportFieldContainer, {
      label: '',
      placeholder: 'Выберите вид спорта',
      required: false,
      options: sportTypes,
      onChange: () => {}
    });
  }

  // Создаём чекбоксы для уровней подписки
  let selectedTiers: number[] = [];
  if (tierContainer) {
    const tierOptions = [
      { sport_type_id: 1, name: '1 уровень' },
      { sport_type_id: 2, name: '2 уровень' },
      { sport_type_id: 3, name: '3 уровень' }
    ];
    createSportTypesField(tierContainer, {
      label: '',
      placeholder: 'Выберите уровень доступа',
      required: false,
      options: tierOptions,
      onChange: (ids: number[]) => {
        selectedTiers = ids;
      }
    });
  }

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

  // Добавление блоков
  function addBlock(type: 'text' | 'media'): void {
    const block: ContentBlock = {
      id: `block-${++blockCounter}`,
      type,
      value: '',
      file: null
    };
    blocks.push(block);
    renderBlocks();
  }

  function removeBlock(id: string): void {
    const index = blocks.findIndex(b => b.id === id);
    if (index !== -1) blocks.splice(index, 1);
    renderBlocks();
  }

  function renderBlocks(): void {
    if (!blocksContainer) return;
    blocksContainer.innerHTML = '';

    blocks.forEach(block => {
      const blockEl = document.createElement('div');
      blockEl.className = 'post-form__block';
      blockEl.innerHTML = `
        <button type="button" class="post-form__remove-block" data-remove="${block.id}">×</button>
      `;

      if (block.type === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'post-form__block-textarea';
        textarea.placeholder = 'Введите текст...';
        textarea.value = block.value;
        textarea.addEventListener('input', () => { block.value = textarea.value; });
        blockEl.appendChild(textarea);
      } else {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'post-form__block-media';

        if (block.value) {
          if (block.file?.type.startsWith('video/')) {
            mediaContainer.innerHTML = `<video controls src="${block.value}" style="max-width:100%;max-height:300px;"></video>`;
          } else {
            mediaContainer.innerHTML = `<img src="${block.value}" alt="Медиа" style="max-width:100%;max-height:300px;object-fit:contain;">`;
          }
        } else {
          mediaContainer.innerHTML = `
            <div class="post-form__block-media-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Нажмите для загрузки медиа</span>
            </div>
          `;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (file) {
            block.file = file;
            const url = URL.createObjectURL(file);
            block.value = url;
            mediaContainer.innerHTML = '';
            if (file.type.startsWith('video/')) {
              mediaContainer.innerHTML = `<video controls src="${url}" style="max-width:100%;max-height:300px;"></video>`;
            } else {
              mediaContainer.innerHTML = `<img src="${url}" alt="Медиа" style="max-width:100%;max-height:300px;object-fit:contain;">`;
            }
            mediaContainer.appendChild(fileInput);
          }
        });

        mediaContainer.addEventListener('click', () => fileInput.click());
        mediaContainer.appendChild(fileInput);
        blockEl.appendChild(mediaContainer);
      }

      blocksContainer.appendChild(blockEl);
      blockEl.querySelector('[data-remove]')?.addEventListener('click', () => removeBlock(block.id));
    });
  }

  modal.querySelector('[data-add-text]')?.addEventListener('click', () => addBlock('text'));
  modal.querySelector('[data-add-media]')?.addEventListener('click', () => addBlock('media'));

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
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
    onClick: close
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

    const title = titleApi.getValue();

    if (!title.trim()) {
      titleApi.setError('Заголовок обязателен');
      return;
    }

    if (blocks.length === 0) {
      globalErr.textContent = 'Добавьте хотя бы один блок контента';
      globalErr.hidden = false;
      return;
    }

    saveBtn.setDisabled(true);
    try {
      const selectedSports = sportFieldApi?.getValue() || [];
      const contentBlocks = blocks.map(b => ({
        type: b.type,
        content: b.value,
        kind: b.file?.type.startsWith('video/') ? 'video' : 'image'
      }));

      const payload = {
        title: title.trim(),
        content_blocks: contentBlocks,
        sport_type_id: selectedSports.length > 0 ? selectedSports[0] : undefined,
        min_tier_id: selectedTiers.length > 0 ? Math.min(...selectedTiers) : 0
      };

      if (mode === 'edit' && postId != null) {
        await api.updatePost(postId, payload);
      } else {
        await api.createPost(payload);
      }

      onSaved?.();
      close();
    } catch (error: unknown) {
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
