/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';
import templates from '../../../templates';
import './TiersModal.css';

export interface TiersModalOptions {
  api: ApiClient;
  onSaved?: () => void;
}

interface TierData {
  id: string;        // 'tier-{tier_id}' для существующих, 'new-{counter}' для новых
  name: string;
  price: number;
  description: string;
  index?: number;
  existingId?: number; // настоящий tier_id с бэкенда
}

export function openTiersModal({ api, onSaved }: TiersModalOptions): void {
  let tiers: TierData[] = [];
  let tierCounter = 0;

  const template = templates['TiersModal.hbs'];

  const container = document.createElement('div');
  container.className = 'tiers-modal-container';

  function showError(message: string): void {
    const existingError = container.querySelector('.tiers-error-message');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'tiers-error-message';
    errorDiv.style.cssText = `
      background: #FEE2E2;
      color: #991B1B;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      text-align: center;
      animation: fadeIn 0.3s ease;
    `;
    errorDiv.textContent = message;

    const tiersList = container.querySelector('[data-container="tiers-list"]');
    if (tiersList) {
      tiersList.parentNode?.insertBefore(errorDiv, tiersList);
    }

    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }

  function updateIndices(): void {
    tiers.forEach((tier, index) => {
      tier.index = index + 1;
    });
  }

  function render(): void {
    updateIndices();
    const html = template({ tiers });
    container.innerHTML = html;
    bindEvents();
  }

  function bindEvents(): void {
    container.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action || target.closest('[data-action]')?.getAttribute('data-action');

      switch (action) {
      case 'close':
        e.preventDefault();
        close();
        break;

      case 'add-tier':
        e.preventDefault();
        tierCounter++;
        tiers.push({
          id: `new-${Date.now()}-${tierCounter}`,
          name: '',
          price: 0,
          description: ''
        });
        render();
        break;

      case 'remove-tier': {
        e.preventDefault();
        const tierId = target.dataset.tierId || target.closest('[data-tier-id]')?.getAttribute('data-tier-id');
        if (tierId) {
          tiers = tiers.filter(t => t.id !== tierId);
          render();
        }
        break;
      }
      }
    });

    container.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.classList.contains('tier-input')) return;

      const tierId = target.dataset.tierId;
      const field = target.dataset.field;
      const tier = tiers.find(t => t.id === tierId);

      if (tier && field) {
        if (field === 'price') {
          tier.price = Number(target.value) || 0;
        } else if (field === 'name') {
          tier.name = target.value;
        } else if (field === 'description') {
          tier.description = target.value;
        }
      }
    });

    const saveBtn = container.querySelector('[data-action="save"]') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault();
        await handleSave(saveBtn);
      });
    }
  }

  async function handleSave(saveBtn: HTMLButtonElement): Promise<void> {
    const validTiers = tiers.filter(t => t.name.trim() && t.price > 0);

    if (validTiers.length === 0) {
      showError('Добавьте хотя бы один уровень с названием и ценой');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
      // Получаем существующие уровни для сравнения
      const existingResponse = await api.getTiers().catch(() => ({ tiers: [] as Tier[] }));
      const existingTiers: Tier[] = existingResponse?.tiers || [];

      // Удаляем уровни, которых нет в новом списке
      const existingIds = new Set(validTiers.filter(t => t.existingId).map(t => t.existingId));

      for (const existingTier of existingTiers) {
        if (!existingIds.has(existingTier.tier_id)) {
          try {
            await api.deleteTier(existingTier.tier_id);
          } catch (error) {
            console.error(`Failed to delete tier ${existingTier.tier_id}:`, error);
          }
        }
      }

      // Создаём новые и обновляем существующие
      for (const tier of validTiers) {
        if (tier.existingId) {
          // Обновляем существующий
          try {
            await api.updateTier(tier.existingId, {
              name: tier.name.trim(),
              price: tier.price,
              description: tier.description.trim() || ''
            });
          } catch (error) {
            console.error(`Failed to update tier ${tier.existingId}:`, error);
            throw new Error(`Не удалось обновить уровень «${tier.name}»`);
          }
        } else {
          // Создаём новый
          try {
            await api.createTier({
              name: tier.name.trim(),
              price: tier.price,
              description: tier.description.trim() || ''
            });
          } catch (error) {
            console.error('Failed to create tier:', error);
            throw new Error(`Не удалось создать уровень «${tier.name}»`);
          }
        }
      }

      if (onSaved) onSaved();
      close();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to save tiers:', err);
      showError(err.message || 'Не удалось сохранить уровни подписки');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  }

  function close(): void {
    document.removeEventListener('keydown', onKey);
    container.remove();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  // Загрузка существующих уровней
  async function loadTiers(): Promise<void> {
    try {
      const response = await api.getTiers();
      if (response?.tiers && Array.isArray(response.tiers)) {
        tiers = response.tiers.map((t: Tier) => ({
          id: `tier-${t.tier_id}`,
          name: t.name || '',
          price: t.price || 0,
          description: t.description || '',
          existingId: t.tier_id
        }));
        tierCounter = tiers.length;
        render();
      }
    } catch (error) {
      console.error('Failed to load tiers:', error);
      showError('Не удалось загрузить существующие уровни');
    }
  }

  // Инициализация
  document.addEventListener('keydown', onKey);
  document.body.appendChild(container);
  render();

  // Загружаем существующие уровни с бэкенда
  void loadTiers();
}
