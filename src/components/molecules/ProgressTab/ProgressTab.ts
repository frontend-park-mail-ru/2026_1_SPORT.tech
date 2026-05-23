/**
 * @fileoverview Вкладка «Прогресс» — история замеров клиента
 * Позволяет клиентам добавлять замеры (вес, % жира, обхваты) и видеть историю.
 */

import type { ApiClient } from '../../../utils/api';
import type { Measurement } from '../../../types/api.types';
import './ProgressTab.css';

export interface ProgressTabOptions {
  api: ApiClient;
  userId: number;       // чей прогресс смотрим
  isOwnProfile: boolean; // показывать ли форму добавления
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function renderMeasurementRow(m: Measurement): string {
  const date = formatDate(m.measured_at);
  const cells = [
    `<td class="progress-table__cell progress-table__cell--date">${escapeHtml(date)}</td>`,
    `<td class="progress-table__cell">${m.weight_kg != null ? `${m.weight_kg} кг` : '—'}</td>`,
    `<td class="progress-table__cell">${m.body_fat_pct != null ? `${m.body_fat_pct}%` : '—'}</td>`,
    `<td class="progress-table__cell">${m.chest_cm != null ? `${m.chest_cm} см` : '—'}</td>`,
    `<td class="progress-table__cell">${m.waist_cm != null ? `${m.waist_cm} см` : '—'}</td>`,
    `<td class="progress-table__cell">${m.hips_cm != null ? `${m.hips_cm} см` : '—'}</td>`,
    `<td class="progress-table__cell progress-table__cell--notes">${m.notes ? escapeHtml(m.notes) : '—'}</td>`,
  ].join('');
  return `<tr class="progress-table__row" data-id="${m.measurement_id}">${cells}<td class="progress-table__cell progress-table__cell--actions"><button class="progress-tab__delete-btn" data-id="${m.measurement_id}" title="Удалить">✕</button></td></tr>`;
}

function renderEmptyState(): string {
  return `
    <div class="progress-tab__empty">
      <div class="progress-tab__empty-icon">📊</div>
      <p class="progress-tab__empty-text">Нет замеров</p>
      <p class="progress-tab__empty-hint">Добавьте первый замер, чтобы начать следить за прогрессом</p>
    </div>
  `;
}

function renderTable(measurements: Measurement[], isOwnProfile: boolean): string {
  if (measurements.length === 0) return renderEmptyState();

  const headers = ['Дата', 'Вес', '% жира', 'Грудь', 'Талия', 'Бёдра', 'Заметки', ...(isOwnProfile ? [''] : [])];
  const thead = `<thead><tr>${headers.map(h => `<th class="progress-table__header">${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${measurements.map(renderMeasurementRow).join('')}</tbody>`;

  return `
    <div class="progress-table-wrapper">
      <table class="progress-table">${thead}${tbody}</table>
    </div>
  `;
}

export async function renderProgressTab(container: HTMLElement, options: ProgressTabOptions): Promise<void> {
  const { api, userId, isOwnProfile } = options;

  container.innerHTML = '<div class="progress-tab"><div class="progress-tab__loading">Загрузка...</div></div>';
  const root = container.querySelector('.progress-tab') as HTMLElement;

  let measurements: Measurement[] = [];

  const refresh = async (): Promise<void> => {
    try {
      const resp = await api.getMeasurements(userId, { limit: 100 });
      measurements = resp.measurements ?? [];
    } catch {
      measurements = [];
    }
    renderAll();
  };

  const renderAll = (): void => {
    root.innerHTML = '';

    if (isOwnProfile) {
      root.appendChild(buildForm());
    }

    const tableContainer = document.createElement('div');
    tableContainer.className = 'progress-tab__table-container';
    tableContainer.innerHTML = renderTable(measurements, isOwnProfile);
    root.appendChild(tableContainer);

    if (isOwnProfile) {
      // Делегированный клик на удаление
      tableContainer.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest('.progress-tab__delete-btn') as HTMLButtonElement | null;
        if (!btn) return;
        const id = Number(btn.dataset.id);
        if (!Number.isFinite(id)) return;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          await api.deleteMeasurement(id);
          await refresh();
        } catch {
          btn.disabled = false;
          btn.textContent = '✕';
        }
      });
    }
  };

  const buildForm = (): HTMLElement => {
    const form = document.createElement('form');
    form.className = 'progress-tab__form';
    form.innerHTML = `
      <h3 class="progress-tab__form-title">Добавить замер</h3>
      <div class="progress-tab__form-grid">
        <label class="progress-tab__field">
          <span class="progress-tab__label">Дата <span class="progress-tab__required">*</span></span>
          <input class="progress-tab__input" type="date" name="measured_at" value="${todayISO()}" max="${todayISO()}" required>
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Вес (кг)</span>
          <input class="progress-tab__input" type="number" name="weight_kg" min="20" max="300" step="0.1" placeholder="75.5">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">% жира</span>
          <input class="progress-tab__input" type="number" name="body_fat_pct" min="1" max="60" step="0.1" placeholder="18.5">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Грудь (см)</span>
          <input class="progress-tab__input" type="number" name="chest_cm" min="40" max="200" step="1" placeholder="100">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Талия (см)</span>
          <input class="progress-tab__input" type="number" name="waist_cm" min="40" max="200" step="1" placeholder="80">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Бёдра (см)</span>
          <input class="progress-tab__input" type="number" name="hips_cm" min="40" max="200" step="1" placeholder="95">
        </label>
        <label class="progress-tab__field progress-tab__field--full">
          <span class="progress-tab__label">Заметки</span>
          <input class="progress-tab__input" type="text" name="notes" maxlength="500" placeholder="Как прошла неделя...">
        </label>
      </div>
      <div class="progress-tab__form-footer">
        <span class="progress-tab__form-error" id="progress-form-error"></span>
        <button class="progress-tab__submit" type="submit">Сохранить замер</button>
      </div>
    `;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = form.querySelector('#progress-form-error') as HTMLElement;
      const submitBtn = form.querySelector('.progress-tab__submit') as HTMLButtonElement;
      const fd = new FormData(form);

      const weightVal = fd.get('weight_kg') as string;
      const fatVal = fd.get('body_fat_pct') as string;
      const chestVal = fd.get('chest_cm') as string;
      const waistVal = fd.get('waist_cm') as string;
      const hipsVal = fd.get('hips_cm') as string;
      const notesVal = (fd.get('notes') as string).trim();

      const hasAtLeastOne = weightVal || fatVal || chestVal || waistVal || hipsVal;
      if (!hasAtLeastOne) {
        errorEl.textContent = 'Укажите хотя бы одно измерение';
        return;
      }

      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Сохраняем...';

      try {
        await api.createMeasurement({
          measured_at: fd.get('measured_at') as string,
          weight_kg: weightVal ? parseFloat(weightVal) : null,
          body_fat_pct: fatVal ? parseFloat(fatVal) : null,
          chest_cm: chestVal ? parseInt(chestVal) : null,
          waist_cm: waistVal ? parseInt(waistVal) : null,
          hips_cm: hipsVal ? parseInt(hipsVal) : null,
          notes: notesVal || null,
        });
        form.reset();
        (form.querySelector('input[name="measured_at"]') as HTMLInputElement).value = todayISO();
        await refresh();
      } catch (err: unknown) {
        errorEl.textContent = (err as Error).message || 'Ошибка сохранения';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Сохранить замер';
      }
    });

    return form;
  };

  await refresh();
}
