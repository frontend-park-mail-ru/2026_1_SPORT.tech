/**
 * @fileoverview Страница календаря — записи на занятия и расписание тренера
 * @module pages/MeetingsPage
 */

import type { ApiClient } from '../../utils/api';
import type { AuthResponse } from '../../types/auth.types';
import type { MeetingBooking, MeetingAvailabilitySlot, MeetingAvailabilityRule, MeetingSlot, Subscription } from '../../types/api.types';
import './MeetingsPage.css';

interface MeetingsPageParams {
  currentUser: AuthResponse;
  initialTrainerId?: number;
}

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${time(start)}–${time(end)}`;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}

function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

function toAlignedISO(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return null;
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/forbidden|PermissionDenied|403/i.test(message)) {
    return 'Нет доступа: нужна активная подписка с опцией «Календарь»';
  }
  if (/AlreadyExists|already|taken|409/i.test(message)) {
    return 'Слот уже занят или у вас уже есть активная запись к этому тренеру';
  }
  if (/FailedPrecondition|unavailable/i.test(message)) {
    return 'Этот слот недоступен для записи';
  }
  return 'Не удалось выполнить действие';
}

export async function renderMeetingsPage(
  api: ApiClient,
  container: HTMLElement,
  params: MeetingsPageParams
): Promise<void> {
  const template = (window as any).Handlebars.templates['MeetingsPage.hbs'];
  container.innerHTML = template({});

  const root = container.querySelector('#meetings-root') as HTMLElement;
  const myUserId = params.currentUser.user?.user_id ?? 0;
  const isTrainer = !!params.currentUser.user?.is_trainer;

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

  async function renderAll(): Promise<void> {
    root.innerHTML = '';
    await renderBookSection();
    await renderMyMeetingsSection();
    if (isTrainer) {
      await renderScheduleSection();
      renderAssignSection();
    }
  }

  // ── Мои встречи ────────────────────────────────────────────────────────────
  async function renderMyMeetingsSection(): Promise<void> {
    const card = document.createElement('div');
    card.className = 'meetings-card';
    card.innerHTML = '<h2 class="meetings-card__title">Мои встречи</h2>';

    let bookings: MeetingBooking[] = [];
    try {
      const data = await api.listMyMeetings();
      bookings = data.bookings || [];
    } catch { /* ignore */ }

    const now = Date.now();
    const upcoming = bookings
      .filter(b => b.status === 'confirmed' && new Date(b.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const past = bookings
      .filter(b => !(b.status === 'confirmed' && new Date(b.starts_at).getTime() > now))
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

    if (bookings.length === 0) {
      card.insertAdjacentHTML('beforeend', '<p class="meetings-empty">Пока нет встреч.</p>');
      root.appendChild(card);
      return;
    }

    const list = document.createElement('div');
    list.className = 'meetings-list';
    card.appendChild(list);

    for (const booking of [...upcoming, ...past]) {
      const isUpcoming = booking.status === 'confirmed' && new Date(booking.starts_at).getTime() > now;
      const counterpart = await profileName(booking.other_user_id);
      const roleBadge = booking.role === 'trainer'
        ? '<span class="meeting-badge meeting-badge--trainer">Вы тренер</span>'
        : '<span class="meeting-badge meeting-badge--client">Вы клиент</span>';
      const cancelledBadge = booking.status === 'cancelled'
        ? '<span class="meeting-badge meeting-badge--cancelled">Отменено</span>' : '';

      const item = document.createElement('div');
      item.className = `meeting-item${isUpcoming ? '' : ' meeting-item--past'}`;
      item.innerHTML = `
        <div class="meeting-item__main">
          <span class="meeting-item__when">${formatDateTime(booking.starts_at)} · ${formatTimeRange(booking.starts_at, booking.ends_at)}</span>
          <span class="meeting-item__who">${escapeHtml(counterpart)}${roleBadge}${cancelledBadge}</span>
          ${booking.note ? `<span class="meeting-item__note">${escapeHtml(booking.note)}</span>` : ''}
        </div>
      `;

      if (isUpcoming) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'meetings-btn meetings-btn--ghost';
        cancelBtn.textContent = 'Отменить';
        cancelBtn.addEventListener('click', async () => {
          cancelBtn.disabled = true;
          try {
            await api.cancelMeeting(booking.booking_id);
            await renderAll();
          } catch (err) {
            cancelBtn.disabled = false;
            showError(card, friendlyError(err));
          }
        });
        item.appendChild(cancelBtn);
      }
      list.appendChild(item);
    }

    root.appendChild(card);
  }

  // ── Записаться к тренеру ────────────────────────────────────────────────────
  async function renderBookSection(): Promise<void> {
    const card = document.createElement('div');
    card.className = 'meetings-card';
    card.innerHTML = `
      <h2 class="meetings-card__title">Записаться к тренеру</h2>
      <p class="meetings-card__hint">Доступно по подписке с опцией «Календарь». Запись — на 1 час.</p>
    `;

    let subscriptions: Subscription[] = [];
    try {
      const data = await api.getMySubscriptions();
      subscriptions = (data.subscriptions || []).filter(s => s.active);
    } catch { /* ignore */ }

    const trainers = new Map<number, string>();
    for (const sub of subscriptions) {
      if (!trainers.has(sub.trainer_id)) {
        trainers.set(sub.trainer_id, await profileName(sub.trainer_id));
      }
    }

    if (trainers.size === 0) {
      card.insertAdjacentHTML('beforeend', '<p class="meetings-empty">Нет активных подписок. Оформите подписку на тренера, чтобы записаться.</p>');
      root.appendChild(card);
      return;
    }

    const options = Array.from(trainers.entries())
      .map(([id, name]) => `<option value="${id}"${id === params.initialTrainerId ? ' selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');

    const form = document.createElement('div');
    form.className = 'meetings-form';
    form.innerHTML = `
      <div class="meetings-field">
        <label>Тренер</label>
        <select id="book-trainer">${options}</select>
      </div>
      <button class="meetings-btn" id="book-load">Показать свободные слоты</button>
    `;
    card.appendChild(form);

    const slotsContainer = document.createElement('div');
    slotsContainer.id = 'book-slots';
    card.appendChild(slotsContainer);

    const select = form.querySelector('#book-trainer') as HTMLSelectElement;
    const loadBtn = form.querySelector('#book-load') as HTMLButtonElement;

    async function loadSlots(): Promise<void> {
      const trainerId = Number(select.value);
      if (!trainerId) return;
      slotsContainer.innerHTML = '<p class="meetings-empty">Загрузка…</p>';
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 14);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      let slots: MeetingAvailabilitySlot[] = [];
      try {
        const data = await api.getTrainerAvailability(trainerId, { from: fmt(from), to: fmt(to) });
        slots = data.slots || [];
      } catch (err) {
        slotsContainer.innerHTML = `<div class="meetings-error">${friendlyError(err)}</div>`;
        return;
      }

      if (slots.length === 0) {
        slotsContainer.innerHTML = '<p class="meetings-empty">У тренера нет свободных слотов на ближайшие две недели.</p>';
        return;
      }

      const byDay = new Map<string, MeetingAvailabilitySlot[]>();
      for (const slot of slots) {
        const key = dateKey(slot.starts_at);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(slot);
      }

      slotsContainer.innerHTML = '';
      for (const daySlots of byDay.values()) {
        const dayEl = document.createElement('div');
        dayEl.className = 'slot-day';
        dayEl.innerHTML = `<div class="slot-day__label">${dayLabel(daySlots[0].starts_at)}</div>`;
        const grid = document.createElement('div');
        grid.className = 'slot-grid';
        for (const slot of daySlots) {
          const chip = document.createElement('button');
          chip.className = 'slot-chip';
          chip.textContent = formatTimeRange(slot.starts_at, slot.ends_at);
          chip.addEventListener('click', async () => {
            chip.disabled = true;
            try {
              await api.bookMeeting(trainerId, slot.starts_at);
              await renderAll();
            } catch (err) {
              chip.disabled = false;
              showError(card, friendlyError(err));
            }
          });
          grid.appendChild(chip);
        }
        dayEl.appendChild(grid);
        slotsContainer.appendChild(dayEl);
      }
    }

    loadBtn.addEventListener('click', () => void loadSlots());
    root.appendChild(card);

    if (params.initialTrainerId && trainers.has(params.initialTrainerId)) {
      await loadSlots();
    }
  }

  // ── Моё расписание (тренер) ─────────────────────────────────────────────────
  async function renderScheduleSection(): Promise<void> {
    const card = document.createElement('div');
    card.className = 'meetings-card';
    card.innerHTML = `
      <h2 class="meetings-card__title">Моё расписание</h2>
      <p class="meetings-card__hint">Повторяющиеся слоты задаются по дню недели и часу (UTC). Можно также открыть разовый слот на конкретную дату.</p>
    `;

    let rules: MeetingAvailabilityRule[] = [];
    try {
      const data = await api.listMyAvailabilityRules();
      rules = data.rules || [];
    } catch { /* ignore */ }

    const tags = document.createElement('div');
    tags.className = 'rule-tags';
    if (rules.length === 0) {
      tags.innerHTML = '<span class="meetings-empty">Повторяющихся слотов нет.</span>';
    } else {
      for (const rule of rules) {
        const tag = document.createElement('span');
        tag.className = 'rule-tag';
        tag.innerHTML = `<span>${WEEKDAYS[rule.weekday]}, ${String(rule.start_hour).padStart(2, '0')}:00 UTC</span>`;
        const del = document.createElement('button');
        del.textContent = '×';
        del.title = 'Удалить';
        del.addEventListener('click', async () => {
          try {
            await api.deleteAvailabilityRule(rule.rule_id);
            await renderAll();
          } catch (err) {
            showError(card, friendlyError(err));
          }
        });
        tag.appendChild(del);
        tags.appendChild(tag);
      }
    }
    card.appendChild(tags);

    const weekdayOptions = WEEKDAYS.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    const hourOptions = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');

    const ruleForm = document.createElement('div');
    ruleForm.className = 'meetings-form';
    ruleForm.innerHTML = `
      <div class="meetings-field">
        <label>День недели</label>
        <select id="rule-weekday">${weekdayOptions}</select>
      </div>
      <div class="meetings-field">
        <label>Час (UTC)</label>
        <select id="rule-hour">${hourOptions}</select>
      </div>
      <button class="meetings-btn" id="rule-add">Добавить слот</button>
    `;
    card.appendChild(ruleForm);

    (ruleForm.querySelector('#rule-add') as HTMLButtonElement).addEventListener('click', async () => {
      const weekday = Number((ruleForm.querySelector('#rule-weekday') as HTMLSelectElement).value);
      const hour = Number((ruleForm.querySelector('#rule-hour') as HTMLSelectElement).value);
      try {
        await api.createAvailabilityRule(weekday, hour);
        await renderAll();
      } catch (err) {
        showError(card, friendlyError(err));
      }
    });

    let oneOffSlots: MeetingSlot[] = [];
    try {
      const data = await api.listMyAvailabilitySlots();
      oneOffSlots = data.slots || [];
    } catch { /* ignore */ }

    const slotTags = document.createElement('div');
    slotTags.className = 'rule-tags';
    slotTags.style.marginTop = '14px';
    if (oneOffSlots.length === 0) {
      slotTags.innerHTML = '<span class="meetings-empty">Разовых слотов нет.</span>';
    } else {
      for (const slot of oneOffSlots) {
        const tag = document.createElement('span');
        tag.className = 'rule-tag';
        tag.innerHTML = `<span>${formatDateTime(slot.starts_at)}</span>`;
        const del = document.createElement('button');
        del.textContent = '×';
        del.title = 'Удалить';
        del.addEventListener('click', async () => {
          try {
            await api.deleteAvailabilitySlot(slot.slot_id);
            await renderAll();
          } catch (err) {
            showError(card, friendlyError(err));
          }
        });
        tag.appendChild(del);
        slotTags.appendChild(tag);
      }
    }
    card.appendChild(slotTags);

    const slotForm = document.createElement('div');
    slotForm.className = 'meetings-form';
    slotForm.style.marginTop = '12px';
    slotForm.innerHTML = `
      <div class="meetings-field">
        <label>Разовый слот (дата и час)</label>
        <input type="datetime-local" id="slot-datetime">
      </div>
      <button class="meetings-btn" id="slot-add">Открыть слот</button>
    `;
    card.appendChild(slotForm);

    (slotForm.querySelector('#slot-add') as HTMLButtonElement).addEventListener('click', async () => {
      const value = (slotForm.querySelector('#slot-datetime') as HTMLInputElement).value;
      const iso = toAlignedISO(value);
      if (!iso) {
        showError(card, 'Укажите дату и время слота');
        return;
      }
      try {
        await api.createAvailabilitySlot(iso);
        await renderAll();
      } catch (err) {
        showError(card, friendlyError(err));
      }
    });

    root.appendChild(card);
  }

  // ── Назначить занятие (тренер) ──────────────────────────────────────────────
  function renderAssignSection(): void {
    const card = document.createElement('div');
    card.className = 'meetings-card';
    card.innerHTML = `
      <h2 class="meetings-card__title">Назначить занятие клиенту</h2>
      <p class="meetings-card__hint">Клиент должен иметь активную подписку с опцией «Календарь». Длительность — до 8 часов.</p>
    `;

    const durationOptions = Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1} ч</option>`).join('');
    const form = document.createElement('div');
    form.className = 'meetings-form';
    form.innerHTML = `
      <div class="meetings-field">
        <label>ID клиента</label>
        <input type="number" id="assign-client" min="1" placeholder="напр. 42">
      </div>
      <div class="meetings-field">
        <label>Дата и час</label>
        <input type="datetime-local" id="assign-datetime">
      </div>
      <div class="meetings-field">
        <label>Длительность</label>
        <select id="assign-duration">${durationOptions}</select>
      </div>
      <div class="meetings-field">
        <label>Заметка (необязательно)</label>
        <input type="text" id="assign-note" maxlength="1000" placeholder="комментарий">
      </div>
      <button class="meetings-btn" id="assign-submit">Назначить</button>
    `;
    card.appendChild(form);

    (form.querySelector('#assign-submit') as HTMLButtonElement).addEventListener('click', async () => {
      const clientId = Number((form.querySelector('#assign-client') as HTMLInputElement).value);
      const iso = toAlignedISO((form.querySelector('#assign-datetime') as HTMLInputElement).value);
      const duration = Number((form.querySelector('#assign-duration') as HTMLSelectElement).value);
      const note = (form.querySelector('#assign-note') as HTMLInputElement).value.trim();
      if (!clientId || !iso) {
        showError(card, 'Укажите ID клиента и дату/время');
        return;
      }
      if (clientId === myUserId) {
        showError(card, 'Нельзя назначить занятие самому себе');
        return;
      }
      try {
        await api.assignMeeting({ client_user_id: clientId, starts_at: iso, duration_hours: duration, note: note || undefined });
        await renderAll();
      } catch (err) {
        showError(card, friendlyError(err));
      }
    });

    root.appendChild(card);
  }

  function showError(card: HTMLElement, text: string): void {
    card.querySelector('.meetings-error')?.remove();
    const banner = document.createElement('div');
    banner.className = 'meetings-error';
    banner.textContent = text;
    card.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
  }

  await renderAll();
}
