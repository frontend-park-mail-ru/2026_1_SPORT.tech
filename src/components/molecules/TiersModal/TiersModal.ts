/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import type { ButtonAPI } from '../../atoms/Button/Button';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';

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

export async function openTiersModal({
  api,
  onSaved
}: TiersModalOptions): Promise<void> {
  const HandlebarsGlobal = (window as unknown as { Handlebars: { templates: Record<string, (context: Record<string, unknown>) => string> } }).Handlebars;
  const template = HandlebarsGlobal.templates['TiersModal.hbs'];
  const root = document.createElement('div');
  root.innerHTML = template({}).trim();
  const modal = root.firstElementChild as HTMLElement;

  const tiersList = modal.querySelector('#tiers-list') as HTMLElement;
  const cancelWrap = modal.querySelector('#tiers-cancel-wrap') as HTMLElement;
  const saveWrap = modal.querySelector('#tiers-save-wrap') as HTMLElement;

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
            <input type="text" class="tier-card__input" data-tier-name="${tier.id}" value="${escapeHtml(tier.name)}" placeholder="Например: Базовый">
          </div>
          <div class="tier-card__field">
            <label class="tier-card__label">Цена (₽/мес)</label>
            <input type="number" class="tier-card__input" data-tier-price="${tier.id}" value="${tier.price || ''}" placeholder="0" min="0">
          </div>
          <div class="tier-card__field">
            <label class="tier-card__label">Описание</label>
            <input type="text" class="tier-card__input" data-tier-desc="${tier.id}" value="${escapeHtml(tier.description)}" placeholder="Что получает подписчик">
          </div>
        </div>
      `;

      card.querySelector('[data-remove]')?.addEventListener('click', () => removeTier(tier.id));

      card.querySelector('[data-tier-name]')?.addEventListener('input', (e) => {
        tier.name = (e.target as HTMLInputElement).value;
      });

      card.querySelector('[data-tier-price]')?.addEventListener('input', (e) => {
        tier.price = Number((e.target as HTMLInputElement).value) || 0;
      });

      card.querySelector('[data-tier-desc]')?.addEventListener('input', (e) => {
        tier.description = (e.target as HTMLInputElement).value;
      });

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

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  function close(): void {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  }

  // Закрытие по клику на backdrop
  modal.querySelector('[data-tiers-close]')?.addEventListener('click', close);

  modal.querySelector('#add-tier-btn')?.addEventListener('click', addTier);

  await renderButton(cancelWrap, {
    text: 'Отмена',
    variant: BUTTON_VARIANTS.TEXT_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'button',
    onClick: close
  });

  const saveBtn: ButtonAPI = await renderButton(saveWrap, {
    text: 'Сохранить',
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'button'
  });

  saveBtn.element.addEventListener('click', async () => {
    const validTiers = tiers.filter(t => t.name.trim() && t.price > 0);

    if (validTiers.length === 0) {
      alert('Добавьте хотя бы один уровень с названием и ценой');
      return;
    }

    saveBtn.setDisabled(true);
    try {
      const payload = {
        tiers: validTiers.map(t => ({
          name: t.name.trim(),
          price: t.price,
          description: t.description.trim()
        }))
      };

      // TODO: API запрос на сохранение уровней
      await api.request('/v1/tiers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      onSaved?.();
      close();
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert(err.message || 'Не удалось сохранить');
    } finally {
      saveBtn.setDisabled(false);
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true });

  // Загружаем существующие уровни
  try {
    const response = await api.request<TierApiResponse>('/v1/tiers');
    if (response?.tiers) {
      tiers = response.tiers.map(t => ({
        id: `tier-${t.tier_id}`,
        name: t.name,
        price: t.price,
        description: t.description || ''
      }));
      tierCounter = tiers.length;
      renderTiers();
    }
  } catch {
    // Нет сохранённых уровней
  }
}
