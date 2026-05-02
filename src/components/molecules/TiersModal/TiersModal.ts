/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';

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
  addBtn.textContent = '➕ Добавить уровень';

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
            <input type="text" class="tier-card-input tier-name-input" data-id="${tier.id}" value="${escapeHtml(tier.name)}" placeholder="Например: Базовый">
          </div>
          <div class="tier-card-field">
            <label class="tier-card-label">Цена (₽/мес)</label>
            <input type="number" class="tier-card-input tier-price-input" data-id="${tier.id}" value="${tier.price || ''}" placeholder="0" min="0">
          </div>
          <div class="tier-card-field">
            <label class="tier-card-label">Описание</label>
            <input type="text" class="tier-card-input tier-desc-input" data-id="${tier.id}" value="${escapeHtml(tier.description)}" placeholder="Что получает подписчик">
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
      const nameInput = card.querySelector('.tier-name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.addEventListener('input', (e: Event) => {
          tier.name = (e.target as HTMLInputElement).value;
        });
      }

      // Изменение цены
      const priceInput = card.querySelector('.tier-price-input') as HTMLInputElement;
      if (priceInput) {
        priceInput.addEventListener('input', (e: Event) => {
          tier.price = Number((e.target as HTMLInputElement).value) || 0;
        });
      }

      // Изменение описания
      const descInput = card.querySelector('.tier-desc-input') as HTMLInputElement;
      if (descInput) {
        descInput.addEventListener('input', (e: Event) => {
          tier.description = (e.target as HTMLInputElement).value;
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
