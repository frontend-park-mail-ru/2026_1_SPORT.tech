/**
 * @fileoverview Календарь встреч — недельная сетка (дни × часы) в стиле
 * Google Calendar. Тренер задаёт рабочие часы прямо на сетке, клиент
 * записывается кликом по свободному часу. Дальше стороны общаются в чате.
 * @module pages/MeetingsPage
 */

import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/auth.types';
import type { MeetingBooking, MeetingAvailabilitySlot, Subscription, Subscriber } from '../../types/api.types';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import './MeetingsPage.css';

interface MeetingsPageParams {
  currentUser: AuthResponse;
  initialTrainerId?: number;
}

type Mode = 'trainer' | 'client';

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const DEFAULT_HOUR_LO = 7;
const DEFAULT_HOUR_HI = 22;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // понедельник = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hourMs(iso: string): number {
  const d = new Date(iso);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GEN[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS_GEN[start.getMonth()]} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]} ${end.getFullYear()}`;
}

function fullDayLabel(d: Date): string {
  const s = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  if (status === 403 || /forbidden|PermissionDenied|403|нет доступа/i.test(message)) {
    return 'Нет доступа: нужна активная подписка с опцией «Календарь»';
  }
  if (status === 409 || /AlreadyExists|already|taken|409/i.test(message)) {
    return 'Слот уже занят или у вас уже есть активная запись к этому тренеру';
  }
  if (/FailedPrecondition|unavailable/i.test(message)) {
    return 'Этот слот недоступен для записи';
  }
  return getFriendlyErrorMessage(err, 'Не удалось выполнить действие. Попробуйте ещё раз.');
}

interface PlacedBooking {
  booking: MeetingBooking;
  dayIndex: number;
  startHour: number;
  span: number;
  name: string;
}

export async function renderMeetingsPage(
  api: ApiClient,
  container: HTMLElement,
  params: MeetingsPageParams
): Promise<void> {
  const template = (window as any).Handlebars.templates['MeetingsPage.hbs'];
  container.innerHTML = template({});

  const root = container.querySelector('#meetings-root') as HTMLElement;
  const isTrainer = !!params.currentUser.user?.is_trainer;

  // ── Состояние ──
  let mode: Mode = params.initialTrainerId ? 'client' : (isTrainer ? 'trainer' : 'client');
  let selectedTrainerId = params.initialTrainerId ?? 0;
  let weekStart = startOfWeek(new Date());
  const trainerNames = new Map<number, string>();
  const clients: { id: number; name: string }[] = [];

  const profileCache = new Map<number, string>();
  async function profileName(userId: number): Promise<string> {
    if (profileCache.has(userId)) return profileCache.get(userId)!;
    let name = `Пользователь #${userId}`;
    try {
      const profile = await api.getProfile(userId);
      name = `${profile.first_name} ${profile.last_name}`.trim() || profile.username;
    } catch { /* ignore */ }
    profileCache.set(userId, name);
    return name;
  }

  // ── Подписки клиента (список тренеров) ──
  async function loadTrainers(): Promise<void> {
    let subscriptions: Subscription[] = [];
    try {
      const data = await api.getMySubscriptions();
      subscriptions = (data.subscriptions || []).filter(s => s.active);
    } catch { /* ignore */ }
    for (const sub of subscriptions) {
      if (!trainerNames.has(sub.trainer_id)) {
        trainerNames.set(sub.trainer_id, await profileName(sub.trainer_id));
      }
    }
    if (!selectedTrainerId && trainerNames.size > 0) {
      selectedTrainerId = trainerNames.keys().next().value as number;
    }
  }

  // ── Клиенты тренера (активные подписчики) ──
  async function loadClients(): Promise<void> {
    if (!isTrainer) return;
    let subscribers: Subscriber[] = [];
    try {
      const data = await api.getMySubscribers();
      subscribers = (data.subscribers || []).filter(s => s.active);
    } catch { /* ignore */ }
    const seen = new Set<number>();
    for (const s of subscribers) {
      if (seen.has(s.client_id)) continue;
      seen.add(s.client_id);
      clients.push({ id: s.client_id, name: await profileName(s.client_id) });
    }
    clients.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // ── Поповер ──
  let activePopover: HTMLElement | null = null;
  let popoverCloser: ((e: MouseEvent) => void) | null = null;
  function closePopover(): void {
    activePopover?.remove();
    activePopover = null;
    if (popoverCloser) {
      document.removeEventListener('click', popoverCloser);
      popoverCloser = null;
    }
  }
  function openPopover(anchor: HTMLElement, content: HTMLElement): void {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'cal-pop';
    pop.appendChild(content);
    document.body.appendChild(pop);
    activePopover = pop;

    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = r.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 6);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    popoverCloser = (e: MouseEvent) => {
      if (activePopover && !activePopover.contains(e.target as Node)) closePopover();
    };
    setTimeout(() => document.addEventListener('click', popoverCloser!), 0);
  }

  function goToChat(userId: number): void {
    closePopover();
    const router = (window as unknown as { router?: { navigateTo: (p: string) => void } }).router;
    router?.navigateTo(`/chat/${userId}`);
  }

  // ── Каркас страницы ──
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'cal';
  page.innerHTML = `
    <div class="cal__banner" id="cal-banner" hidden></div>
    <div class="cal__toolbar">
      <div class="cal__toolbar-left" id="cal-toolbar-left"></div>
      <div class="cal__toolbar-nav">
        <button class="cal__nav-btn" id="cal-prev" aria-label="Предыдущая неделя">‹</button>
        <button class="cal__today" id="cal-today">Сегодня</button>
        <button class="cal__nav-btn" id="cal-next" aria-label="Следующая неделя">›</button>
        <span class="cal__week-label" id="cal-week-label"></span>
      </div>
    </div>
    <div class="cal__legend" id="cal-legend"></div>
    <div class="cal__grid-wrap"><div class="cal__grid" id="cal-grid"></div></div>
    <div class="cal__upcoming" id="cal-upcoming"></div>
  `;
  root.appendChild(page);

  const bannerEl = page.querySelector('#cal-banner') as HTMLElement;
  const toolbarLeft = page.querySelector('#cal-toolbar-left') as HTMLElement;
  const weekLabelEl = page.querySelector('#cal-week-label') as HTMLElement;
  const legendEl = page.querySelector('#cal-legend') as HTMLElement;
  const gridEl = page.querySelector('#cal-grid') as HTMLElement;
  const upcomingEl = page.querySelector('#cal-upcoming') as HTMLElement;

  let bannerTimer: number | undefined;
  function showBanner(text: string, kind: 'error' | 'ok' = 'error'): void {
    bannerEl.textContent = text;
    bannerEl.className = `cal__banner cal__banner--${kind}`;
    bannerEl.hidden = false;
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { bannerEl.hidden = true; }, 5000);
  }

  (page.querySelector('#cal-prev') as HTMLButtonElement).addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    void renderWeek();
  });
  (page.querySelector('#cal-next') as HTMLButtonElement).addEventListener('click', () => {
    weekStart = addDays(weekStart, 7);
    void renderWeek();
  });
  (page.querySelector('#cal-today') as HTMLButtonElement).addEventListener('click', () => {
    weekStart = startOfWeek(new Date());
    void renderWeek();
  });

  // ── Тулбар: переключатель режима + выбор тренера ──
  function renderToolbarLeft(): void {
    toolbarLeft.innerHTML = '';

    if (isTrainer) {
      const toggle = document.createElement('div');
      toggle.className = 'cal__modes';
      const mk = (m: Mode, label: string): HTMLButtonElement => {
        const b = document.createElement('button');
        b.className = `cal__mode${mode === m ? ' cal__mode--active' : ''}`;
        b.textContent = label;
        b.addEventListener('click', () => {
          if (mode === m) return;
          mode = m;
          void renderWeek();
        });
        return b;
      };
      toggle.append(mk('trainer', 'Моё расписание'), mk('client', 'Записаться к тренеру'));
      toolbarLeft.appendChild(toggle);
    }

    if (mode === 'client') {
      const wrap = document.createElement('div');
      wrap.className = 'cal__trainer-pick';
      if (trainerNames.size === 0) {
        wrap.innerHTML = '<span class="cal__muted">Нет активных подписок</span>';
      } else {
        const select = document.createElement('select');
        select.className = 'cal__select';
        for (const [id, name] of trainerNames) {
          const opt = document.createElement('option');
          opt.value = String(id);
          opt.textContent = name;
          if (id === selectedTrainerId) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener('change', () => {
          selectedTrainerId = Number(select.value);
          void renderWeek();
        });
        wrap.appendChild(select);
      }
      toolbarLeft.appendChild(wrap);
    }
  }

  function renderLegend(): void {
    legendEl.innerHTML = mode === 'client'
      ? `<span class="cal__chip cal__chip--free"></span> свободно — клик, чтобы записаться
         <span class="cal__chip cal__chip--mine"></span> ваша запись`
      : `<span class="cal__chip cal__chip--open"></span> открыто для записи
         <span class="cal__chip cal__chip--booked"></span> запись клиента
         <span class="cal__muted">· клик по пустой ячейке — открыть час</span>`;
  }

  // ── Загрузка и отрисовка недели ──
  async function renderWeek(): Promise<void> {
    closePopover();
    renderToolbarLeft();
    renderLegend();
    weekLabelEl.textContent = weekLabel(weekStart);
    gridEl.innerHTML = '<div class="cal__loading">Загрузка…</div>';

    const weekEndExclusive = addDays(weekStart, 7).getTime();
    const inWeek = (ms: number): boolean => ms >= weekStart.getTime() && ms < weekEndExclusive;

    let hourLo = DEFAULT_HOUR_LO;
    let hourHi = DEFAULT_HOUR_HI;
    const widen = (h: number): void => { hourLo = Math.min(hourLo, h); hourHi = Math.max(hourHi, h); };

    const free = new Set<number>();                  // client: свободные часы (ms)
    const slotIds = new Map<number, number>();       // trainer: разовый слот ms -> slot_id
    const ruleIds = new Map<string, number>();       // trainer: `${utcWeekday}-${utcHour}` -> rule_id
    let placed: PlacedBooking[] = [];

    if (mode === 'client') {
      if (!selectedTrainerId) {
        gridEl.innerHTML = '<div class="cal__loading">Оформите подписку на тренера с опцией «Календарь», чтобы записаться.</div>';
        await renderUpcoming();
        return;
      }
      let slots: MeetingAvailabilitySlot[] = [];
      try {
        const data = await api.getTrainerAvailability(selectedTrainerId, {
          from: ymd(addDays(weekStart, -1)),
          to: ymd(addDays(weekStart, 7)),
        });
        slots = data.slots || [];
      } catch (err) {
        gridEl.innerHTML = `<div class="cal__loading cal__loading--error">${escapeHtml(friendlyError(err))}</div>`;
        await renderUpcoming();
        return;
      }
      for (const s of slots) {
        const ms = hourMs(s.starts_at);
        if (!inWeek(ms)) continue;
        free.add(ms);
        widen(new Date(ms).getHours());
      }
      placed = await placeBookings(b => b.role === 'client' && b.other_user_id === selectedTrainerId, inWeek, widen);
    } else {
      const tzOffsetH = -new Date().getTimezoneOffset() / 60;
      try {
        const data = await api.listMyAvailabilityRules();
        for (const r of data.rules || []) {
          ruleIds.set(`${r.weekday}-${r.start_hour}`, r.rule_id);
          widen(((r.start_hour + tzOffsetH) % 24 + 24) % 24);
        }
      } catch { /* ignore */ }
      try {
        const data = await api.listMyAvailabilitySlots();
        for (const s of data.slots || []) {
          const ms = hourMs(s.starts_at);
          if (!inWeek(ms)) continue;
          slotIds.set(ms, s.slot_id);
          widen(new Date(ms).getHours());
        }
      } catch { /* ignore */ }
      placed = await placeBookings(b => b.role === 'trainer', inWeek, widen);
    }

    hourLo = Math.max(0, hourLo);
    hourHi = Math.min(23, hourHi);
    drawGrid(hourLo, hourHi, { free, slotIds, ruleIds, placed });
    await renderUpcoming();
  }

  async function placeBookings(
    pred: (b: MeetingBooking) => boolean,
    inWeek: (ms: number) => boolean,
    widen: (h: number) => void
  ): Promise<PlacedBooking[]> {
    let bookings: MeetingBooking[] = [];
    try {
      const data = await api.listMyMeetings();
      bookings = (data.bookings || []).filter(b => b.status === 'confirmed' && pred(b));
    } catch { /* ignore */ }

    const result: PlacedBooking[] = [];
    for (const b of bookings) {
      const start = new Date(b.starts_at);
      const ms = startOfDay(start).getTime();
      if (!inWeek(new Date(b.starts_at).getTime())) continue;
      const dayIndex = Math.round((ms - weekStart.getTime()) / 86400000);
      if (dayIndex < 0 || dayIndex > 6) continue;
      const startHour = start.getHours();
      const span = Math.max(1, Math.round((new Date(b.ends_at).getTime() - start.getTime()) / 3600000));
      widen(startHour);
      widen(startHour + span - 1);
      result.push({ booking: b, dayIndex, startHour, span, name: await profileName(b.other_user_id) });
    }
    return result;
  }

  function drawGrid(
    hourLo: number,
    hourHi: number,
    data: { free: Set<number>; slotIds: Map<number, number>; ruleIds: Map<string, number>; placed: PlacedBooking[] }
  ): void {
    gridEl.innerHTML = '';
    const rows = hourHi - hourLo + 1;
    gridEl.style.gridTemplateColumns = '56px repeat(7, minmax(0, 1fr))';
    gridEl.style.gridTemplateRows = `40px repeat(${rows}, 46px)`;

    // Угол + заголовки дней
    const corner = document.createElement('div');
    corner.className = 'cal__corner';
    corner.style.gridColumn = '1';
    corner.style.gridRow = '1';
    gridEl.appendChild(corner);

    const today = new Date();
    for (let d = 0; d < 7; d++) {
      const dayDate = addDays(weekStart, d);
      const head = document.createElement('div');
      head.className = `cal__dayhead${sameDay(dayDate, today) ? ' cal__dayhead--today' : ''}`;
      head.style.gridColumn = String(d + 2);
      head.style.gridRow = '1';
      head.innerHTML = `<span class="cal__dayhead-wd">${WEEKDAYS_SHORT[d]}</span><span class="cal__dayhead-num">${dayDate.getDate()}</span>`;
      gridEl.appendChild(head);
    }

    // Часовые метки
    for (let h = hourLo; h <= hourHi; h++) {
      const label = document.createElement('div');
      label.className = 'cal__hourlabel';
      label.style.gridColumn = '1';
      label.style.gridRow = String(h - hourLo + 2);
      label.textContent = `${pad(h)}:00`;
      gridEl.appendChild(label);
    }

    const occupied = new Set<string>();
    for (const p of data.placed) {
      for (let k = 0; k < p.span; k++) occupied.add(`${p.dayIndex}-${p.startHour + k}`);
    }

    // Ячейки
    for (let d = 0; d < 7; d++) {
      const dayDate = addDays(weekStart, d);
      for (let h = hourLo; h <= hourHi; h++) {
        if (occupied.has(`${d}-${h}`)) continue;
        const cellDate = new Date(dayDate);
        cellDate.setHours(h, 0, 0, 0);
        const cell = document.createElement('div');
        cell.className = 'cal__cell';
        cell.style.gridColumn = String(d + 2);
        cell.style.gridRow = String(h - hourLo + 2);
        const ms = cellDate.getTime();
        const isPast = ms < Date.now();

        if (mode === 'client') {
          if (data.free.has(ms) && !isPast) {
            cell.classList.add('cal__cell--free');
            cell.addEventListener('click', (e) => { e.stopPropagation(); onBookCell(cell, cellDate); });
          }
        } else {
          const ruleId = data.ruleIds.get(`${cellDate.getUTCDay()}-${cellDate.getUTCHours()}`);
          const slotId = data.slotIds.get(ms);
          if (ruleId !== undefined || slotId !== undefined) {
            cell.classList.add('cal__cell--open');
            cell.addEventListener('click', (e) => { e.stopPropagation(); onOpenCell(cell, cellDate, ruleId, slotId); });
          } else if (!isPast) {
            cell.classList.add('cal__cell--addable');
            cell.addEventListener('click', (e) => { e.stopPropagation(); onEmptyCell(cell, cellDate); });
          }
        }
        gridEl.appendChild(cell);
      }
    }

    // Блоки встреч поверх сетки
    for (const p of data.placed) {
      if (p.startHour + p.span - 1 < hourLo || p.startHour > hourHi) continue;
      const top = Math.max(p.startHour, hourLo);
      const bottom = Math.min(p.startHour + p.span - 1, hourHi);
      const block = document.createElement('button');
      block.className = `cal__event${mode === 'client' ? ' cal__event--mine' : ' cal__event--booked'}`;
      block.style.gridColumn = String(p.dayIndex + 2);
      block.style.gridRow = `${top - hourLo + 2} / ${bottom - hourLo + 3}`;
      const time = `${pad(new Date(p.booking.starts_at).getHours())}:00`;
      block.innerHTML = `<span class="cal__event-time">${time}</span><span class="cal__event-name">${escapeHtml(p.name)}</span>`;
      block.addEventListener('click', (e) => { e.stopPropagation(); onEventClick(block, p); });
      gridEl.appendChild(block);
    }
  }

  // ── Интеракции: клиент ──
  function onBookCell(anchor: HTMLElement, cellDate: Date): void {
    const content = document.createElement('div');
    content.className = 'cal-pop__body';
    content.innerHTML = `
      <div class="cal-pop__title">Записаться на занятие</div>
      <div class="cal-pop__line">${escapeHtml(fullDayLabel(cellDate))}, ${pad(cellDate.getHours())}:00 — ${pad(cellDate.getHours() + 1)}:00</div>
    `;
    const btn = document.createElement('button');
    btn.className = 'cal-pop__btn';
    btn.textContent = 'Записаться';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.bookMeeting(selectedTrainerId, cellDate.toISOString());
        closePopover();
        showBanner('Вы записаны. Договоритесь о деталях в чате.', 'ok');
        await renderWeek();
      } catch (err) {
        btn.disabled = false;
        showBanner(friendlyError(err));
      }
    });
    content.appendChild(btn);
    openPopover(anchor, content);
  }

  // ── Интеракции: тренер ──
  function onEmptyCell(anchor: HTMLElement, cellDate: Date): void {
    const content = document.createElement('div');
    content.className = 'cal-pop__body';
    content.innerHTML = `
      <div class="cal-pop__title">${escapeHtml(fullDayLabel(cellDate))}, ${pad(cellDate.getHours())}:00</div>
      <div class="cal-pop__label">Открыть час для записи</div>
    `;

    const row = document.createElement('div');
    row.className = 'cal-pop__row';
    const onceBtn = document.createElement('button');
    onceBtn.className = 'cal-pop__btn cal-pop__btn--soft';
    onceBtn.textContent = 'Только в этот день';
    onceBtn.addEventListener('click', () => void doCreate(() => api.createAvailabilitySlot(cellDate.toISOString())));
    const weeklyBtn = document.createElement('button');
    weeklyBtn.className = 'cal-pop__btn cal-pop__btn--soft';
    weeklyBtn.textContent = 'Каждую неделю';
    weeklyBtn.addEventListener('click', () => void doCreate(() => api.createAvailabilityRule(cellDate.getUTCDay(), cellDate.getUTCHours())));
    row.append(onceBtn, weeklyBtn);
    content.appendChild(row);

    async function doCreate(fn: () => Promise<unknown>): Promise<void> {
      try {
        await fn();
        closePopover();
        await renderWeek();
      } catch (err) {
        showBanner(friendlyError(err));
      }
    }

    // Назначить занятие конкретному клиенту
    const divider = document.createElement('div');
    divider.className = 'cal-pop__divider';
    content.appendChild(divider);

    const assignLabel = document.createElement('div');
    assignLabel.className = 'cal-pop__label';
    assignLabel.textContent = 'Назначить занятие клиенту';
    content.appendChild(assignLabel);

    if (clients.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'cal-pop__line cal-pop__muted';
      hint.textContent = 'Нет активных клиентов с подпиской.';
      content.appendChild(hint);
      openPopover(anchor, content);
      return;
    }

    const assignForm = document.createElement('div');
    assignForm.className = 'cal-pop__form';

    const clientSelect = document.createElement('select');
    clientSelect.className = 'cal-pop__input';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Выберите клиента';
    placeholder.disabled = true;
    placeholder.selected = true;
    clientSelect.appendChild(placeholder);
    for (const c of clients) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      clientSelect.appendChild(opt);
    }

    const durationSelect = document.createElement('select');
    durationSelect.className = 'cal-pop__input';
    durationSelect.innerHTML = Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1} ч</option>`).join('');

    const noteInput = document.createElement('input');
    noteInput.className = 'cal-pop__input';
    noteInput.type = 'text';
    noteInput.maxLength = 1000;
    noteInput.placeholder = 'Заметка (необязательно)';

    const errEl = document.createElement('div');
    errEl.className = 'cal-pop__error';
    errEl.hidden = true;
    const showError = (msg: string): void => { errEl.textContent = msg; errEl.hidden = false; };
    const hideError = (): void => { errEl.hidden = true; };
    clientSelect.addEventListener('change', hideError);

    const assignBtn = document.createElement('button');
    assignBtn.className = 'cal-pop__btn';
    assignBtn.textContent = 'Назначить';
    assignBtn.addEventListener('click', async () => {
      const clientId = Number(clientSelect.value);
      const duration = Number(durationSelect.value);
      const note = noteInput.value.trim();
      if (!clientId) { showError('Выберите клиента из списка'); clientSelect.focus(); return; }
      assignBtn.disabled = true;
      hideError();
      try {
        await api.assignMeeting({ client_user_id: clientId, starts_at: cellDate.toISOString(), duration_hours: duration, note: note || undefined });
        closePopover();
        showBanner('Занятие назначено клиенту.', 'ok');
        await renderWeek();
      } catch (err) {
        assignBtn.disabled = false;
        showError(friendlyError(err));
      }
    });

    assignForm.append(clientSelect, durationSelect, noteInput, errEl, assignBtn);
    content.appendChild(assignForm);

    openPopover(anchor, content);
  }

  function onOpenCell(anchor: HTMLElement, cellDate: Date, ruleId?: number, slotId?: number): void {
    const content = document.createElement('div');
    content.className = 'cal-pop__body';
    const recurring = ruleId !== undefined && slotId === undefined;
    content.innerHTML = `
      <div class="cal-pop__title">${escapeHtml(fullDayLabel(cellDate))}, ${pad(cellDate.getHours())}:00</div>
      <div class="cal-pop__line">${recurring ? 'Открыто каждую неделю' : 'Открыто в этот день'}</div>
    `;
    const btn = document.createElement('button');
    btn.className = 'cal-pop__btn cal-pop__btn--danger';
    btn.textContent = recurring ? 'Убрать (каждую неделю)' : 'Убрать слот';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (slotId !== undefined) await api.deleteAvailabilitySlot(slotId);
        else if (ruleId !== undefined) await api.deleteAvailabilityRule(ruleId);
        closePopover();
        await renderWeek();
      } catch (err) {
        btn.disabled = false;
        showBanner(friendlyError(err));
      }
    });
    content.appendChild(btn);
    openPopover(anchor, content);
  }

  // ── Интеракции: клик по встрече ──
  function onEventClick(anchor: HTMLElement, p: PlacedBooking): void {
    const b = p.booking;
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    const content = document.createElement('div');
    content.className = 'cal-pop__body';
    content.innerHTML = `
      <div class="cal-pop__title">${escapeHtml(p.name)}</div>
      <div class="cal-pop__line">${escapeHtml(fullDayLabel(start))}, ${pad(start.getHours())}:00 — ${pad(end.getHours())}:00</div>
      <div class="cal-pop__line">${mode === 'client' ? 'Вы записаны как клиент' : 'Запись вашего клиента'}</div>
      ${b.note ? `<div class="cal-pop__note">${escapeHtml(b.note)}</div>` : ''}
    `;
    const row = document.createElement('div');
    row.className = 'cal-pop__row';
    const chatBtn = document.createElement('button');
    chatBtn.className = 'cal-pop__btn cal-pop__btn--soft';
    chatBtn.textContent = 'Написать в чате';
    chatBtn.addEventListener('click', () => goToChat(b.other_user_id));
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cal-pop__btn cal-pop__btn--danger';
    cancelBtn.textContent = 'Отменить';
    cancelBtn.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      try {
        await api.cancelMeeting(b.booking_id);
        closePopover();
        await renderWeek();
      } catch (err) {
        cancelBtn.disabled = false;
        showBanner(friendlyError(err));
      }
    });
    row.append(chatBtn, cancelBtn);
    content.appendChild(row);
    openPopover(anchor, content);
  }

  // ── Список ближайших встреч ──
  async function renderUpcoming(): Promise<void> {
    let bookings: MeetingBooking[] = [];
    try {
      const data = await api.listMyMeetings();
      bookings = data.bookings || [];
    } catch { /* ignore */ }

    const now = Date.now();
    const upcoming = bookings
      .filter(b => b.status === 'confirmed' && new Date(b.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 6);

    upcomingEl.innerHTML = '<h2 class="cal__upcoming-title">Ближайшие встречи</h2>';
    if (upcoming.length === 0) {
      upcomingEl.insertAdjacentHTML('beforeend', '<p class="cal__muted">Запланированных встреч пока нет.</p>');
      return;
    }
    const list = document.createElement('div');
    list.className = 'cal__upcoming-list';
    for (const b of upcoming) {
      const start = new Date(b.starts_at);
      const name = await profileName(b.other_user_id);
      const roleBadge = b.role === 'trainer'
        ? '<span class="cal__badge cal__badge--trainer">Вы тренер</span>'
        : '<span class="cal__badge cal__badge--client">Вы клиент</span>';
      const item = document.createElement('button');
      item.className = 'cal__upcoming-item';
      item.innerHTML = `
        <span class="cal__upcoming-when">${escapeHtml(fullDayLabel(start))}, ${pad(start.getHours())}:00</span>
        <span class="cal__upcoming-who">${escapeHtml(name)} ${roleBadge}</span>
      `;
      item.addEventListener('click', () => {
        weekStart = startOfWeek(start);
        void renderWeek();
      });
      list.appendChild(item);
    }
    upcomingEl.appendChild(list);
  }

  await Promise.all([loadTrainers(), loadClients()]);
  await renderWeek();
}
