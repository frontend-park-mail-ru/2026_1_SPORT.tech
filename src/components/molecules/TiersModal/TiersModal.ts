/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';
import { translateErrorMessage } from '../../../utils/api'; // ← импорт
import templates from '../../../templates';
import './TiersModal.css';

export interface TiersModalOptions {
  api: ApiClient;
  onSaved?: () => void;
}

interface TierData {
  id: string;
  name: string;
  price: number;
  description: string;
  index?: number;
  existingId?: number;
}

export function openTiersModal({ api, onSaved }: TiersModalOptions): void {
  let tiers: TierData[] = [];
  let tierCounter = 0;

  const template = templates['TiersModal.hbs'];

  const container = document.createElement('div');
  container.className = 'tiers-modal-container';
  document.body.appendChild(container);

  // ========== ФУНКЦИИ РЕНДЕРИНГА ==========
  function showError(message: string): void {
    const existingError = container.querySelector('.tiers-error-message');
    if (existingError) existingError.remove();

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

  function applyInputConstraints(): void {
    const allInputs = container.querySelectorAll('.tier-input') as NodeListOf<HTMLInputElement>;
    allInputs.forEach(input => {
      const field = input.dataset.field;
      if (field === 'name') {
        input.setAttribute('maxlength', '80');
      } else if (field === 'description') {
        input.setAttribute('maxlength', '500');
      }
    });
  }

  function render(): void {
    updateIndices();
    const html = template({ tiers });
    container.innerHTML = html;
    applyInputConstraints();
  }

  // ========== ДЕЛЕГИРОВАННЫЕ СОБЫТИЯ ==========
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
      if (!tierId) return;

      const tierToRemove = tiers.find(t => t.id === tierId);
      if (!tierToRemove) return;

      // Если уровень уже существует на сервере – пытаемся удалить через API
      if (tierToRemove.existingId) {
        const removeBtn = target.closest('[data-action="remove-tier"]') as HTMLButtonElement;
        if (removeBtn) removeBtn.disabled = true;

        api.deleteTier(tierToRemove.existingId)
          .then(() => {
            tiers = tiers.filter(t => t.id !== tierId);
            render();
            if (onSaved) onSaved();
          })
          .catch((error: unknown) => {
            const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
            const translated = translateErrorMessage(errMsg);
            showError(translated);
          })
          .finally(() => {
            if (removeBtn) removeBtn.disabled = false;
          });
      } else {
        // Новый (не сохранённый) уровень – удаляем сразу из списка
        tiers = tiers.filter(t => t.id !== tierId);
        render();
      }
      break;
    }

    case 'save': {
      e.preventDefault();
      const saveBtn = target.closest('[data-action="save"]') as HTMLButtonElement;
      if (saveBtn) handleSave(saveBtn);
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

  // ========== СОХРАНЕНИЕ ==========
  async function handleSave(saveBtn: HTMLButtonElement): Promise<void> {
    const validTiers = tiers.filter(t => t.name.trim() && t.price !== undefined && t.price !== null && t.price >= 0);

    if (validTiers.length === 0) {
      showError('Добавьте хотя бы один уровень с названием и ценой');
      return;
    }

    for (const tier of validTiers) {
      const name = tier.name.trim();
      if (name.length < 1 || name.length > 80) {
        showError('Название уровня должно быть от 1 до 80 символов');
        return;
      }
      const desc = (tier.description || '').trim();
      if (desc.length > 500) {
        showError('Описание уровня не должно превышать 500 символов');
        return;
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
      const existingResponse = await api.getTiers().catch(() => ({ tiers: [] as Tier[] }));
      const existingTiers: Tier[] = existingResponse?.tiers || [];

      const existingIds = new Set(validTiers.filter(t => t.existingId).map(t => t.existingId));

      // Удаляем уровни, которых нет в новом списке
      for (const existingTier of existingTiers) {
        if (!existingIds.has(existingTier.tier_id)) {
          try {
            await api.deleteTier(existingTier.tier_id);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
            const translated = translateErrorMessage(errMsg);
            showError(`Ошибка при удалении уровня «${existingTier.name}»: ${translated}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
            return; // Прерываем сохранение
          }
        }
      }

      // Создаём новые и обновляем существующие
      for (const tier of validTiers) {
        if (tier.existingId) {
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

  // ========== ЗАКРЫТИЕ ==========
  function close(): void {
    document.removeEventListener('keydown', onKey);
    container.remove();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  // ========== ЗАГРУЗКА СУЩЕСТВУЮЩИХ УРОВНЕЙ ==========
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

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  document.addEventListener('keydown', onKey);
  render();
  void loadTiers();
  applyInputConstraints();
}
