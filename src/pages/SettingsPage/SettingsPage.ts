import './SettingsPage.css';
import type { ApiClient } from '../../utils/api';
import type {
  AuthResponse,
  SportType,
  NotificationPreferences,
  PrivacySettings,
  TrainerSport
} from '../../types/api.types';
import { escapeHtml } from '../../utils/profilePageData';

interface SettingsPageParams {
  currentUser: AuthResponse;
  onLogout?: (() => Promise<void>) | null;
  clearCurrentUser?: (() => void) | null;
  reload: () => Promise<void>;
  navigateTo: (path: string) => void;
}

type TabId = 'account' | 'security' | 'notifications' | 'privacy';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'account', label: 'Аккаунт и роль' },
  { id: 'security', label: 'Безопасность' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'privacy', label: 'Приватность' }
];

const NOTIFICATION_FIELDS: Array<{ key: keyof NotificationPreferences; label: string; hint: string }> = [
  { key: 'comments', label: 'Комментарии', hint: 'Кто-то прокомментировал ваш пост' },
  { key: 'likes', label: 'Лайки', hint: 'Кто-то оценил ваш пост' },
  { key: 'posts', label: 'Новые посты', hint: 'Авторы, на которых вы подписаны, публикуют материалы' },
  { key: 'subscriptions', label: 'Подписки', hint: 'Новые подписки и изменения тарифов' },
  { key: 'donations', label: 'Донаты', hint: 'Полученные донаты' },
  { key: 'meetings', label: 'Встречи', hint: 'Напоминания и изменения по встречам' }
];

const PRIVACY_FIELDS: Array<{ key: keyof PrivacySettings; label: string; hint: string }> = [
  { key: 'show_profile_in_search', label: 'Показывать профиль в поиске', hint: 'Ваш профиль виден в каталоге и поиске' },
  { key: 'allow_measurement_sharing', label: 'Делиться замерами с тренерами', hint: 'Разрешить выбранным тренерам видеть ваши замеры' },
  { key: 'show_activity_status', label: 'Показывать статус активности', hint: 'Другие видят, когда вы были онлайн' }
];

