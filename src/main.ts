import Handlebars from 'handlebars';
import { API_BASE_URL } from './config/constants';
import { ApiClient } from './utils/api';
import { loadProfilePageData } from './utils/profilePageData';
import type { AuthResponse } from './types/auth.types';
import type { Router } from './types/router.types';
import './styles/index.css';
import templates from './templates';

// Регистрируем шаблоны глобально
(window as Window).Handlebars = Handlebars;
// Исправлено: убран any
(Handlebars as typeof Handlebars & { templates: Record<string, Handlebars.TemplateDelegate> }).templates = templates;

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

function renderProfileShell(container: HTMLElement): void {
  if (!container) return;
  container.innerHTML = `
    <div class="profile-page profile-page--loading">
      <div class="profile-page__sidebar">
        <div class="page-skeleton page-skeleton--sidebar">
          <div class="page-skeleton__block page-skeleton__block--title"></div>
          <div class="page-skeleton__block page-skeleton__block--nav"></div>
          <div class="page-skeleton__block page-skeleton__block--nav"></div>
          <div class="page-skeleton__block page-skeleton__block--nav"></div>
          <div class="page-skeleton__block page-skeleton__block--footer"></div>
        </div>
      </div>
      <div class="profile-page__main">
        <div class="profile-page__container">
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
      </div>
    </div>
  `;
}

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

  async function showAuthPage(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;
    renderBootScreen(app, 'Загружаем страницу входа');
    document.body.classList.add('auth-page');
    try {
      const { renderAuthPage } = await import('./pages/AuthPage/AuthPage');
      await renderAuthPage(app, api);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load AuthPage:', err);
      app.innerHTML = `<div style="color: red; padding: 20px;"><h2>Ошибка</h2><p>${err.message}</p></div>`;
    }
  }

  async function showHomePage(currentUser: AuthResponse | null): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;
    renderProfileShell(app);
    document.body.classList.remove('auth-page');
    try {
      const { renderHomePage } = await import('./pages/HomePage/HomePage');
      await renderHomePage(api, app, {
        currentUser,
        onLogout: createLogoutHandler(api, setCurrentUser, navigateTo)
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load HomePage:', err);
      app.innerHTML = `<div style="color: red; padding: 20px;"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }

  async function showProfilePage(currentUser: AuthResponse | null, viewedUserId?: number): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;
    renderProfileShell(app);
    document.body.classList.remove('auth-page');
    const userId = viewedUserId ?? currentUser?.user?.user_id;
    if (!userId) {
      navigateTo('/auth');
      return;
    }
    try {
    // Всегда загружаем свежие данные
      const data = await loadProfilePageData(api, userId, currentUser);

      const { renderProfilePage } = await import('./pages/ProfilePage/ProfilePage');
      await renderProfilePage(api, app, {
        profile: data.profile,
        currentUser: data.currentUser,
        subscriptions: [],
        posts: data.posts,
        activeTab: 'publications',
        popularPosts: [],
        viewedUserId: data.viewedUserId,
        onLogout: createLogoutHandler(api, setCurrentUser, navigateTo)
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to load ProfilePage:', err);
      app.innerHTML = `<div style="color: red; padding: 20px;"><h3>Ошибка</h3><p>${err.message}</p></div>`;
    }
  }
  async function handleRouting(): Promise<void> {
    const currentUser = await getCurrentUser();
    const isAuthenticated = !!currentUser;
    const path = window.location.pathname;
    const viewedProfileMatch = path.match(/^\/profile\/(\d+)$/);

    if (path === '/index.html') {
      navigateTo(isAuthenticated ? '/' : '/auth');
      return;
    }
    if (path === '/') {
      if (!isAuthenticated) navigateTo('/auth');
      else await showHomePage(currentUser);
      return;
    }
    if (path === '/auth') {
      if (isAuthenticated) navigateTo('/');
      else await showAuthPage();
      return;
    }
    if (path === '/profile') {
      if (!isAuthenticated) navigateTo('/auth');
      else await showProfilePage(currentUser);
      return;
    }
    if (viewedProfileMatch) {
      if (!isAuthenticated) navigateTo('/auth');
      else await showProfilePage(currentUser, Number(viewedProfileMatch[1]));
      return;
    }
    navigateTo(isAuthenticated ? '/' : '/auth');
  }

  return { handleRouting, navigateTo, setCurrentUser, getCurrentUser };
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }

  const apiClient = new ApiClient(API_BASE_URL);
  const router = createRouter(apiClient);
  (window as Window).router = router;
  renderBootScreen(app);
  await router.handleRouting();
  window.addEventListener('popstate', () => {
    void router.handleRouting();
  });
});
