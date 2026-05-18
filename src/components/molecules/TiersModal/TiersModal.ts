/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';
import { translateErrorMessage } from '../../../utils/api'; // NEW: импорт для читаемых сообщений
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

  // NEW: Функция для отображения временного всплывающего сообщения (тоста)
  function showToast(message: string, type: 'success' | 'error' = 'error'): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      background: ${type === 'error' ? '#EF4444' : '#10B981'};
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // NEW: Диалог подтверждения удаления существующего уровня
  function confirmDeleteTier(tier: TierData, onConfirm: () => Promise<void>): void {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
    `;
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10001;
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 320px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    `;
    dialog.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin: 0 0 8px; font-size: 18px;">Удалить уровень «${escapeHtml(tier.name)}»?</h3>
      <p style="margin: 0 0 16px; color: #666; font-size: 14px;">
        Этот уровень может использоваться в публикациях.<br>
        <strong style="color: #E85A2B;">При удалении публикации станут доступны всем.</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="confirm-cancel" style="padding: 8px 20px; border: none; border-radius: 8px; background: #E2E8F0; cursor: pointer;">Отмена</button>
        <button class="confirm-ok" style="padding: 8px 20px; border: none; border-radius: 8px; background: #E85A2B; color: white; cursor: pointer;">Удалить</button>
      </div>
    `;

    const close = () => {
      backdrop.remove();
      dialog.remove();
    };

    backdrop.addEventListener('click', close);
    dialog.querySelector('.confirm-cancel')?.addEventListener('click', close);
    dialog.querySelector('.confirm-ok')?.addEventListener('click', async () => {
      const okBtn = dialog.querySelector('.confirm-ok') as HTMLButtonElement;
      okBtn.disabled = true;
      okBtn.textContent = 'Удаление...';
      await onConfirm();
      close();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
  }

  function escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      if (tierId) {
        const tierToRemove = tiers.find(t => t.id === tierId);
        // NEW: если уровень существующий (уже на сервере) — показать подтверждение
        if (tierToRemove?.existingId) {
          confirmDeleteTier(tierToRemove, async () => {
            try {
              await api.deleteTier(tierToRemove.existingId!);
              tiers = tiers.filter(t => t.id !== tierId);
              render();
              if (onSaved) onSaved();
              showToast(`Уровень «${tierToRemove.name}» удалён`, 'success');
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
              const translated = translateErrorMessage(errMsg);
              showToast(translated, 'error');
            }
          });
        } else {
          // Новый (не сохранённый) уровень — удаляем сразу
          tiers = tiers.filter(t => t.id !== tierId);
          render();
        }
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

      // NEW: Удаляем уровни, которых нет в новом списке, с обработкой ошибок
      for (const existingTier of existingTiers) {
        if (!existingIds.has(existingTier.tier_id)) {
          try {
            await api.deleteTier(existingTier.tier_id);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
            const translated = translateErrorMessage(errMsg);
            // Если ошибка связана с использованием в постах — показываем и прерываем сохранение
            if (translated.toLowerCase().includes('используется') || translated.toLowerCase().includes('публикаци')) {
              showError(`Невозможно удалить уровень «${existingTier.name}»: ${translated}`);
            } else {
              showError(`Ошибка при удалении уровня «${existingTier.name}»: ${translated}`);
            }
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

  // Добавляем CSS-анимацию для тостов
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  document.addEventListener('keydown', onKey);
  render();
  void loadTiers();
  applyInputConstraints();
}
