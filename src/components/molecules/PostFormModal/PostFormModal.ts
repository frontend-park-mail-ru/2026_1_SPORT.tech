/**
 * @fileoverview Модальное окно создания и редактирования поста
 * @module components/molecules/PostFormModal
 */

import type { ApiClient } from '../../../utils/api';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { InputAPI } from '../../atoms/Input/Input';
import type { SportTypeFieldOption } from '../../../types/components.types';
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

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

  const blocks: ContentBlock[] = [];
  let blockCounter = 0;

  // Спортивные дисциплины
  const sportTypes = await loadSportTypes(api);
  if (sportFieldContainer && sportTypes.length > 0) {
    createSportTypesField(sportFieldContainer, {
      label: '',
      placeholder: 'Выберите вид спорта',
      required: false,
      options: sportTypes,
      onChange: () => {}
    });
  }

  // Уровни подписки
  let selectedTiers: number[] = [];
  if (tierContainer) {
    const tierOptions: SportTypeFieldOption[] = [
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

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Неподдерживаемый формат файла. Разрешены: JPEG, PNG, GIF, WebP, MP4, WebM, MOV';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  }

  function handleFileSelect(file: File, block: ContentBlock, mediaContainer: HTMLElement): void {
    const error = validateFile(file);
    if (error) {
      alert(error);
      return;
    }

    block.file = file;
    const url = URL.createObjectURL(file);
    block.value = url;

    // Очищаем контейнер и показываем превью
    mediaContainer.innerHTML = '';
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = url;
      video.style.cssText = 'max-width:100%;max-height:300px;';
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Медиа';
      img.style.cssText = 'max-width:100%;max-height:300px;object-fit:contain;';
      mediaContainer.appendChild(img);
    }
  }

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
    if (index !== -1) {
      // Очищаем URL созданный через createObjectURL
      if (blocks[index].value && blocks[index].value.startsWith('blob:')) {
        URL.revokeObjectURL(blocks[index].value);
      }
      blocks.splice(index, 1);
    }
    renderBlocks();
  }

  function renderBlocks(): void {
    if (!blocksContainer) return;
    blocksContainer.innerHTML = '';

    blocks.forEach(block => {
      const blockEl = document.createElement('div');
      blockEl.className = 'post-form__block';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'post-form__remove-block';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeBlock(block.id));
      blockEl.appendChild(removeBtn);

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
          // Показываем существующее превью
          if (block.file?.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.controls = true;
            video.src = block.value;
            video.style.cssText = 'max-width:100%;max-height:300px;';
            mediaContainer.appendChild(video);
          } else {
            const img = document.createElement('img');
            img.src = block.value;
            img.alt = 'Медиа';
            img.style.cssText = 'max-width:100%;max-height:300px;object-fit:contain;';
            mediaContainer.appendChild(img);
          }
        } else {
          // Плейсхолдер
          mediaContainer.innerHTML = `
            <div class="post-form__block-media-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Нажмите или перетащите файл</span>
            </div>
          `;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = ALLOWED_TYPES.join(',');
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (file) {
            handleFileSelect(file, block, mediaContainer);
            // Пересоздаём input после выбора файла
            const newInput = fileInput.cloneNode(true) as HTMLInputElement;
            newInput.addEventListener('change', () => {
              const newFile = newInput.files?.[0];
              if (newFile) handleFileSelect(newFile, block, mediaContainer);
            });
            mediaContainer.appendChild(newInput);
          }
        });

        // Клик для выбора файла
        mediaContainer.addEventListener('click', (e) => {
          // Не открываем выбор если кликнули на видео/изображение
          const target = e.target as HTMLElement;
          if (target.tagName === 'VIDEO' || target.tagName === 'IMG') return;
          fileInput.click();
        });

        // Drag and drop
        mediaContainer.addEventListener('dragover', (e) => {
          e.preventDefault();
          mediaContainer.classList.add('post-form__block-media--dragover');
        });

        mediaContainer.addEventListener('dragleave', () => {
          mediaContainer.classList.remove('post-form__block-media--dragover');
        });

        mediaContainer.addEventListener('drop', (e) => {
          e.preventDefault();
          mediaContainer.classList.remove('post-form__block-media--dragover');

          const file = e.dataTransfer?.files?.[0];
          if (file) {
            handleFileSelect(file, block, mediaContainer);
          }
        });

        mediaContainer.appendChild(fileInput);
        blockEl.appendChild(mediaContainer);
      }

      blocksContainer.appendChild(blockEl);
    });
  }

  modal.querySelector('[data-add-text]')?.addEventListener('click', () => addBlock('text'));
  modal.querySelector('[data-add-media]')?.addEventListener('click', () => addBlock('media'));

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  function close(): void {
    // Очищаем все blob URL
    blocks.forEach(block => {
      if (block.value && block.value.startsWith('blob:')) {
        URL.revokeObjectURL(block.value);
      }
    });
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
    saveBtn.setText('Загрузка...');

    try {
      const apiBlocks = await Promise.all(blocks.map(async (block) => {
        if (block.type === 'media' && block.file) {
          try {
            const uploadResult = await api.uploadPostMedia(block.file);
            return {
              file_url: uploadResult.file_url,
              kind: block.file.type.startsWith('video/') ? 'video' : 'image'
            };
          } catch (uploadError) {
            console.error(`Failed to upload file for block ${block.id}:`, uploadError);
            throw new Error(`Не удалось загрузить файл: ${(uploadError as Error).message}`);
          }
        } else if (block.type === 'text' && block.value.trim()) {
          return {
            text_content: block.value.trim(),
            kind: 'text'
          };
        }
        return null;
      }));

      const validBlocks = apiBlocks.filter(block => block !== null);

      if (validBlocks.length === 0) {
        throw new Error('Добавьте хотя бы один непустой блок контента');
      }

      const payload: {
        title: string;
        blocks: Array<{ text_content?: string; file_url?: string; kind?: string }>;
        min_tier_id?: number;
        replace_blocks?: boolean;
      } = {
        title: title.trim(),
        blocks: validBlocks as Array<{ text_content?: string; file_url?: string; kind?: string }>
      };

      if (selectedTiers.length > 0) {
        payload.min_tier_id = Math.min(...selectedTiers);
      }

      if (mode === 'edit' && postId != null) {
        payload.replace_blocks = true;
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
      saveBtn.setText(mode === 'edit' ? 'Сохранить' : 'Опубликовать');
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true } as FocusOptions);
  titleApi.focus();
}
