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

  // Создаём backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;';

  // Создаём панель модального окна
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:white;border-radius:16px;padding:32px;width:90%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

  // Заголовок
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;';
  header.innerHTML = `
    <h2 style="margin:0;font-size:22px;font-weight:700;color:#1A2B3C;">Настройка уровней подписки</h2>
    <button id="tiers-close-btn" style="border:none;background:transparent;color:#999;font-size:28px;cursor:pointer;padding:4px 8px;border-radius:6px;">×</button>
  `;

  // Список уровней
  const tiersList = document.createElement('div');
  tiersList.id = 'tiers-list';
  tiersList.style.cssText = 'display:flex;flex-direction:column;gap:16px;margin-bottom:16px;';
  tiersList.innerHTML = '<p style="color:#999;text-align:center;padding:32px 20px;margin:0;">Нет созданных уровней</p>';

  // Кнопка добавить
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.style.cssText = 'width:100%;padding:12px;border:2px dashed #CBD5E1;border-radius:10px;background:#F8FAFC;color:#64748B;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:24px;';
  addBtn.innerHTML = '➕ Добавить уровень';

  // Кнопки действий
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.style.cssText = 'padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;background:transparent;color:#E85A2B;';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Сохранить';
  saveBtn.style.cssText = 'padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;background:#E85A2B;color:white;';

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
      tiersList.innerHTML = '<p style="color:#999;text-align:center;padding:32px 20px;margin:0;">Нет созданных уровней</p>';
      return;
    }

    tiers.forEach((tier, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #E2E8F0;border-radius:12px;padding:20px;background:#F8FAFC;margin-bottom:12px;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <span style="font-size:13px;font-weight:600;color:#E85A2B;">Уровень ${index + 1}</span>
          <button class="tier-remove-btn" data-id="${tier.id}" style="border:none;background:none;color:#999;font-size:22px;cursor:pointer;padding:0 6px;">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="display:block;font-size:13px;color:#4A5568;margin-bottom:6px;">Название</label>
            <input type="text" class="tier-name-input" data-id="${tier.id}" value="${tier.name}" placeholder="Например: Базовый" style="width:100%;height:40px;padding:0 14px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:13px;color:#4A5568;margin-bottom:6px;">Цена (₽/мес)</label>
            <input type="number" class="tier-price-input" data-id="${tier.id}" value="${tier.price || ''}" placeholder="0" min="0" style="width:100%;height:40px;padding:0 14px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:13px;color:#4A5568;margin-bottom:6px;">Описание</label>
            <input type="text" class="tier-desc-input" data-id="${tier.id}" value="${tier.description}" placeholder="Что получает подписчик" style="width:100%;height:40px;padding:0 14px;border:1px solid #E2E8F0;border-radius:8px;font-size:14px;box-sizing:border-box;">
          </div>
        </div>
      `;

      // Удаление уровня
      card.querySelector('.tier-remove-btn')?.addEventListener('click', () => {
        tiers = tiers.filter(t => t.id !== tier.id);
        renderTiers();
      });

      // Изменение названия
      card.querySelector('.tier-name-input')?.addEventListener('input', (e: Event) => {
        tier.name = (e.target as HTMLInputElement).value;
      });

      // Изменение цены
      card.querySelector('.tier-price-input')?.addEventListener('input', (e: Event) => {
        tier.price = Number((e.target as HTMLInputElement).value) || 0;
      });

      // Изменение описания
      card.querySelector('.tier-desc-input')?.addEventListener('input', (e: Event) => {
        tier.description = (e.target as HTMLInputElement).value;
      });

      tiersList.appendChild(card);
    });
  }

  // Закрытие
  function close(): void {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    panel.remove();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  // Обработчики событий
  backdrop.addEventListener('click', close);
  header.querySelector('#tiers-close-btn')?.addEventListener('click', close);

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

      if (onSaved) onSaved();
      close();
    } catch (error: unknown) {
      console.error('Failed to save:', error);
      if (onSaved) onSaved();
      close();
    }
  });

  // Добавляем в DOM
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
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
