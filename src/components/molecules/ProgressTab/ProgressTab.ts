/**
 * @fileoverview Вкладка «Прогресс» — история замеров клиента
 * Позволяет клиентам добавлять замеры (вес, % жира, обхваты) и видеть историю.
 */

import type { ApiClient } from '../../../utils/api';
import type { Measurement } from '../../../types/api.types';
import { icons } from '../../../utils/icons';
import './ProgressTab.css';

export interface ProgressTabOptions {
  api: ApiClient;
  userId: number;        // чей прогресс смотрим
  isOwnProfile: boolean; // показывать ли форму добавления
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MeasurementNumberField {
  name: 'weight_kg' | 'body_fat_pct' | 'chest_cm' | 'waist_cm' | 'hips_cm';
  label: string;
  min: number;
  max: number;
  integerOnly?: boolean;
}

const measurementNumberFields: MeasurementNumberField[] = [
  { name: 'weight_kg', label: 'Вес', min: 20, max: 300 },
  { name: 'body_fat_pct', label: '% жира', min: 1, max: 60 },
  { name: 'chest_cm', label: 'Грудь', min: 40, max: 200, integerOnly: true },
  { name: 'waist_cm', label: 'Талия', min: 40, max: 200, integerOnly: true },
  { name: 'hips_cm', label: 'Бёдра', min: 40, max: 200, integerOnly: true }
];

function getMeasurementNumberField(name: string): MeasurementNumberField | undefined {
  return measurementNumberFields.find(field => field.name === name);
}

function parseMeasurementNumber(raw: string, field: MeasurementNumberField): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (!text) return { value: null, error: null };

  const decimalPattern = field.integerOnly ? /^\d+$/ : /^\d+(?:[,.]\d+)?$/;
  if (!decimalPattern.test(text)) {
    return { value: null, error: `${field.label}: введите число` };
  }

  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) {
    return { value: null, error: `${field.label}: введите число` };
  }
  if (value < field.min || value > field.max) {
    return { value: null, error: `${field.label}: от ${field.min} до ${field.max}` };
  }

  return { value, error: null };
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
  return `<tr class="progress-table__row" data-id="${m.measurement_id}">${cells}<td class="progress-table__cell progress-table__cell--actions"><button class="progress-tab__delete-btn" data-id="${m.measurement_id}" title="Удалить">${icons.close}</button></td></tr>`;
}

function renderEmptyState(isOwnProfile: boolean): string {
  if (isOwnProfile) {
    return `
      <div class="progress-tab__empty">
        <div class="progress-tab__empty-icon">${icons.chart}</div>
        <p class="progress-tab__empty-text">Нет замеров</p>
        <p class="progress-tab__empty-hint">Добавьте первый замер, чтобы начать следить за прогрессом</p>
      </div>
    `;
  }
  return `
    <div class="progress-tab__empty">
      <div class="progress-tab__empty-icon">${icons.chart}</div>
      <p class="progress-tab__empty-text">Замеров пока нет</p>
      <p class="progress-tab__empty-hint">Пользователь ещё не добавил ни одного замера</p>
    </div>
  `;
}

