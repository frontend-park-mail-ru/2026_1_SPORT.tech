import Handlebars from 'handlebars';
import { API_BASE_URL } from './config/constants';
import { ApiClient } from './utils/api';
import { escapeHtml, mapProfileData, getUserRoleLabel } from './utils/profilePageData';
import { getFriendlyErrorMessage } from './utils/errorMessages';
import type { AuthResponse } from './types/auth.types';
import type { Router } from './types/router.types';
import { renderSidebar, setActivePage, resetSidebarSessionState } from './components/organisms/Sidebar/Sidebar';
import './styles/index.css';
import templates from './templates';

// Регистрируем шаблоны глобально
(window as unknown as { Handlebars: typeof Handlebars }).Handlebars = Handlebars;
(Handlebars as typeof Handlebars & { templates: Record<string, Handlebars.TemplateDelegate> }).templates = templates;

// ─── Boot / loading screens ──────────────────────────────────────────────────

function renderBootScreen(container: HTMLElement, message = 'Загружаем интерфейс'): void {
  if (!container) return;
  container.innerHTML = `
    <div class="app-loader" aria-live="polite" aria-busy="true">
      <div class="app-loader__panel">
        <div class="app-loader__brand">SPORT.tech</div>
        <div class="app-loader__spinner"></div>
        <p class="app-loader__message">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

/** Скелетон только для контентной области (не трогает сайдбар). */
function renderContentSkeleton(content: HTMLElement): void {
  content.innerHTML = `
    <div class="content-skeleton">
      <div class="page-skeleton page-skeleton--header">
        <div class="page-skeleton__block page-skeleton__block--cover"></div>
        <div class="page-skeleton__row">
          <div class="page-skeleton__block page-skeleton__block--avatar"></div>
          <div class="page-skeleton__meta">
            <div class="page-skeleton__block page-skeleton__block--name"></div>
            <div class="page-skeleton__block page-skeleton__block--role"></div>
          </div>
        </div>
      </div>
      <div class="page-skeleton page-skeleton--content">
        <div class="page-skeleton__row page-skeleton__row--tabs">
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
        </div>
        <div class="page-skeleton__block page-skeleton__block--card"></div>
        <div class="page-skeleton__block page-skeleton__block--card"></div>
      </div>
    </div>
  `;
}

function renderProfileSkeleton(content: HTMLElement): void {
  content.innerHTML = `
    <div class="content-skeleton">
      <div class="profile-header profile-header--skeleton" aria-busy="true">
        <div class="profile-header__main">
          <div class="profile-header__avatar-wrapper">
            <div class="page-skeleton__block profile-header__avatar"></div>
          </div>
          <div class="profile-header__body">
            <div class="page-skeleton__block" style="height:32px;width:62%;margin-bottom:10px;border-radius:8px;"></div>
            <div class="page-skeleton__block" style="height:16px;width:80%;margin-bottom:18px;border-radius:6px;"></div>
            <div class="page-skeleton__block" style="height:14px;width:90%;margin-bottom:8px;border-radius:6px;"></div>
            <div class="page-skeleton__block" style="height:14px;width:55%;margin-bottom:18px;border-radius:6px;"></div>
            <div class="page-skeleton__actions">
              <div class="page-skeleton__block page-skeleton__action"></div>
              <div class="page-skeleton__block page-skeleton__action"></div>
              <div class="page-skeleton__block page-skeleton__action"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="page-skeleton page-skeleton--content">
        <div class="page-skeleton__row page-skeleton__row--tabs">
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
          <div class="page-skeleton__block page-skeleton__block--tab"></div>
        </div>
        <div class="page-skeleton__block page-skeleton__block--card"></div>
        <div class="page-skeleton__block page-skeleton__block--card"></div>
      </div>
    </div>
  `;
}

// ─── Persistent app shell ────────────────────────────────────────────────────

/**
 * Ссылка на <aside class="sidebar"> — создаётся один раз при первом
 * аутентифицированном переходе и живёт всю сессию.
 */
let sidebarElement: HTMLElement | null = null;

/**
 * Создаёт структуру «сайдбар-спейсер + контент» в #app, если её ещё нет.
 * Возвращает контентный контейнер (#app-content).
 */
function ensureShell(app: HTMLElement): HTMLElement {
  let content = document.getElementById('app-content');
  if (content) return content;

  app.innerHTML = '';
  app.classList.add('app--shell');
  app.classList.remove('auth-page');

  const sidebarSlot = document.createElement('div');
  sidebarSlot.id = 'app-sidebar';

  content = document.createElement('div');
  content.id = 'app-content';

  app.appendChild(sidebarSlot);
  app.appendChild(content);

  return content;
}

/** Разрушает шелл (при логауте — возвращаемся к чистому #app). */
function destroyShell(app: HTMLElement): void {
  sidebarElement = null;
  app.innerHTML = '';
  app.classList.remove('app--shell');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createLogoutHandler(
  api: ApiClient,
  setCurrentUser: (user: AuthResponse | null) => void,
  navigateTo: (path: string) => void
): () => Promise<void> {
  return async () => {
    try {
      await api.logout();
    } catch (error: unknown) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('cached_user');
      // Сбрасываем кеш диалогов и SSE-поток, иначе у следующего аккаунта
      // в чате остаются сообщения предыдущего.
      resetSidebarSessionState();
      navigateTo('/auth/login');
    }
  };
}

function setPageTitle(suffix?: string | null): void {
  document.title = suffix ? `Sporteon - ${suffix}` : 'Sporteon';
}

function renderRouteError(message: string, level: 'h2' | 'h3' = 'h3'): string {
  return `
    <div style="color:red;padding:20px">
      <${level}>Ошибка</${level}>
      <p>${escapeHtml(getFriendlyErrorMessage(message))}</p>
    </div>
  `;
}

// ─── Router ──────────────────────────────────────────────────────────────────

function createRouter(api: ApiClient): Router {
  let currentUserPromise: Promise<AuthResponse | null> | null = null;
  // Монотонный счётчик навигаций: если за время асинхронной загрузки страницы
  // пользователь успел перейти дальше, «устаревший» рендер не должен затирать DOM.
  let routingSeq = 0;

  function setCurrentUser(user: AuthResponse | null): void {
    currentUserPromise = Promise.resolve(user);
  }

  async function getCurrentUser(options?: { force: boolean }): Promise<AuthResponse | null> {
    if (!options?.force && currentUserPromise) {
      return currentUserPromise;
    }
    currentUserPromise = api.getCurrentUser().catch((error: Error) => {
      currentUserPromise = null;
      throw error;
    });
    return currentUserPromise;
  }

  function navigateTo(path: string): void {
    // Повторный клик по уже открытому маршруту не должен дёргать полный
    // ре-рендер (мерцание скелетоном).
    if (path === window.location.pathname) return;
    history.pushState({}, '', path);
    void handleRouting();
  }

  // Принудительно перерисовать текущий маршрут со свежими данными пользователя.
  // Нужно, когда путь не меняется (например, правка профиля/смена аватара на
  // /profile), поэтому navigateTo тут бесполезен. Сбрасываем кэш currentUser и
  // сайдбар, чтобы новый avatar_url подхватился и в шапке, и в боковом меню.
  async function reload(): Promise<void> {
    await getCurrentUser({ force: true });
    sidebarElement = null;
    await handleRouting();
  }

  /**
   * Инициализирует сайдбар один раз. При повторных вызовах только обновляет
   * активную вкладку — DOM не пересоздаётся, мерцания нет.
   */
  async function syncSidebar(
    app: HTMLElement,
    currentUser: AuthResponse,
    activePage: string,
    onLogout: () => Promise<void>
  ): Promise<void> {
    const sidebarSlot = document.getElementById('app-sidebar');
    if (!sidebarSlot) return;

    if (!sidebarElement) {
      // Первый вход — рендерим сайдбар
      const user = currentUser.user;
      const sidebarUser = user ? {
        id: user.user_id,
        name: `${user.first_name} ${user.last_name}`.trim() || user.username,
        role: getUserRoleLabel(user.is_trainer),
        avatar: user.avatar_url ?? null,
        isTrainer: user.is_trainer,
      } : null;

      sidebarElement = await renderSidebar(sidebarSlot, {
        activePage,
        currentUser: sidebarUser,
        users: [],
        api,
        onLogout,
      });
    } else {
      // Последующие переходы — только меняем активный пункт
      setActivePage(sidebarElement, activePage);
    }
  }

  // ─── Page renderers ─────────────────────────────────────────────────────

  async function showAuthPage(
    app: HTMLElement,
    mode: 'login' | 'register' | 'register-trainer' = 'login'
  ): Promise<void> {
    destroyShell(app);
    setPageTitle(mode === 'login' ? 'Вход' : mode === 'register-trainer' ? 'Регистрация тренера' : 'Регистрация');
    renderBootScreen(app, mode === 'login' ? 'Загружаем страницу входа' : 'Загружаем страницу регистрации');
    app.classList.add('auth-page');
    try {
      const { renderAuthPage } = await import('./pages/AuthPage/AuthPage');
      await renderAuthPage(app, api, mode);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load AuthPage:', err);
      app.innerHTML = renderRouteError(err.message, 'h2');
    }
  }

  async function showHomePage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean): Promise<void> {
    setPageTitle('Главная');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    // Сайдбар обновляется мгновенно — контент грузится параллельно
    void syncSidebar(app, currentUser, 'home', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderHomePage } = await import('./pages/HomePage/HomePage');
      if (isStale()) return;
      await renderHomePage(api, content, {});
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load HomePage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showProfilePage(
    app: HTMLElement,
    currentUser: AuthResponse,
    isStale: () => boolean,
    viewed?: number | string
  ): Promise<void> {
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);
    if (viewed === undefined && !currentUser?.user?.user_id) { navigateTo('/auth/login'); return; }

    const content = ensureShell(app);
    void syncSidebar(app, currentUser, 'profile', onLogout);

    renderProfileSkeleton(content);
    try {
      const profileData = typeof viewed === 'string'
        ? await api.getProfileByUsername(viewed)
        : await api.getProfile(viewed ?? currentUser.user.user_id);
      if (isStale()) return;
      if (typeof viewed === 'number' && profileData.username) {
        history.replaceState(history.state, '', `/profile/${encodeURIComponent(profileData.username)}`);
      }
      const mappedData = mapProfileData(profileData, currentUser);
      setPageTitle(mappedData.profile.isOwnProfile ? 'Мой профиль' : mappedData.profile.name);

      const { renderProfilePage } = await import('./pages/ProfilePage/ProfilePage');
      if (isStale()) return;
      await renderProfilePage(api, content, {
        profile: mappedData.profile,
        currentUser: mappedData.currentUser,
        subscriptions: [],
        posts: [],
        activeTab: 'main',
        popularPosts: [],
        viewedUserId: profileData.user_id,
        onLogout,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load ProfilePage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showNotificationsPage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean): Promise<void> {
    setPageTitle('Уведомления');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'notifications', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderNotificationsPage } = await import('./pages/NotificationsPage/NotificationsPage');
      if (isStale()) return;
      await renderNotificationsPage(api, content, { currentUser, onLogout });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load NotificationsPage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showSettingsPage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean): Promise<void> {
    setPageTitle('Настройки');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'settings', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderSettingsPage } = await import('./pages/SettingsPage/SettingsPage');
      if (isStale()) return;
      await renderSettingsPage(api, content, {
        currentUser,
        onLogout,
        clearCurrentUser: () => setCurrentUser(null),
        reload,
        navigateTo,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load SettingsPage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showFinancePage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean): Promise<void> {
    setPageTitle('Финансы');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'finance', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderFinancePage } = await import('./pages/FinancePage/FinancePage');
      if (isStale()) return;
      await renderFinancePage(api, content, { currentUser });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load FinancePage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showChatPage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean, initialUserId?: number): Promise<void> {
    setPageTitle('Чат');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'chat', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderChatPage } = await import('./pages/ChatPage/ChatPage');
      if (isStale()) return;
      await renderChatPage(api, content, { currentUser, initialUserId });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load ChatPage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showMeetingsPage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean, initialTrainerId?: number): Promise<void> {
    setPageTitle('Календарь');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'meetings', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderMeetingsPage } = await import('./pages/MeetingsPage/MeetingsPage');
      if (isStale()) return;
      await renderMeetingsPage(api, content, { currentUser, initialTrainerId });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load MeetingsPage:', err);
      content.innerHTML = renderRouteError(err.message);
    }
  }

  async function showPaymentReturnPage(app: HTMLElement, currentUser: AuthResponse, isStale: () => boolean): Promise<void> {
    setPageTitle('Оплата');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, '', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderPaymentReturnPage } = await import('./pages/PaymentReturnPage/PaymentReturnPage');
      if (isStale()) return;
      await renderPaymentReturnPage(api, content, { currentUser, onLogout });
    } catch (error: unknown) {
      const err = error as Error;
      content.innerHTML = renderRouteError(err.message);
    }
  }

  // ─── Routing ─────────────────────────────────────────────────────────────

  async function handleRouting(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;

    const seq = ++routingSeq;
    const isStale = (): boolean => seq !== routingSeq;

    let currentUser: AuthResponse | null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      currentUser = null;
    }
    if (isStale()) return;

    const isAuthenticated = !!currentUser;
    const path = window.location.pathname;
    const viewedProfileMatch = path.match(/^\/profile\/([^/]+)$/);
    const chatWithMatch = path.match(/^\/chat\/(\d+)$/);
    const meetingsWithMatch = path.match(/^\/meetings\/(\d+)$/);

    if (path === '/index.html') {
      navigateTo(isAuthenticated ? '/' : '/auth/login');
      return;
    }
    if (path === '/auth' || path === '/auth/login') {
      if (isAuthenticated) navigateTo('/');
      else await showAuthPage(app, 'login');
      return;
    }
    if (path === '/auth/register') {
      if (isAuthenticated) navigateTo('/');
      else await showAuthPage(app, 'register');
      return;
    }
    if (path === '/auth/register/trainer') {
      if (isAuthenticated) navigateTo('/');
      else await showAuthPage(app, 'register-trainer');
      return;
    }
    if (!isAuthenticated) {
      navigateTo('/auth/login');
      return;
    }

    // Все маршруты ниже — только для аутентифицированных
    if (path === '/') {
      await showHomePage(app, currentUser!, isStale);
    } else if (path === '/profile') {
      await showProfilePage(app, currentUser!, isStale);
    } else if (viewedProfileMatch) {
      const slug = decodeURIComponent(viewedProfileMatch[1]);
      await showProfilePage(app, currentUser!, isStale, /^\d+$/.test(slug) ? Number(slug) : slug);
    } else if (path === '/notifications') {
      await showNotificationsPage(app, currentUser!, isStale);
    } else if (path === '/settings') {
      await showSettingsPage(app, currentUser!, isStale);
    } else if (path === '/finance') {
      if (!currentUser!.user.is_trainer) {
        navigateTo('/');
        return;
      }
      await showFinancePage(app, currentUser!, isStale);
    } else if (path === '/chat') {
      await showChatPage(app, currentUser!, isStale);
    } else if (chatWithMatch) {
      await showChatPage(app, currentUser!, isStale, Number(chatWithMatch[1]));
    } else if (path === '/meetings') {
      await showMeetingsPage(app, currentUser!, isStale);
    } else if (meetingsWithMatch) {
      await showMeetingsPage(app, currentUser!, isStale, Number(meetingsWithMatch[1]));
    } else if (path === '/payment/return') {
      await showPaymentReturnPage(app, currentUser!, isStale);
    } else if (path === '/payment/cancel') {
      navigateTo('/');
    } else {
      navigateTo('/');
    }
  }

  return { handleRouting, navigateTo, reload, setCurrentUser, getCurrentUser };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

/**
 * Глобальный фолбэк для битых картинок: вместо браузерной «сломанной картинки»
 * показываем инициалы (берём из alt, где у аватаров лежит имя) либо нейтральный
 * плейсхолдер. Событие `error` не всплывает, поэтому слушаем в фазе захвата.
 */
function installBrokenImageFallback(): void {
  document.addEventListener('error', (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    // Пустой src="" тоже стреляет `error` в браузере, хотя это не «битая»
    // картинка, а просто отсутствие фото. Подменять её инициалами нельзя —
    // иначе поверх настоящего плейсхолдера встаёт фантомный фолбэк.
    if (!target.getAttribute('src')) return;
    if (target.dataset.fallbackApplied) return;
    target.dataset.fallbackApplied = '1';

    const name = (target.getAttribute('alt') || '').trim();
    if (name) {
      const initials = name
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';
      const fallback = document.createElement('span');
      fallback.className = 'avatar-fallback';
      fallback.textContent = initials;
      target.replaceWith(fallback);
    } else {
      // Контентное медиа без имени — просто прячем, плейсхолдер блока остаётся.
      target.style.visibility = 'hidden';
    }
  }, true);
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }

  installBrokenImageFallback();

  // Регистрируем Service Worker для офлайн-поддержки
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err: Error) => {
      console.error('SW registration failed:', err);
    });
  }

  const apiClient = new ApiClient(API_BASE_URL);
  const router = createRouter(apiClient);
  (window as unknown as { router: Router }).router = router;

  renderBootScreen(app);
  await router.handleRouting();

  window.addEventListener('popstate', () => {
    void router.handleRouting();
  });
});
