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

export async function openTiersModal({
  api,
  onSaved
}: TiersModalOptions): Promise<void> {
  // Создаём модальное окно напрямую, без Handlebars
  const modal = document.createElement('div');
  modal.className = 'tiers-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'tiers-modal-title');
  modal.setAttribute('tabindex', '-1');

  modal.innerHTML = `
    <div class="tiers-modal__backdrop" data-tiers-close></div>
    <div class="tiers-modal__panel">
      <div class="tiers-modal__head">
        <h2 class="tiers-modal__title" id="tiers-modal-title">Настройка уровней подписки</h2>
        <button type="button" class="tiers-modal__close" data-tiers-close aria-label="Закрыть окно">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="tiers-modal__body">
        <div id="tiers-list" class="tiers-modal__list">
          <p style="color:#999;text-align:center;padding:20px;">Нет созданных уровней</p>
        </div>
        <button type="button" class="tiers-modal__add-btn" id="add-tier-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить уровень
        </button>
      </div>
      <div class="tiers-modal__actions">
        <button type="button" class="button button--text-orange button--medium" id="tiers-cancel-btn">Отмена</button>
        <button type="button" class="button button--primary-orange button--medium" id="tiers-save-btn">Сохранить</button>
      </div>
    </div>
  `;

  let tiers: TierData[] = [];
  let tierCounter = 0;

  const tiersList = modal.querySelector('#tiers-list') as HTMLElement;
  const addTierBtn = modal.querySelector('#add-tier-btn') as HTMLButtonElement;
  const cancelBtn = modal.querySelector('#tiers-cancel-btn') as HTMLButtonElement;
  const saveBtn = modal.querySelector('#tiers-save-btn') as HTMLButtonElement;
  const closeButtons = modal.querySelectorAll('[data-tiers-close]');

  function escapeTierHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
        removeBtn.addEventListener('click', () => {
          tiers = tiers.filter(t => t.id !== tier.id);
          renderTiers();
        });
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

  function close(): void {
    document.removeEventListener('keydown', onKey);
    if (modal && modal.parentNode) {
      modal.remove();
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
    }
  }

  closeButtons.forEach(btn => {
    btn.addEventListener('click', close);
  });

  if (addTierBtn) {
    addTierBtn.addEventListener('click', () => {
      tierCounter++;
      tiers.push({
        id: `tier-${tierCounter}`,
        name: '',
        price: 0,
        description: ''
      });
      renderTiers();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async (e: MouseEvent) => {
      e.preventDefault();
      const validTiers = tiers.filter(t => t.name.trim() && t.price > 0);

      if (validTiers.length === 0) {
        alert('Добавьте хотя бы один уровень с названием и ценой');
        return;
      }

      saveBtn.disabled = true;
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

        if (onSaved) onSaved();
        close();
      } catch (error: unknown) {
        console.error('Failed to save tiers:', error);
        if (onSaved) onSaved();
        close();
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);

  setTimeout(() => {
    modal.focus({ preventScroll: true });
  }, 0);
}