function renderTable(measurements: Measurement[], isOwnProfile: boolean): string {
  if (measurements.length === 0) return renderEmptyState(isOwnProfile);

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
  let accessDenied = false;

  const refresh = async (): Promise<void> => {
    accessDenied = false;
    try {
      const resp = await api.getMeasurements(userId, { limit: 100 });
      measurements = resp.measurements ?? [];
    } catch (err: unknown) {
      measurements = [];
      // 403 = тренер не в списке допуска
      if ((err as Error & { data?: { error?: { code?: string } } })?.data?.error?.code === 'PERMISSION_DENIED'
        || (err as Error).message?.toLowerCase().includes('permission')) {
        accessDenied = true;
      }
    }
    renderAll();
  };

  const renderAll = (): void => {
    root.innerHTML = '';

    // Секция "Доступ тренеров" — только для собственного профиля клиента (не тренера)
    if (isOwnProfile) {
      const sharingSection = buildSharingSection();
      if (sharingSection) root.appendChild(sharingSection);
    }

    if (accessDenied && !isOwnProfile) {
      const denied = document.createElement('div');
      denied.className = 'progress-tab__empty';
      denied.innerHTML = `
        <div class="progress-tab__empty-icon">${icons.lock}</div>
        <p class="progress-tab__empty-text">Нет доступа к замерам</p>
        <p class="progress-tab__empty-hint">Клиент не открыл вам доступ к своим данным</p>
      `;
      root.appendChild(denied);
      return;
    }

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
          btn.innerHTML = icons.close;
        }
      });
    }
  };

  const buildForm = (): HTMLElement => {
    const form = document.createElement('form');
    form.className = 'progress-tab__form';
    form.noValidate = true;
    form.innerHTML = `
      <h3 class="progress-tab__form-title">Добавить замер</h3>
      <div class="progress-tab__form-grid">
        <label class="progress-tab__field">
          <span class="progress-tab__label">Дата <span class="progress-tab__required">*</span></span>
          <input class="progress-tab__input" type="date" name="measured_at" value="${todayISO()}" max="${todayISO()}" required>
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Вес (кг)</span>
          <input class="progress-tab__input" type="text" inputmode="decimal" name="weight_kg" data-number-field="weight_kg" maxlength="6" placeholder="75.5">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">% жира</span>
          <input class="progress-tab__input" type="text" inputmode="decimal" name="body_fat_pct" data-number-field="body_fat_pct" maxlength="5" placeholder="18.5">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Грудь (см)</span>
          <input class="progress-tab__input" type="text" inputmode="numeric" name="chest_cm" data-number-field="chest_cm" maxlength="3" placeholder="100">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Талия (см)</span>
          <input class="progress-tab__input" type="text" inputmode="numeric" name="waist_cm" data-number-field="waist_cm" maxlength="3" placeholder="80">
        </label>
        <label class="progress-tab__field">
          <span class="progress-tab__label">Бёдра (см)</span>
          <input class="progress-tab__input" type="text" inputmode="numeric" name="hips_cm" data-number-field="hips_cm" maxlength="3" placeholder="95">
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

    const errorEl = form.querySelector('#progress-form-error') as HTMLElement;

    form.querySelectorAll<HTMLInputElement>('[data-number-field]').forEach(input => {
      input.addEventListener('beforeinput', (event: InputEvent) => {
        if (event.data && /[^0-9.,]/.test(event.data)) {
          event.preventDefault();
        }
      });
      input.addEventListener('input', () => {
        const field = getMeasurementNumberField(input.name);
        const allowedPattern = field?.integerOnly ? /[^\d]/g : /[^\d.,]/g;
        const sanitized = input.value.replace(allowedPattern || /[^\d.,]/g, '');
        if (input.value !== sanitized) {
          input.value = sanitized;
        }
        input.classList.remove('progress-tab__input--error');
        errorEl.textContent = '';
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.progress-tab__submit') as HTMLButtonElement;
      const fd = new FormData(form);

      const weightVal = fd.get('weight_kg') as string;
      const fatVal = fd.get('body_fat_pct') as string;
      const chestVal = fd.get('chest_cm') as string;
      const waistVal = fd.get('waist_cm') as string;
      const hipsVal = fd.get('hips_cm') as string;
      const notesVal = (fd.get('notes') as string).trim();

      form.querySelectorAll('.progress-tab__input--error').forEach(input => {
        input.classList.remove('progress-tab__input--error');
      });

      const measuredAt = (fd.get('measured_at') as string) || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
        errorEl.textContent = 'Укажите дату замера';
        form.querySelector<HTMLInputElement>('input[name="measured_at"]')?.classList.add('progress-tab__input--error');
        return;
      }

      const hasAtLeastOne = Boolean(weightVal || fatVal || chestVal || waistVal || hipsVal);
      if (!hasAtLeastOne) {
        errorEl.textContent = 'Укажите хотя бы одно измерение';
        return;
      }

      const parsedValues: Record<string, number | null> = {};
      for (const field of measurementNumberFields) {
        const input = form.querySelector<HTMLInputElement>(`input[name="${field.name}"]`);
        const parsed = parseMeasurementNumber(input?.value || '', field);
        if (parsed.error) {
          errorEl.textContent = parsed.error;
          input?.classList.add('progress-tab__input--error');
          input?.focus();
          return;
        }
        parsedValues[field.name] = parsed.value;
      }

      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Сохраняем...';

      try {
        await api.createMeasurement({
          measured_at: measuredAt,
          weight_kg: parsedValues.weight_kg,
          body_fat_pct: parsedValues.body_fat_pct,
          chest_cm: parsedValues.chest_cm,
          waist_cm: parsedValues.waist_cm,
          hips_cm: parsedValues.hips_cm,
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

  // Секция управления доступом тренеров к замерам (только для клиента на своём профиле)
  const buildSharingSection = (): HTMLElement | null => {
    const section = document.createElement('div');
    section.className = 'progress-tab__sharing';
    section.innerHTML = `
      <details class="progress-tab__sharing-details">
        <summary class="progress-tab__sharing-summary">
          <span class="progress-tab__sharing-icon">${icons.lock}</span>
          <span>Доступ тренеров к замерам</span>
          <span class="progress-tab__sharing-hint">Выберите тренеров, которые могут видеть ваш прогресс</span>
        </summary>
        <div class="progress-tab__sharing-body">
          <div class="progress-tab__sharing-loading">Загрузка подписок...</div>
        </div>
      </details>
    `;

    const body = section.querySelector('.progress-tab__sharing-body') as HTMLElement;

    // Загружаем одновременно: подписки клиента + текущий список доступа
    Promise.all([
      api.getMySubscriptions().catch(() => ({ subscriptions: [] })),
      api.getMeasurementSharing().catch(() => ({ trainer_user_ids: [] })),
    ]).then(([subData, sharingData]) => {
      const subscriptions = subData.subscriptions ?? [];
      const allowedIds = new Set<number>((sharingData.trainer_user_ids ?? []).map(Number));

      if (subscriptions.length === 0) {
        body.innerHTML = '<p class="progress-tab__sharing-empty">Вы ни на кого не подписаны</p>';
        return;
      }

      // Уникальные тренеры из подписок
      const seen = new Set<number>();
      const trainers = subscriptions.filter(s => {
        if (seen.has(s.trainer_id)) return false;
        seen.add(s.trainer_id);
        return true;
      });

      body.innerHTML = '';

      trainers.forEach(sub => {
        const row = document.createElement('label');
        row.className = 'progress-tab__sharing-row';
        const checked = allowedIds.has(sub.trainer_id) ? 'checked' : '';
        row.innerHTML = `
          <input type="checkbox" class="progress-tab__sharing-checkbox" data-trainer-id="${sub.trainer_id}" ${checked}>
          <span class="progress-tab__sharing-name">Тренер #${sub.trainer_id}</span>
          <span class="progress-tab__sharing-tier">${escapeHtml(sub.tier_name)}</span>
        `;
        body.appendChild(row);
      });

      // Попытка загрузить профили тренеров для отображения имён
      trainers.forEach(sub => {
        api.getProfile(sub.trainer_id).then(profile => {
          const nameEl = body.querySelector(`[data-trainer-id="${sub.trainer_id}"]`)?.nextElementSibling;
          if (nameEl) {
            nameEl.textContent = `${profile.first_name} ${profile.last_name}`;
          }
        }).catch(() => { /* имя недоступно */ });
      });

      const saveBtn = document.createElement('button');
      saveBtn.className = 'progress-tab__sharing-save';
      saveBtn.textContent = 'Сохранить доступ';
      body.appendChild(saveBtn);

      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохраняем...';
        try {
          const selected = Array.from(
            body.querySelectorAll<HTMLInputElement>('.progress-tab__sharing-checkbox:checked')
          ).map(cb => Number(cb.dataset.trainerId));
          await api.setMeasurementSharing(selected);
          saveBtn.innerHTML = `${icons.check}<span>Сохранено</span>`;
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить доступ';
          }, 2000);
        } catch {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Ошибка, попробуйте снова';
        }
      });
    }).catch(() => {
      body.innerHTML = '<p class="progress-tab__sharing-empty">Не удалось загрузить данные</p>';
    });

    return section;
  };

  await refresh();
}
