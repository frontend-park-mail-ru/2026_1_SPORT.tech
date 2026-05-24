import Handlebars from 'handlebars';
import { API_BASE_URL } from './config/constants';
import { ApiClient } from './utils/api';
import { mapProfileData, getUserRoleLabel } from './utils/profilePageData';
import type { AuthResponse } from './types/auth.types';
import type { Router } from './types/router.types';
import { renderSidebar, setActivePage } from './components/organisms/Sidebar/Sidebar';
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
        <p class="app-loader__message">${message}</p>
      </div>
    </div>
  `;
}

/** Скелетон только для контентной области (не трогает сайдбар). */
function renderContentSkeleton(content: HTMLElement): void {
  content.innerHTML = `
    <div class="content-skeleton">
      <div class="page-skeleton page-skeleton--header"></div>
      <div class="page-skeleton page-skeleton--content"></div>
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
      setCurrentUser(null);
      localStorage.removeItem('user');
      navigateTo('/auth');
    } catch (error: unknown) {
      console.error('Logout error:', error);
    }
  };
}

function setPageTitle(suffix?: string | null): void {
  document.title = suffix ? `Sporteon — ${suffix}` : 'Sporteon';
}

// ─── Router ──────────────────────────────────────────────────────────────────

function createRouter(api: ApiClient): Router {
  let currentUserPromise: Promise<AuthResponse | null> | null = null;

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
    history.pushState({}, '', path);
    void handleRouting();
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

  async function showAuthPage(app: HTMLElement): Promise<void> {
    destroyShell(app);
    setPageTitle('Вход');
    renderBootScreen(app, 'Загружаем страницу входа');
    app.classList.add('auth-page');
    try {
      const { renderAuthPage } = await import('./pages/AuthPage/AuthPage');
      await renderAuthPage(app, api);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load AuthPage:', err);
      app.innerHTML = `<div style="color:red;padding:20px"><h2>Ошибка</h2><p>${err.message}</p></div>`;
    }
  }

  async function showHomePage(app: HTMLElement, currentUser: AuthResponse): Promise<void> {
    setPageTitle('Главная');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    // Сайдбар обновляется мгновенно — контент грузится параллельно
    void syncSidebar(app, currentUser, 'home', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderHomePage } = await import('./pages/HomePage/HomePage');
      await renderHomePage(api, content, {});
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load HomePage:', err);
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showProfilePage(
    app: HTMLElement,
    currentUser: AuthResponse,
    viewedUserId?: number
  ): Promise<void> {
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);
    const userId = viewedUserId ?? currentUser?.user?.user_id;
    if (!userId) { navigateTo('/auth'); return; }

    const content = ensureShell(app);
    void syncSidebar(app, currentUser, 'profile', onLogout);

    renderContentSkeleton(content);
    try {
      const profileData = await api.getProfile(userId);
      const mappedData = mapProfileData(profileData, currentUser);
      setPageTitle(mappedData.profile.isOwnProfile ? 'Мой профиль' : mappedData.profile.name);

      const { renderProfilePage } = await import('./pages/ProfilePage/ProfilePage');
      await renderProfilePage(api, content, {
        profile: mappedData.profile,
        currentUser: mappedData.currentUser,
        subscriptions: [],
        posts: [],
        activeTab: 'publications',
        popularPosts: [],
        viewedUserId: userId,
        onLogout,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load ProfilePage:', err);
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showNotificationsPage(app: HTMLElement, currentUser: AuthResponse): Promise<void> {
    setPageTitle('Уведомления');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'notifications', onLogout);

    try {
      const { renderNotificationsPage } = await import('./pages/NotificationsPage/NotificationsPage');
      await renderNotificationsPage(api, content, { currentUser, onLogout });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load NotificationsPage:', err);
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showFinancePage(app: HTMLElement, currentUser: AuthResponse): Promise<void> {
    setPageTitle('Финансы');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'finance', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderFinancePage } = await import('./pages/FinancePage/FinancePage');
      await renderFinancePage(api, content, { currentUser });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load FinancePage:', err);
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showChatPage(app: HTMLElement, currentUser: AuthResponse, initialUserId?: number): Promise<void> {
    setPageTitle('Чат');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, 'chat', onLogout);

    renderContentSkeleton(content);
    try {
      const { renderChatPage } = await import('./pages/ChatPage/ChatPage');
      await renderChatPage(api, content, { currentUser, initialUserId });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load ChatPage:', err);
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showPaymentReturnPage(app: HTMLElement, currentUser: AuthResponse): Promise<void> {
    setPageTitle('Оплата');
    const content = ensureShell(app);
    const onLogout = createLogoutHandler(api, setCurrentUser, navigateTo);

    void syncSidebar(app, currentUser, '', onLogout);

    try {
      const { renderPaymentReturnPage } = await import('./pages/PaymentReturnPage/PaymentReturnPage');
      await renderPaymentReturnPage(api, content, { currentUser, onLogout });
    } catch (error: unknown) {
      const err = error as Error;
      content.innerHTML = `<div style="color:red;padding:20px"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  // ─── Routing ─────────────────────────────────────────────────────────────

  async function handleRouting(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;

    let currentUser: AuthResponse | null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      currentUser = null;
    }

    const isAuthenticated = !!currentUser;
    const path = window.location.pathname;
    const viewedProfileMatch = path.match(/^\/profile\/(\d+)$/);
    const chatWithMatch = path.match(/^\/chat\/(\d+)$/);

    if (path === '/index.html') {
      navigateTo(isAuthenticated ? '/' : '/auth');
      return;
    }
    if (path === '/auth') {
      if (isAuthenticated) navigateTo('/');
      else await showAuthPage(app);
      return;
    }
    if (!isAuthenticated) {
      navigateTo('/auth');
      return;
    }

    // Все маршруты ниже — только для аутентифицированных
    if (path === '/') {
      await showHomePage(app, currentUser!);
    } else if (path === '/profile') {
      await showProfilePage(app, currentUser!);
    } else if (viewedProfileMatch) {
      await showProfilePage(app, currentUser!, Number(viewedProfileMatch[1]));
    } else if (path === '/notifications') {
      await showNotificationsPage(app, currentUser!);
    } else if (path === '/finance') {
      if (!currentUser!.user.is_trainer) {
        navigateTo('/');
        return;
      }
      await showFinancePage(app, currentUser!);
    } else if (path === '/chat') {
      await showChatPage(app, currentUser!);
    } else if (chatWithMatch) {
      await showChatPage(app, currentUser!, Number(chatWithMatch[1]));
    } else if (path === '/payment/return') {
      await showPaymentReturnPage(app, currentUser!);
    } else if (path === '/payment/cancel') {
      navigateTo('/');
    } else {
      navigateTo('/');
    }
  }

  return { handleRouting, navigateTo, setCurrentUser, getCurrentUser };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }

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
