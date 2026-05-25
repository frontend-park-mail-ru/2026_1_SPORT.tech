/**
 * @fileoverview Поле «дата + час» с поповер-календарём. Замена голого
 * <input type="datetime-local"> в формах тренера.
 * @module components/molecules/DateTimePicker
 */

import { createCalendar, type CalendarControl } from '../../atoms/Calendar/Calendar';
import './DateTimePicker.css';

export interface DateTimePickerConfig {
  label: string;
  placeholder?: string;
  minDate?: Date;
  /** Изначальное значение (день + час). */
  initial?: Date | null;
  /** Час по умолчанию при выборе дня, если значения ещё нет. */
  defaultHour?: number;
}

export interface DateTimePickerControl {
  el: HTMLElement;
  /** Локальная дата с выбранным часом (минуты обнулены) либо null. */
  getValue(): Date | null;
  reset(): void;
}

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function formatValue(d: Date): string {
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const hour = String(d.getHours()).padStart(2, '0');
  return `${day} ${month} ${d.getFullYear()}, ${hour}:00`;
}

export function createDateTimePicker(config: DateTimePickerConfig): DateTimePickerControl {
  let pendingDay: Date | null = config.initial ? new Date(config.initial) : null;
  let hour = config.initial ? config.initial.getHours() : (config.defaultHour ?? 9);
  let open = false;

  const el = document.createElement('div');
  el.className = 'dtp';

  const label = document.createElement('label');
  label.className = 'dtp__label';
  label.textContent = config.label;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dtp__trigger';

  const popover = document.createElement('div');
  popover.className = 'dtp__popover';
  popover.hidden = true;

  function currentValue(): Date | null {
    if (!pendingDay) return null;
    const v = new Date(pendingDay);
    v.setHours(hour, 0, 0, 0);
    return v;
  }

  function syncTrigger(): void {
    const v = currentValue();
    if (v) {
      trigger.textContent = formatValue(v);
      trigger.classList.add('dtp__trigger--filled');
    } else {
      trigger.textContent = config.placeholder ?? 'Выберите дату и время';
      trigger.classList.remove('dtp__trigger--filled');
    }
  }

  // ── Календарь ──
  const calendar: CalendarControl = createCalendar({
    initialMonth: pendingDay ?? config.minDate ?? new Date(),
    selected: pendingDay,
    minDate: config.minDate,
    onSelect: (date) => {
      pendingDay = date;
      syncTrigger();
    },
  });

  // ── Выбор часа ──
  const timeRow = document.createElement('div');
  timeRow.className = 'dtp__time';

  const timeLabel = document.createElement('span');
  timeLabel.className = 'dtp__time-label';
  timeLabel.textContent = 'Время';

  const hourSelect = document.createElement('select');
  hourSelect.className = 'dtp__hour';
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = `${String(h).padStart(2, '0')}:00`;
    if (h === hour) opt.selected = true;
    hourSelect.appendChild(opt);
  }
  hourSelect.addEventListener('change', () => {
    hour = Number(hourSelect.value);
    syncTrigger();
  });

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'dtp__done';
  doneBtn.textContent = 'Готово';
  doneBtn.addEventListener('click', () => setOpen(false));

  timeRow.append(timeLabel, hourSelect, doneBtn);
  popover.append(calendar.el, timeRow);

  function setOpen(value: boolean): void {
    open = value;
    popover.hidden = !open;
    el.classList.toggle('dtp--open', open);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  // Клик вне поповера — закрыть.
  document.addEventListener('click', (e) => {
    if (open && !el.contains(e.target as Node)) setOpen(false);
  });

  el.append(label, trigger, popover);
  syncTrigger();

  return {
    el,
    getValue: currentValue,
    reset() {
      pendingDay = null;
      hour = config.defaultHour ?? 9;
      hourSelect.value = String(hour);
      calendar.setSelected(null);
      syncTrigger();
      setOpen(false);
    },
  };
}
