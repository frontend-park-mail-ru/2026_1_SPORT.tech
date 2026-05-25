/**
 * @fileoverview Переиспользуемая сетка месяца (выбор дня) в стиле крупных
 * сервисов записи. Чистый императивный компонент без Handlebars.
 * @module components/atoms/Calendar
 */

import './Calendar.css';

export interface CalendarConfig {
  /** Месяц, открытый изначально (по умолчанию — месяц выбранной даты или текущий). */
  initialMonth?: Date;
  /** Изначально выбранный день. */
  selected?: Date | null;
  /** Дни раньше этой даты недоступны. */
  minDate?: Date;
  /** Дни позже этой даты недоступны. */
  maxDate?: Date;
  /** Если задано — кликабельны только эти дни (ключи dayKey). null = все в диапазоне. */
  enabledDates?: Set<string> | null;
  /** Дни, помеченные точкой-индикатором (ключи dayKey). */
  markedDates?: Set<string>;
  /** Вызывается при клике по доступному дню. */
  onSelect: (date: Date) => void;
}

export interface CalendarControl {
  el: HTMLElement;
  setSelected(date: Date | null): void;
  setEnabledDates(dates: Set<string> | null): void;
  setMarkedDates(dates: Set<string>): void;
  goToMonth(date: Date): void;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const SHORT_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Стабильный ключ локального дня (без времени). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthValue(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function createCalendar(config: CalendarConfig): CalendarControl {
  let viewMonth = startOfMonth(config.initialMonth ?? config.selected ?? new Date());
  let selected = config.selected ?? null;
  let enabled = config.enabledDates ?? null;
  let marked = config.markedDates ?? new Set<string>();
  const min = config.minDate ? startOfDay(config.minDate) : null;
  const max = config.maxDate ? startOfDay(config.maxDate) : null;
  const today = startOfDay(new Date());

  const el = document.createElement('div');
  el.className = 'cal';

  function isDisabled(day: Date): boolean {
    if (min && day < min) return true;
    if (max && day > max) return true;
    if (enabled && !enabled.has(dayKey(day))) return true;
    return false;
  }

  function render(): void {
    el.innerHTML = '';

    // ── Шапка: навигация по месяцам ──
    const header = document.createElement('div');
    header.className = 'cal__header';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'cal__nav';
    prev.setAttribute('aria-label', 'Предыдущий месяц');
    prev.textContent = '‹';
    prev.disabled = min != null && monthValue(viewMonth) <= monthValue(min);
    prev.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      render();
    });

    const title = document.createElement('span');
    title.className = 'cal__title';
    title.textContent = `${MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'cal__nav';
    next.setAttribute('aria-label', 'Следующий месяц');
    next.textContent = '›';
    next.disabled = max != null && monthValue(viewMonth) >= monthValue(max);
    next.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      render();
    });

    header.append(prev, title, next);
    el.appendChild(header);

    // ── Строка дней недели ──
    const week = document.createElement('div');
    week.className = 'cal__weekdays';
    for (const wd of SHORT_WEEKDAYS) {
      const cell = document.createElement('span');
      cell.className = 'cal__weekday';
      cell.textContent = wd;
      week.appendChild(cell);
    }
    el.appendChild(week);

    // ── Сетка дней ──
    const grid = document.createElement('div');
    grid.className = 'cal__grid';

    // Пустые ячейки до первого дня (неделя с понедельника).
    const firstDay = startOfMonth(viewMonth);
    const lead = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) {
      const blank = document.createElement('span');
      blank.className = 'cal__cell cal__cell--blank';
      grid.appendChild(blank);
    }

    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const key = dayKey(day);
      const disabled = isDisabled(day);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal__cell';
      cell.textContent = String(d);
      if (disabled) cell.classList.add('cal__cell--disabled');
      if (sameDay(day, today)) cell.classList.add('cal__cell--today');
      if (selected && sameDay(day, selected)) cell.classList.add('cal__cell--selected');
      if (marked.has(key)) cell.classList.add('cal__cell--marked');
      cell.disabled = disabled;

      if (!disabled) {
        cell.addEventListener('click', () => {
          selected = day;
          render();
          config.onSelect(day);
        });
      }
      grid.appendChild(cell);
    }

    el.appendChild(grid);
  }

  render();

  return {
    el,
    setSelected(date) { selected = date; render(); },
    setEnabledDates(dates) { enabled = dates; render(); },
    setMarkedDates(dates) { marked = dates; render(); },
    goToMonth(date) { viewMonth = startOfMonth(date); render(); },
  };
}
