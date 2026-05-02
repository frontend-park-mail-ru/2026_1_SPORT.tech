/**
 * @fileoverview Модальное окно настройки уровней подписки
 * @module components/molecules/TiersModal
 */

import type { ApiClient } from '../../../utils/api';
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
}

export function openTiersModal({ api, onSaved }: TiersModalOptions): void {
  let tiers: TierData[] = [];
  let tierCounter = 0;

  // Получаем скомпилированный шаблон
  const template = templates['TiersModal.hbs'];

  // Создаём контейнер для модального окна
  const container = document.createElement('div');
  container.className = 'tiers-modal-container';

  // Функция рендеринга
  function render(): void {
    const html = template({ tiers });
    container.innerHTML = html;
    bindEvents();
  }

  // Привязка событий
  function bindEvents(): void {
    // Делегирование событий
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
            id: `tier-${Date.now()}-${tierCounter}`,
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

    // Обработка изменений в инпутах
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

    // Обработчик сохранения
    const saveBtn = container.querySelector('[data-action="save"]') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault();
        await handleSave(saveBtn);
      });
    }
  }

  // Сохранение данных
  async function handleSave(saveBtn: HTMLButtonElement): Promise<void> {
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

      if (onSaved) onSaved();
      close();
    } catch (error: unknown) {
      console.error('Failed to save:', error);
      if (onSaved) onSaved();
      close();
    }
  }

  // Закрытие модального окна
  function close(): void {
    document.removeEventListener('keydown', onKey);
    container.remove();
  }

  // Обработчик клавиши Escape
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  // Инициализация
  document.addEventListener('keydown', onKey);
  document.body.appendChild(container);
  render();

  // Загрузка существующих уровней
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
        render();
      }
    })
    .catch(() => {
      // Не удалось загрузить — оставляем пустой список
    });
}