function showToast(message: string, kind: 'success' | 'error'): void {
  const toast = document.createElement('div');
  toast.className = `settings-toast settings-toast--${kind}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add('settings-toast--visible'));
  window.setTimeout(() => {
    toast.classList.remove('settings-toast--visible');
    window.setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Скелетон строк-переключателей на время загрузки настроек (вместо текста «Загрузка…»).
function skeletonToggles(count: number): string {
  const row = `
    <div class="settings-skeleton__row">
      <div class="settings-skeleton__text">
        <span class="settings-skeleton__bar settings-skeleton__bar--label"></span>
        <span class="settings-skeleton__bar settings-skeleton__bar--hint"></span>
      </div>
      <span class="settings-skeleton__switch"></span>
    </div>`;
  return `<div class="settings-skeleton" aria-hidden="true">${row.repeat(count)}</div>`;
}

function toggleRow(key: string, label: string, hint: string, checked: boolean): string {
  return `
    <label class="settings-toggle">
      <span class="settings-toggle__text">
        <span class="settings-toggle__label">${escapeHtml(label)}</span>
        <span class="settings-toggle__hint">${escapeHtml(hint)}</span>
      </span>
      <span class="settings-toggle__switch">
        <input type="checkbox" data-pref="${escapeHtml(key)}" ${checked ? 'checked' : ''}>
        <span class="settings-toggle__slider"></span>
      </span>
    </label>
  `;
}

export async function renderSettingsPage(
  api: ApiClient,
  container: HTMLElement,
  params: SettingsPageParams
): Promise<void> {
  const { currentUser, clearCurrentUser, reload, navigateTo } = params;

  const initialTab = (new URLSearchParams(window.location.search).get('tab') as TabId) || 'account';
  let activeTab: TabId = TABS.some(t => t.id === initialTab) ? initialTab : 'account';

  container.innerHTML = `
    <div class="settings-page">
      <header class="settings-page__header">
        <h1 class="settings-page__title">Настройки</h1>
        <p class="settings-page__subtitle">Управляйте аккаунтом, безопасностью и уведомлениями</p>
      </header>
      <div class="settings-page__layout">
        <nav class="settings-page__tabs" id="settings-tabs">
          ${TABS.map(t => `
            <button type="button" class="settings-tab${t.id === activeTab ? ' settings-tab--active' : ''}" data-tab="${t.id}">
              ${escapeHtml(t.label)}
            </button>
          `).join('')}
        </nav>
        <section class="settings-page__panel" id="settings-panel"></section>
      </div>
    </div>
  `;

  const panel = container.querySelector('#settings-panel') as HTMLElement;
  const tabsNav = container.querySelector('#settings-tabs') as HTMLElement;

  const renderActive = (): void => {
    tabsNav.querySelectorAll('.settings-tab').forEach(btn => {
      btn.classList.toggle('settings-tab--active', (btn as HTMLElement).dataset.tab === activeTab);
    });
    switch (activeTab) {
    case 'account': renderAccountTab(api, panel, currentUser, reload); break;
    case 'security': renderSecurityTab(api, panel); break;
    case 'notifications': void renderNotificationsTab(api, panel); break;
    case 'privacy': renderPrivacyTab(api, panel, navigateTo); break;
    }
  };

  tabsNav.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('.settings-tab') as HTMLElement | null;
    if (!btn) return;
    activeTab = btn.dataset.tab as TabId;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    history.replaceState(history.state, '', url.toString());
    renderActive();
  });

  renderActive();
}

// ─── Account & role tab ──────────────────────────────────────────────────────

function renderAccountTab(
  api: ApiClient,
  panel: HTMLElement,
  currentUser: AuthResponse,
  reload: () => Promise<void>
): void {
  const user = currentUser.user;
  if (user.is_trainer) {
    panel.innerHTML = `
      <div class="settings-card">
        <h2 class="settings-card__title">Роль аккаунта</h2>
        <p class="settings-card__lead">Вы уже зарегистрированы как тренер. Вам доступны публикации, тарифы, финансы и встречи.</p>
        <div class="settings-badge settings-badge--trainer">Тренер</div>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="settings-card">
      <h2 class="settings-card__title">Стать тренером</h2>
      <p class="settings-card__lead">Откройте профиль тренера: публикуйте материалы, продавайте подписки, проводите встречи и принимайте донаты. Переход в статус тренера необратим.</p>
      <form class="settings-form" id="become-trainer-form" novalidate>
        <div class="settings-field">
          <label class="settings-field__label" for="bt-education">Образование / степень</label>
          <input class="settings-field__input" id="bt-education" type="text" maxlength="255" placeholder="Например: МСМК, КМС, тренер высшей категории">
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="bt-career">Карьера с</label>
          <input class="settings-field__input" id="bt-career" type="date">
        </div>
        <div class="settings-field">
          <span class="settings-field__label">Виды спорта</span>
          <div id="bt-sports" class="settings-sports"></div>
          <button type="button" class="settings-btn settings-btn--ghost" id="bt-add-sport">+ Добавить вид спорта</button>
        </div>
        <div class="settings-form__error" id="bt-error" hidden></div>
        <div class="settings-form__actions">
          <button type="submit" class="settings-btn settings-btn--primary" id="bt-submit">Стать тренером</button>
        </div>
      </form>
    </div>
  `;

  const sportsContainer = panel.querySelector('#bt-sports') as HTMLElement;
  const errorEl = panel.querySelector('#bt-error') as HTMLElement;
  const form = panel.querySelector('#become-trainer-form') as HTMLFormElement;
  const submitBtn = panel.querySelector('#bt-submit') as HTMLButtonElement;
  const addSportBtn = panel.querySelector('#bt-add-sport') as HTMLButtonElement;
  let sportTypes: SportType[] = [];

  // Пока грузится справочник видов спорта — показываем скелетон строки и
  // блокируем «+ Добавить», чтобы не было пустоты и кликов вхолостую.
  sportsContainer.innerHTML = `
    <div class="settings-skeleton__sport" aria-hidden="true">
      <span class="settings-skeleton__bar settings-skeleton__bar--field"></span>
    </div>`;
  addSportBtn.disabled = true;

  const addSportRow = (): void => {
    const row = document.createElement('div');
    row.className = 'settings-sport-row';
    row.innerHTML = `
      <select class="settings-field__input settings-sport-row__type">
        ${sportTypes.map(s => `<option value="${s.sport_type_id}">${escapeHtml(s.name)}</option>`).join('')}
      </select>
      <input class="settings-field__input settings-sport-row__exp" type="number" min="0" max="80" placeholder="Стаж, лет">
      <input class="settings-field__input settings-sport-row__rank" type="text" maxlength="100" placeholder="Разряд (необяз.)">
      <button type="button" class="settings-sport-row__remove" title="Убрать">✕</button>
    `;
    row.querySelector('.settings-sport-row__remove')!.addEventListener('click', () => row.remove());
    sportsContainer.appendChild(row);
  };

  api.getSportTypes()
    .then(data => {
      sportTypes = data.sport_types || [];
      sportsContainer.innerHTML = '';
      addSportBtn.disabled = false;
      addSportRow();
    })
    .catch(() => {
      sportsContainer.innerHTML = '<p class="settings-form__error">Не удалось загрузить виды спорта</p>';
    });

  addSportBtn.addEventListener('click', () => {
    if (sportTypes.length) addSportRow();
  });

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    errorEl.hidden = true;

    const sports: TrainerSport[] = [];
    sportsContainer.querySelectorAll('.settings-sport-row').forEach(row => {
      const typeId = Number((row.querySelector('.settings-sport-row__type') as HTMLSelectElement).value);
      const exp = Number((row.querySelector('.settings-sport-row__exp') as HTMLInputElement).value || '0');
      const rank = (row.querySelector('.settings-sport-row__rank') as HTMLInputElement).value.trim();
      if (typeId > 0) {
        sports.push({ sport_type_id: typeId, experience_years: exp, ...(rank ? { sports_rank: rank } : {}) });
      }
    });

    if (sports.length === 0) {
      errorEl.textContent = 'Добавьте хотя бы один вид спорта';
      errorEl.hidden = false;
      return;
    }

    const education = (panel.querySelector('#bt-education') as HTMLInputElement).value.trim();
    const career = (panel.querySelector('#bt-career') as HTMLInputElement).value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохраняем…';
    try {
      await api.becomeTrainer({
        sports,
        career_since_date: career || '',
        ...(education ? { education_degree: education } : {})
      });
      showToast('Поздравляем! Теперь вы тренер.', 'success');
      await reload();
    } catch (err) {
      errorEl.textContent = (err as Error).message || 'Не удалось выполнить переход';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Стать тренером';
    }
  });
}

// ─── Security tab ────────────────────────────────────────────────────────────

function renderSecurityTab(api: ApiClient, panel: HTMLElement): void {
  panel.innerHTML = `
    <div class="settings-card">
      <h2 class="settings-card__title">Смена пароля</h2>
      <form class="settings-form" id="password-form" novalidate>
        <div class="settings-field">
          <label class="settings-field__label" for="pwd-current">Текущий пароль</label>
          <input class="settings-field__input" id="pwd-current" type="password" autocomplete="current-password">
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="pwd-new">Новый пароль</label>
          <input class="settings-field__input" id="pwd-new" type="password" autocomplete="new-password">
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="pwd-repeat">Повторите новый пароль</label>
          <input class="settings-field__input" id="pwd-repeat" type="password" autocomplete="new-password">
        </div>
        <div class="settings-form__error" id="pwd-error" hidden></div>
        <div class="settings-form__actions">
          <button type="submit" class="settings-btn settings-btn--primary">Сохранить пароль</button>
        </div>
      </form>
    </div>

    <div class="settings-card">
      <h2 class="settings-card__title">Смена email</h2>
      <form class="settings-form" id="email-form" novalidate>
        <div class="settings-field">
          <label class="settings-field__label" for="email-new">Новый email</label>
          <input class="settings-field__input" id="email-new" type="email" autocomplete="email">
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="email-pwd">Текущий пароль</label>
          <input class="settings-field__input" id="email-pwd" type="password" autocomplete="current-password">
        </div>
        <div class="settings-form__error" id="email-error" hidden></div>
        <div class="settings-form__actions">
          <button type="submit" class="settings-btn settings-btn--primary">Сменить email</button>
        </div>
      </form>
    </div>
  `;

  const pwdForm = panel.querySelector('#password-form') as HTMLFormElement;
  const pwdError = panel.querySelector('#pwd-error') as HTMLElement;
  pwdForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    pwdError.hidden = true;
    const current = (panel.querySelector('#pwd-current') as HTMLInputElement).value;
    const next = (panel.querySelector('#pwd-new') as HTMLInputElement).value;
    const repeat = (panel.querySelector('#pwd-repeat') as HTMLInputElement).value;
    if (next.length < 8) {
      pwdError.textContent = 'Новый пароль должен быть не короче 8 символов';
      pwdError.hidden = false;
      return;
    }
    if (next !== repeat) {
      pwdError.textContent = 'Пароли не совпадают';
      pwdError.hidden = false;
      return;
    }
    const btn = pwdForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await api.changePassword({ current_password: current, new_password: next, new_password_repeat: repeat });
      pwdForm.reset();
      showToast('Пароль обновлён', 'success');
    } catch (err) {
      pwdError.textContent = (err as Error).message || 'Не удалось сменить пароль';
      pwdError.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  const emailForm = panel.querySelector('#email-form') as HTMLFormElement;
  const emailError = panel.querySelector('#email-error') as HTMLElement;
  emailForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    emailError.hidden = true;
    const newEmail = (panel.querySelector('#email-new') as HTMLInputElement).value.trim();
    const pwd = (panel.querySelector('#email-pwd') as HTMLInputElement).value;
    const btn = emailForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await api.changeEmail({ new_email: newEmail, current_password: pwd });
      emailForm.reset();
      showToast('Email обновлён', 'success');
    } catch (err) {
      emailError.textContent = (err as Error).message || 'Не удалось сменить email';
      emailError.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Notifications tab ───────────────────────────────────────────────────────

async function renderNotificationsTab(api: ApiClient, panel: HTMLElement): Promise<void> {
  panel.innerHTML = `
    <div class="settings-card">
      <h2 class="settings-card__title">Уведомления</h2>
      <p class="settings-card__lead">Выберите, о чём вас оповещать.</p>
      ${skeletonToggles(NOTIFICATION_FIELDS.length)}
    </div>
  `;
  let prefs: NotificationPreferences;
  try {
    prefs = { ...await api.getNotificationPreferences(), email_digest: false };
  } catch {
    panel.innerHTML = '<div class="settings-card"><p class="settings-form__error">Не удалось загрузить настройки уведомлений</p></div>';
    return;
  }

  panel.innerHTML = `
    <div class="settings-card">
      <h2 class="settings-card__title">Уведомления</h2>
      <p class="settings-card__lead">Выберите, о чём вас оповещать.</p>
      <div class="settings-toggles">
        ${NOTIFICATION_FIELDS.map(f => toggleRow(f.key, f.label, f.hint, prefs[f.key])).join('')}
      </div>
    </div>
  `;

  panel.querySelectorAll('input[data-pref]').forEach(input => {
    input.addEventListener('change', async () => {
      const next: NotificationPreferences = { ...prefs, email_digest: false };
      panel.querySelectorAll('input[data-pref]').forEach(el => {
        const key = (el as HTMLInputElement).dataset.pref as keyof NotificationPreferences;
        next[key] = (el as HTMLInputElement).checked;
      });
      try {
        prefs = await api.updateNotificationPreferences(next);
        showToast('Настройки уведомлений сохранены', 'success');
      } catch (err) {
        (input as HTMLInputElement).checked = !(input as HTMLInputElement).checked;
        showToast((err as Error).message || 'Не удалось сохранить', 'error');
      }
    });
  });
}

// ─── Privacy + danger zone tab ───────────────────────────────────────────────

function renderPrivacyTab(api: ApiClient, panel: HTMLElement, navigateTo: (path: string) => void): void {
  panel.innerHTML = `
    <div class="settings-card">
      <h2 class="settings-card__title">Приватность</h2>
      <div class="settings-toggles" id="privacy-toggles">
        ${skeletonToggles(PRIVACY_FIELDS.length)}
      </div>
    </div>
    <div class="settings-card settings-card--danger">
      <h2 class="settings-card__title">Управление аккаунтом</h2>
      <div class="settings-danger-row">
        <div>
          <div class="settings-toggle__label">Выйти на всех устройствах</div>
          <div class="settings-toggle__hint">Завершить все активные сессии</div>
        </div>
        <button type="button" class="settings-btn settings-btn--ghost" id="logout-all-btn">Выйти везде</button>
      </div>
      <div class="settings-danger-row">
        <div>
          <div class="settings-toggle__label">Удалить аккаунт</div>
          <div class="settings-toggle__hint">Аккаунт и связанные данные будут удалены без возможности восстановления</div>
        </div>
        <button type="button" class="settings-btn settings-btn--danger" id="delete-account-btn">Удалить аккаунт</button>
      </div>
    </div>
  `;

  const togglesEl = panel.querySelector('#privacy-toggles') as HTMLElement;
  let settings: PrivacySettings;

  api.getPrivacySettings()
    .then(loaded => {
      settings = loaded;
      togglesEl.innerHTML = PRIVACY_FIELDS.map(f => toggleRow(f.key, f.label, f.hint, settings[f.key])).join('');
      togglesEl.querySelectorAll('input[data-pref]').forEach(input => {
        input.addEventListener('change', async () => {
          const next: PrivacySettings = { ...settings };
          togglesEl.querySelectorAll('input[data-pref]').forEach(el => {
            const key = (el as HTMLInputElement).dataset.pref as keyof PrivacySettings;
            next[key] = (el as HTMLInputElement).checked;
          });
          try {
            settings = await api.updatePrivacySettings(next);
            showToast('Настройки приватности сохранены', 'success');
          } catch (err) {
            (input as HTMLInputElement).checked = !(input as HTMLInputElement).checked;
            showToast((err as Error).message || 'Не удалось сохранить', 'error');
          }
        });
      });
    })
    .catch(() => {
      togglesEl.innerHTML = '<p class="settings-form__error">Не удалось загрузить настройки приватности</p>';
    });

  (panel.querySelector('#logout-all-btn') as HTMLButtonElement).addEventListener('click', async () => {
    if (!window.confirm('Завершить все сессии и выйти?')) return;
    try {
      await api.logoutAllSessions();
    } catch (err) {
      showToast((err as Error).message || 'Не удалось выйти', 'error');
    } finally {
      clearCurrentUser?.();
      navigateTo('/auth/login');
    }
  });

  (panel.querySelector('#delete-account-btn') as HTMLButtonElement).addEventListener('click', () => {
    openDeleteAccountDialog(api, navigateTo);
  });
}

function openDeleteAccountDialog(api: ApiClient, navigateTo: (path: string) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal__overlay';
  overlay.innerHTML = `
    <div class="settings-modal" role="dialog" aria-modal="true">
      <h3 class="settings-modal__title">Удаление аккаунта</h3>
      <p class="settings-modal__text">Это действие необратимо. Введите текущий пароль для подтверждения.</p>
      <input class="settings-field__input" id="delete-pwd" type="password" autocomplete="current-password" placeholder="Текущий пароль">
      <div class="settings-form__error" id="delete-error" hidden></div>
      <div class="settings-modal__actions">
        <button type="button" class="settings-btn settings-btn--ghost" id="delete-cancel">Отмена</button>
        <button type="button" class="settings-btn settings-btn--danger" id="delete-confirm">Удалить навсегда</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = (): void => overlay.remove();
  overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  (overlay.querySelector('#delete-cancel') as HTMLButtonElement).addEventListener('click', close);

  const errorEl = overlay.querySelector('#delete-error') as HTMLElement;
  (overlay.querySelector('#delete-confirm') as HTMLButtonElement).addEventListener('click', async () => {
    const pwd = (overlay.querySelector('#delete-pwd') as HTMLInputElement).value;
    if (!pwd) {
      errorEl.textContent = 'Введите пароль';
      errorEl.hidden = false;
      return;
    }
    const confirmBtn = overlay.querySelector('#delete-confirm') as HTMLButtonElement;
    confirmBtn.disabled = true;
    try {
      await api.deleteAccount(pwd);
      clearCurrentUser?.();
      close();
      navigateTo('/auth/login');
    } catch (err) {
      errorEl.textContent = (err as Error).message || 'Не удалось удалить аккаунт';
      errorEl.hidden = false;
      confirmBtn.disabled = false;
    }
  });
}
