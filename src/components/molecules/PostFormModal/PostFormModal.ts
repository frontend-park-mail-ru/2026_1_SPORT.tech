/**
 * @fileoverview Модальное окно создания и редактирования поста
 * @module components/molecules/PostFormModal
 */

import type { ApiClient } from '../../../utils/api';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { InputAPI } from '../../atoms/Input/Input';
import type { SportTypeFieldOption, SportTypeFieldApi } from '../../../types/components.types';
import type { PostBlock } from '../../../types/api.types';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
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
  existingUrl?: string;
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

  const blocks: ContentBlock[] = [];
  let blockCounter = 0;
  let selectedTiers: number[] = [];
  let selectedSportTypeId: number | null = null;

  // ========== ЗАГРУЖАЕМ СУЩЕСТВУЮЩИЙ ПОСТ (если редактирование) ==========
  if (mode === 'edit' && postId != null) {
    try {
      const fullPost = await api.getPost(postId);
      initial = { ...initial, title: fullPost.title };

      if (fullPost.blocks && Array.isArray(fullPost.blocks)) {
        fullPost.blocks.forEach((block: PostBlock) => {
          if (block.text_content) {
            blocks.push({
              id: `block-${++blockCounter}`,
              type: 'text',
              value: block.text_content,
              file: null
            });
          }
          if (block.file_url) {
            blocks.push({
              id: `block-${++blockCounter}`,
              type: 'media',
              value: block.file_url,
              file: null,
              existingUrl: block.file_url
            });
          }
        });
      }

      if (fullPost.min_tier_id != null && fullPost.min_tier_id > 0) {
        selectedTiers = [fullPost.min_tier_id];
      }

      if (fullPost.sport_type_id != null) {
        selectedSportTypeId = fullPost.sport_type_id;
      }
    } catch (error) {
      console.error('Failed to load existing post:', error);
    }
  }

  if (blocks.length === 0 && initial.raw_text) {
    blocks.push({
      id: `block-${++blockCounter}`,
      type: 'text',
      value: initial.raw_text,
      file: null
    });
  }

  // ========== ЗАГРУЖАЕМ ДАННЫЕ ДЛЯ ФОРМЫ ==========

  let tierOptions: SportTypeFieldOption[] = [];
  try {
    const tiersResponse = await api.getTiers();
    if (tiersResponse?.tiers && Array.isArray(tiersResponse.tiers)) {
      tierOptions = tiersResponse.tiers.map(t => ({
        sport_type_id: t.tier_id,
        name: t.name
      }));
    }
  } catch (e) {
    console.error('Failed to load tiers:', e);
    tierOptions = [
      { sport_type_id: 1, name: '1 уровень' },
      { sport_type_id: 2, name: '2 уровень' },
      { sport_type_id: 3, name: '3 уровень' }
    ];
  }

  // ========== СОЗДАЁМ ПОЛЯ ФОРМЫ ==========

  // Вид спорта – select (одиночный выбор)
  const sportTypes = await loadSportTypes(api);
  if (sportFieldContainer && sportTypes.length > 0) {
    const selectEl = document.createElement('select');
    selectEl.className = 'post-form__tier-select';
    selectEl.id = 'post-form-sport-select';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Не выбрано';
    selectEl.appendChild(emptyOption);

    sportTypes.forEach(sport => {
      const option = document.createElement('option');
      option.value = String(sport.sport_type_id);
      option.textContent = sport.name;
      selectEl.appendChild(option);
    });

    if (selectedSportTypeId != null) {
      selectEl.value = String(selectedSportTypeId);
    }

    sportFieldContainer.appendChild(selectEl);
  }

  // Уровни подписки – чекбоксы (можно выбрать несколько, передаётся минимальный)
  let tierFieldApi: SportTypeFieldApi | null = null;
  if (tierContainer) {
    tierFieldApi = createSportTypesField(tierContainer, {
      label: '',
      placeholder: 'Выберите уровень доступа',
      required: false,
      options: tierOptions,
      onChange: (ids: number[]) => { selectedTiers = ids; }
    });

    if (selectedTiers.length > 0) {
      tierFieldApi.setValue(selectedTiers);
    }
  }

  // Заголовок
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

  // ========== ФУНКЦИИ ДЛЯ БЛОКОВ ==========
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
    if (error) { alert(error); return; }

    block.file = file;
    block.existingUrl = undefined;
    const url = URL.createObjectURL(file);
    block.value = url;

    mediaContainer.innerHTML = '';
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true; video.src = url; video.style.cssText = 'max-width:100%;max-height:300px;';
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = url; img.alt = 'Медиа'; img.style.cssText = 'max-width:100%;max-height:300px;object-fit:contain;';
      mediaContainer.appendChild(img);
    }
  }

  function addBlock(type: 'text' | 'media'): void {
    blocks.push({ id: `block-${++blockCounter}`, type, value: '', file: null });
    renderBlocks();
  }

  function removeBlock(id: string): void {
    const index = blocks.findIndex(b => b.id === id);
    if (index !== -1) {
      if (blocks[index].value && blocks[index].value.startsWith('blob:')) {
        URL.revokeObjectURL(blocks[index].value);
      }
      blocks.splice(index, 1);
    }
    renderBlocks();
  }

  function createMediaPreview(block: ContentBlock, container: HTMLElement): void {
    if (block.existingUrl && !block.file) {
      container.innerHTML = block.existingUrl.toLowerCase().includes('.mp4') ||
                          block.existingUrl.toLowerCase().includes('.webm') ||
                          block.existingUrl.toLowerCase().includes('.mov')
        ? `<video controls src="${block.existingUrl}" style="max-width:100%;max-height:300px;"></video>`
        : `<img src="${block.existingUrl}" alt="Медиа" style="max-width:100%;max-height:300px;object-fit:contain;">`;
      return;
    }
    if (block.value && block.file) {
      const isVideo = block.file.type.startsWith('video/');
      if (isVideo) {
        const video = document.createElement('video');
        video.controls = true; video.src = block.value; video.style.cssText = 'max-width:100%;max-height:300px;';
        container.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = block.value; img.alt = 'Медиа'; img.style.cssText = 'max-width:100%;max-height:300px;object-fit:contain;';
        container.appendChild(img);
      }
    } else {
      container.innerHTML = `
        <div class="post-form__block-media-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Нажмите или перетащите файл</span>
        </div>`;
    }
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
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeBlock(block.id); });
      blockEl.appendChild(removeBtn);

      if (block.type === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'post-form__block-textarea';
        textarea.placeholder = 'Введите текст...';
        textarea.value = block.value;
        textarea.addEventListener('input', () => { block.value = textarea.value; });
        textarea.addEventListener('click', (e) => e.stopPropagation());
        blockEl.appendChild(textarea);
      } else {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'post-form__block-media';
        createMediaPreview(block, mediaContainer);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = ALLOWED_TYPES.join(',');
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (file) handleFileSelect(file, block, mediaContainer);
        });

        mediaContainer.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'VIDEO' || target.tagName === 'IMG') return;
          fileInput.click();
        });
        mediaContainer.addEventListener('dragover', (e) => { e.preventDefault(); mediaContainer.classList.add('post-form__block-media--dragover'); });
        mediaContainer.addEventListener('dragleave', () => { mediaContainer.classList.remove('post-form__block-media--dragover'); });
        mediaContainer.addEventListener('drop', (e) => {
          e.preventDefault();
          mediaContainer.classList.remove('post-form__block-media--dragover');
          const file = e.dataTransfer?.files?.[0];
          if (file) handleFileSelect(file, block, mediaContainer);
        });

        mediaContainer.appendChild(fileInput);
        blockEl.appendChild(mediaContainer);
      }
      blocksContainer.appendChild(blockEl);
    });
  }

  renderBlocks();

  modal.querySelector('[data-add-text]')?.addEventListener('click', () => addBlock('text'));
  modal.querySelector('[data-add-media]')?.addEventListener('click', () => addBlock('media'));

  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') close(); }
  function close(): void {
    blocks.forEach(block => {
      if (block.value && block.value.startsWith('blob:')) URL.revokeObjectURL(block.value);
    });
    document.removeEventListener('keydown', onKey);
    modal.remove();
  }

  await renderButton(cancelWrap, {
    text: 'Отмена', variant: BUTTON_VARIANTS.TEXT_ORANGE, size: BUTTON_SIZES.MEDIUM, type: 'button', onClick: close
  });

  const saveBtn: ButtonAPI = await renderButton(submitWrap, {
    text: mode === 'edit' ? 'Сохранить' : 'Опубликовать',
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE, size: BUTTON_SIZES.MEDIUM, type: 'submit'
  });

  modal.querySelectorAll('[data-post-form-close]').forEach(el => el.addEventListener('click', close));

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    globalErr.hidden = true; globalErr.textContent = '';

    const title = titleApi.getValue();
    if (!title.trim()) {
      titleApi.setError('Заголовок обязателен');
      return;
    }
    if (blocks.length === 0) {
      globalErr.textContent = 'Добавьте хотя бы один блок контента'; globalErr.hidden = false;
      return;
    }

    saveBtn.setDisabled(true);
    saveBtn.setText('Сохранение...');

    try {
      const apiBlocks = await Promise.all(blocks.map(async (block) => {
        if (block.type === 'media' && block.file) {
          try {
            const uploadResult = await api.uploadPostMedia(block.file);
            return { file_url: uploadResult.file_url, kind: block.file.type.startsWith('video/') ? 'video' : 'image' };
          } catch {
            alert('⚠️ Загрузка медиа временно недоступна. Файл не будет добавлен.');
            return null;
          }
        } else if (block.type === 'media' && block.existingUrl) {
          return { file_url: block.existingUrl, kind: 'image' };
        } else if (block.type === 'text' && block.value.trim()) {
          return { text_content: block.value.trim(), kind: 'text' };
        }
        return null;
      }));

      const validBlocks = apiBlocks.filter(block => block !== null);
      if (validBlocks.length === 0) throw new Error('Добавьте хотя бы один непустой блок контента');

      const payload: {
        title: string;
        blocks: Array<{ text_content?: string; file_url?: string; kind?: string }>;
        min_tier_id?: number;
        sport_type_id?: number;
        replace_blocks?: boolean;
      } = {
        title: title.trim(),
        blocks: validBlocks as Array<{ text_content?: string; file_url?: string; kind?: string }>
      };

      // Выбранный вид спорта из select
      const sportSelect = document.getElementById('post-form-sport-select') as HTMLSelectElement | null;
      if (sportSelect && sportSelect.value) {
        payload.sport_type_id = Number(sportSelect.value);
      }

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
