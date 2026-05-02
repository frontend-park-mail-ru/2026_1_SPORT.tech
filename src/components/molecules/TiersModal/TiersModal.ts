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

interface TierApiResponse {
  tiers: Array<{
    tier_id: number;
    name: string;
    price: number;
    description: string;
  }>;
}

/**
 * Экранирует HTML-спецсимволы для безопасного отображения
 */
function escapeTierHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function openTiersModal({
  api,
  onSaved
}: TiersModalOptions): Promise<void> {
  const HandlebarsGlobal = (window as unknown as {
    Handlebars: {
      templates: Record<string, (context: Record<string, unknown>) => string>
    }
  }).Handlebars;

  const template = HandlebarsGlobal.templates['TiersModal.hbs'];

  if (!template) {
    console.error('TiersModal template not found');
    return;
  }

  const root = document.createElement('div');
  root.innerHTML = template({}).trim();
  const modal = root.firstElementChild as HTMLElement;

  if (!modal) {
    console.error('Failed to create modal element');
    return;
  }

  const tiersList = modal.querySelector('#tiers-list') as HTMLElement;
  const cancelWrap = modal.querySelector('#tiers-cancel-wrap') as HTMLElement;
  const saveWrap = modal.querySelector('#tiers-save-wrap') as HTMLElement;
  const addTierBtn = modal.querySelector('#add-tier-btn') as HTMLButtonElement;
  const closeButtons = modal.querySelectorAll('[data-tiers-close]');

  let tiers: TierData[] = [];
  let tierCounter = 0;

  function addTier(): void {
    const tier: TierData = {
      id: `tier-${++tierCounter}`,
      name: '',
      price: 0,
      description: ''
    };
    tiers.push(tier);
    renderTiers();
  }

  function removeTier(id: string): void {
    tiers = tiers.filter(t => t.id !== id);
    renderTiers();
  }

  function renderTiers(): void {
    if (!tiersList) return;

    tiersList.innerHTML = '';

    if (tiers.length === 0) {
      tiersList.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Нет созданных уровней</p>';
      return;
    }

    tiers.forEach((tier, index) => {
      const card = document.createElement('div');
      card.className = 'tier-card';
      card.innerHTML = `
        <div class="tier-card__header">
          <span class="tier-card__number">Уровень ${index + 1}</span>
          <button type="button" class="tier-card__remove" data-remove="${tier.id}">×</button>
        </div>
        <div class="tier-card__fields">
          <div class="tier-card__field">
            <label class="tier-card__label">Название</label>
            <input type="text" class="tier-card__input" data-tier-name="${tier.id}" value="${escapeTierHtml(tier.name)}" placeholder="Например: Базовый">
          </div>
          <div class="tier-card__field">
            <label class="tier-card__label">Цена (₽/мес)</label>
            <input type="number" class="tier-card__input" data-tier-price="${tier.id}" value="${tier.price || ''}" placeholder="0" min="0">
          </div>
          <div class="tier-card__field">
            <label class="tier-card__label">Описание</label>
            <input type="text" class="tier-card__input" data-tier-desc="${tier.id}" value="${escapeTierHtml(tier.description)}" placeholder="Что получает подписчик">
          </div>
        </div>
      `;

      const removeBtn = card.querySelector(`[data-remove="${tier.id}"]`) as HTMLButtonElement;
      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeTier(tier.id));
      }

      const nameInput = card.querySelector(`[data-tier-name="${tier.id}"]`) as HTMLInputElement;
      if (nameInput) {
        nameInput.addEventListener('input', (e: Event) => {
          tier.name = (e.target as HTMLInputElement).value;
        });
      }

      const priceInput = card.querySelector(`[data-tier-price="${tier.id}"]`) as HTMLInputElement;
      if (priceInput) {
        priceInput.addEventListener('input', (e: Event) => {
          tier.price = Number((e.target as HTMLInputElement).value) || 0;
        });
      }

      const descInput = card.querySelector(`[data-tier-desc="${tier.id}"]`) as HTMLInputElement;
      if (descInput) {
        descInput.addEventListener('input', (e: Event) => {
          tier.description = (e.target as HTMLInputElement).value;
        });
      }

      tiersList.appendChild(card);
    });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
    }
  }

  function close(): void {
    document.removeEventListener('keydown', onKey);
    if (modal && modal.parentNode) {
      modal.remove();
    }
  }

  // Закрытие по клику на backdrop и кнопку закрытия
  closeButtons.forEach(btn => {
    btn.addEventListener('click', close);
  });

  if (addTierBtn) {
    addTierBtn.addEventListener('click', addTier);
  }

  // Создаём кнопки напрямую через DOM
  if (cancelWrap) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'button button--text-orange button--medium';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', close);
    cancelWrap.appendChild(cancelBtn);
  }

  if (saveWrap) {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'button button--primary-orange button--medium';
    saveBtn.textContent = 'Сохранить';

    saveBtn.addEventListener('click', async (e: MouseEvent) => {
      e.preventDefault();

      const validTiers = tiers.filter(t => t.name.trim() && t.price > 0);

      if (validTiers.length === 0) {
        alert('Добавьте хотя бы один уровень с названием и ценой');
        return;
      }

      saveBtn.disabled = true;
      try {
        const payload = {
          tiers: validTiers.map(t => ({
            name: t.name.trim(),
            price: t.price,
            description: t.description.trim()
          }))
        };

        await api.request('/v1/tiers', {
          method: 'POST',
          body: JSON.stringify(payload)
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
      } finally {
        saveBtn.disabled = false;
      }
    });

    saveWrap.appendChild(saveBtn);
  }

  // Добавляем окно в DOM
  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);

  // Фокусируем окно
  setTimeout(() => {
    modal.focus({ preventScroll: true });
  }, 0);

  // Пытаемся загрузить данные
  try {
    const response = await api.request<TierApiResponse>('/v1/tiers');
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
  } catch (error: unknown) {
    console.error('Failed to load tiers:', error);
  }
}
