/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
import type { Tier } from '../../../types/api.types';
import templates from '../../../templates';
import { getFriendlyErrorMessage } from '../../../utils/errorMessages';
import './TiersModal.css';

export interface TiersModalOptions {
  api: ApiClient;
  onSaved?: () => void;
  onClose?: () => void;
}

interface TierData {
  id: string;           // 'tier-{tier_id}' для существующих, 'new-{counter}' для новых
  name: string;
  price: number;
  description: string;
  chat_enabled: boolean;
  calendar_enabled: boolean;
  index?: number;
  existingId?: number;  // настоящий tier_id с бэкенда
}

export function openTiersModal({ api, onSaved, onClose }: TiersModalOptions): void {
  // Не открываем повторно, если модалка уже есть в DOM
  if (document.querySelector('.tiers-modal-container')) return;

  let tiers: TierData[] = [];
  let tierCounter = 0;
  let loading = true;

  const template = templates['TiersModal.hbs'];

  // Контейнер модального окна
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

  // Генерация HTML без повторной привязки событий
  function render(): void {
    updateIndices();
    const html = template({ tiers, loading });
    container.innerHTML = html;
  }

  // ========== ДЕЛЕГИРОВАННЫЕ СОБЫТИЯ (назначаются один раз) ==========
  container.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    // Ищем ближайший элемент с data-action
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
        description: '',
        chat_enabled: false,
        calendar_enabled: false
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
      } else if (field === 'chat_enabled') {
        tier.chat_enabled = (target as HTMLInputElement).checked;
      } else if (field === 'calendar_enabled') {
        tier.calendar_enabled = (target as HTMLInputElement).checked;
      }
      // Снимаем подсветку ошибки на текущем поле и убираем баннер,
      // как только пользователь начал править значение.
      target.classList.remove('tier-input--error');
      container.querySelector('.tiers-error-message')?.remove();
    }
  });

  // ========== ВАЛИДАЦИЯ ==========
  // Ограничения уровня: имя 1–60 символов, цена 1–1 000 000 ₽, описание ≤ 500.
  // Уровни без названия игнорируем — пользователь мог нажать «+» по ошибке.
  function validate(): { tiers: TierData[]; error: string | null } {
    const meaningful = tiers.filter(t => t.name.trim() || t.price > 0 || t.description.trim());

    if (meaningful.length === 0) {
      return { tiers: [], error: 'Добавьте хотя бы один уровень подписки' };
    }

    // Снимаем подсветку с предыдущей попытки.
    container.querySelectorAll('.tier-input--error').forEach(el => el.classList.remove('tier-input--error'));

    const markError = (tierId: string, field: string): void => {
      const input = container.querySelector<HTMLInputElement>(
        `.tier-input[data-tier-id="${tierId}"][data-field="${field}"]`
      );
      input?.classList.add('tier-input--error');
      input?.focus();
    };

    const seenNames = new Set<string>();

    for (const tier of meaningful) {
      const name = tier.name.trim();
      if (!name) {
        markError(tier.id, 'name');
        return { tiers: [], error: `Уровень ${tier.index}: укажите название` };
      }
      if (name.length < 2) {
        markError(tier.id, 'name');
        return { tiers: [], error: `Уровень ${tier.index}: название слишком короткое (минимум 2 символа)` };
      }
      if (name.length > 60) {
        markError(tier.id, 'name');
        return { tiers: [], error: `Уровень ${tier.index}: название слишком длинное (максимум 60 символов)` };
      }
      const key = name.toLowerCase();
      if (seenNames.has(key)) {
        markError(tier.id, 'name');
        return { tiers: [], error: `Уровень ${tier.index}: название «${name}» уже используется` };
      }
      seenNames.add(key);

      if (!Number.isFinite(tier.price) || tier.price < 0) {
        markError(tier.id, 'price');
        return { tiers: [], error: `Уровень ${tier.index}: цена не может быть отрицательной` };
      }
      if (!Number.isInteger(tier.price)) {
        markError(tier.id, 'price');
        return { tiers: [], error: `Уровень ${tier.index}: цена должна быть целым числом` };
      }
      if (tier.price > 0 && tier.price < 100) {
        markError(tier.id, 'price');
        return { tiers: [], error: `Уровень ${tier.index}: минимальная цена платной подписки — 100 ₽. Поставьте 0 для бесплатного уровня.` };
      }
      if (tier.price > 1_000_000) {
        markError(tier.id, 'price');
        return { tiers: [], error: `Уровень ${tier.index}: цена не может быть больше 1 000 000 ₽` };
      }

      if (tier.description.length > 500) {
        markError(tier.id, 'description');
        return { tiers: [], error: `Уровень ${tier.index}: описание длиннее 500 символов` };
      }
    }

    return { tiers: meaningful, error: null };
  }

  // ========== СОХРАНЕНИЕ ==========
  async function handleSave(saveBtn: HTMLButtonElement): Promise<void> {
    const { tiers: validTiers, error } = validate();

    if (error || validTiers.length === 0) {
      showError(error || 'Не удалось сохранить уровни');
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
          try {
            await api.updateTier(tier.existingId, {
              name: tier.name.trim(),
              price: tier.price,
              description: tier.description.trim() || '',
              chat_enabled: tier.chat_enabled,
              calendar_enabled: tier.calendar_enabled
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
              description: tier.description.trim() || '',
              chat_enabled: tier.chat_enabled,
              calendar_enabled: tier.calendar_enabled
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
      showError(getFriendlyErrorMessage(err.message, 'Не удалось сохранить уровни подписки. Попробуйте ещё раз.'));
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  }

  // ========== ЗАКРЫТИЕ ==========
  function close(): void {
    document.removeEventListener('keydown', onKey);
    container.remove();
    if (onClose) onClose();
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
          chat_enabled: t.chat_enabled ?? false,
          calendar_enabled: t.calendar_enabled ?? false,
          existingId: t.tier_id
        }));
        tierCounter = tiers.length;
      }
    } catch (error) {
      console.error('Failed to load tiers:', error);
      loading = false;
      render();
      showError('Не удалось загрузить существующие уровни');
      return;
    }
    loading = false;
    render();
  }

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  document.addEventListener('keydown', onKey);
  render(); // Первичный рендер с пустым списком
  void loadTiers(); // Загружаем данные с бэкенда
}
