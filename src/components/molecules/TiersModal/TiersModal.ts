/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import { Validator } from '../../../utils/validator';
import type { ValidationResult } from '../../../types/validation.types';

export interface TiersModalOptions {
  api: ApiClient;
  onSaved?: () => void;
}

interface TierData {
  id: string;
  name: string;
  price: number;
  description: string;
}

export function openTiersModal({
  api,
  onSaved
}: TiersModalOptions): void {
  const validator = new Validator();
  let tiers: TierData[] = [];
  let tierCounter = 0;

  // Создаём overlay (backdrop)
  const overlay = document.createElement('div');
  overlay.className = 'tiers-modal-overlay';
  overlay.id = 'tiers-modal-overlay';

  // Создаём панель модального окна
  const panel = document.createElement('div');
  panel.className = 'tiers-modal-panel';
  panel.id = 'tiers-modal-panel';

  // Заголовок
  const header = document.createElement('div');
  header.className = 'tiers-modal-header';
  header.innerHTML = `
    <h2 class="tiers-modal-title">Настройка уровней подписки</h2>
    <button class="tiers-modal-close-btn" id="tiers-close-btn">×</button>
  `;

  // Список уровней
  const tiersList = document.createElement('div');
  tiersList.className = 'tiers-modal-list';
  tiersList.id = 'tiers-list';
  tiersList.innerHTML = '<p class="tiers-modal-empty">Нет созданных уровней</p>';

  // Кнопка добавить уровень
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tiers-modal-add-btn';
  addBtn.id = 'tiers-add-btn';
  addBtn.textContent = '+ Добавить уровень';

  // Контейнер для кнопок действий
  const actions = document.createElement('div');
  actions.className = 'tiers-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'tiers-modal-cancel-btn';
  cancelBtn.id = 'tiers-cancel-btn';
  cancelBtn.textContent = 'Отмена';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'tiers-modal-save-btn';
  saveBtn.id = 'tiers-save-btn';
  saveBtn.textContent = 'Сохранить';

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  // Собираем панель
  panel.appendChild(header);
  panel.appendChild(tiersList);
  panel.appendChild(addBtn);
  panel.appendChild(actions);

  /**
   * Валидирует один уровень
   */
  function validateSingleTier(tier: TierData): ValidationResult {
    validator.reset();

    // Валидация названия
    if (!tier.name || tier.name.trim().length === 0) {
      validator.addError('name', 'Название обязательно');
    } else if (tier.name.length > 100) {
      validator.addError('name', 'Максимум 100 символов');
    }

    // Валидация цены
    if (!tier.price || tier.price <= 0) {
      validator.addError('price', 'Цена должна быть больше 0');
    } else if (tier.price > 999999) {
      validator.addError('price', 'Максимальная цена 999 999 ₽');
    }

    // Валидация описания
    if (tier.description && tier.description.length > 500) {
      validator.addError('description', 'Максимум 500 символов');
    }

    return {
      isValid: !validator.hasErrors(),
      errors: validator.getErrors()
    };
  }

  /**
   * Показывает ошибки валидации в карточке
   */
  function showValidationErrors(card: HTMLElement, errors: Array<{ field: string; message: string }>): void {
    // Очищаем старые ошибки
    card.querySelectorAll('.tier-card-error').forEach(el => el.remove());
    card.querySelectorAll('.tier-card-input--error').forEach(input => {
      input.classList.remove('tier-card-input--error');
    });

    errors.forEach(error => {
      const input = card.querySelector(`[data-field="${error.field}"]`) as HTMLInputElement;
      if (input) {
        input.classList.add('tier-card-input--error');

        const errorEl = document.createElement('div');
        errorEl.className = 'tier-card-error';
        errorEl.textContent = error.message;
        input.parentElement?.appendChild(errorEl);
      }
    });
  }

  /**
   * Очищает ошибки валидации в карточке
   */
  function clearValidationErrors(card: HTMLElement): void {
    card.querySelectorAll('.tier-card-error').forEach(el => el.remove());
    card.querySelectorAll('.tier-card-input--error').forEach(input => {
      input.classList.remove('tier-card-input--error');
    });
  }

  // Функция рендеринга уровней
  function renderTiers(): void {
    tiersList.innerHTML = '';

    if (tiers.length === 0) {
      tiersList.innerHTML = '<p class="tiers-modal-empty">Нет созданных уровней</p>';
      return;
    }

    tiers.forEach((tier, index) => {
      const card = document.createElement('div');
      card.className = 'tier-card';
      card.innerHTML = `
        <div class="tier-card-header">
          <span class="tier-card-number">Уровень ${index + 1}</span>
          <button class="tier-card-remove-btn" data-id="${tier.id}">×</button>
        </div>
        <div class="tier-card-fields">
          <div class="tier-card-field">
            <label class="tier-card-label">Название</label>
            <input type="text" class="tier-card-input" data-field="name" value="${escapeHtml(tier.name)}" placeholder="Например: Базовый" maxlength="100">
          </div>
          <div class="tier-card-field">
            <label class="tier-card-label">Цена (₽/мес)</label>
            <input type="number" class="tier-card-input" data-field="price" value="${tier.price || ''}" placeholder="0" min="0" max="999999">
          </div>
          <div class="tier-card-field">
            <label class="tier-card-label">Описание</label>
            <input type="text" class="tier-card-input" data-field="description" value="${escapeHtml(tier.description)}" placeholder="Что получает подписчик" maxlength="500">
          </div>
        </div>
      `;

      // Удаление уровня
      const removeBtn = card.querySelector('.tier-card-remove-btn') as HTMLButtonElement;
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          tiers = tiers.filter(t => t.id !== tier.id);
          renderTiers();
        });
      }

      // Изменение названия
      const nameInput = card.querySelector('[data-field="name"]') as HTMLInputElement;
      if (nameInput) {
        nameInput.addEventListener('input', (e: Event) => {
          tier.name = (e.target as HTMLInputElement).value;
          clearValidationErrors(card);
        });
      }

      // Изменение цены
      const priceInput = card.querySelector('[data-field="price"]') as HTMLInputElement;
      if (priceInput) {
        priceInput.addEventListener('input', (e: Event) => {
          tier.price = Number((e.target as HTMLInputElement).value) || 0;
          clearValidationErrors(card);
        });
      }

      // Изменение описания
      const descInput = card.querySelector('[data-field="description"]') as HTMLInputElement;
      if (descInput) {
        descInput.addEventListener('input', (e: Event) => {
          tier.description = (e.target as HTMLInputElement).value;
          clearValidationErrors(card);
        });
      }

      tiersList.appendChild(card);
    });
  }

  function escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Закрытие модального окна
  function close(): void {
    document.removeEventListener('keydown', onKey);
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
    if (panel && panel.parentNode) {
      panel.remove();
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
    }
  }

  // Обработчики событий
  overlay.addEventListener('click', close);

  const closeBtn = header.querySelector('#tiers-close-btn') as HTMLButtonElement;
  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  cancelBtn.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    close();
  });

  addBtn.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    tierCounter++;
    tiers.push({
      id: `tier-${tierCounter}`,
      name: '',
      price: 0,
      description: ''
    });
    renderTiers();
  });

  saveBtn.addEventListener('click', async (e: MouseEvent) => {
    e.preventDefault();

    // Очищаем все ошибки
    const cards = tiersList.querySelectorAll('.tier-card');
    cards.forEach(card => clearValidationErrors(card as HTMLElement));

    // Валидируем все уровни
    let hasErrors = false;
    tiers.forEach((tier, index) => {
      const result = validateSingleTier(tier);
      if (!result.isValid) {
        hasErrors = true;
        const card = tiersList.querySelectorAll('.tier-card')[index] as HTMLElement;
        if (card) {
          showValidationErrors(card, result.errors);
        }
      }
    });

    if (hasErrors) {
      return;
    }

    const validTiers = tiers.filter(t => t.name.trim() && t.price > 0);

    if (validTiers.length === 0) {
      alert('Добавьте хотя бы один уровень с названием и ценой');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
      await api.request('/v1/tiers', {
        method: 'POST',
        body: JSON.stringify({
          tiers: validTiers.map(t => ({
            name: t.name.trim(),
            price: t.price,
            description: t.description.trim()
          }))
        })
      });

      if (onSaved) {
        onSaved();
      }
      close();
    } catch (error: unknown) {
      console.error('Failed to save tiers:', error);
      if (onSaved) {
        onSaved();
      }
      close();
    }
  });

  // Добавляем в DOM
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // Загружаем существующие уровни
  api.request<{
    tiers: Array<{
      tier_id: number;
      name: string;
      price: number;
      description: string;
    }>;
  }>('/v1/tiers')
    .then(response => {
      if (response?.tiers && Array.isArray(response.tiers)) {
        tiers = response.tiers.map(t => ({
          id: `tier-${t.tier_id}`,
          name: t.name || '',
          price: t.price || 0,
          description: t.description || ''
        }));
        tierCounter = tiers.length;
        renderTiers();
      }
    })
    .catch(() => {
      // Не удалось загрузить — оставляем пустой список
    });
}
