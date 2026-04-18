/**
 * @fileoverview Главный файл приложения (Production версия)
 * @module static/js/main
 */

import { API_BASE_URL } from '/src/config/constants.js';
import { ApiClient } from '/src/utils/api.js';
import { loadProfilePageData } from '/src/utils/profilePageData.js';

// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====

Handlebars.templates = {};
let templatesPromise = null;

function renderBootScreen(container, message = 'Загружаем интерфейс') {
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

function renderProfileShell(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="profile-page profile-page--loading" aria-live="polite" aria-busy="true">
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

async function loadTemplates() {
  if (templatesPromise) {
    return templatesPromise;
  }

  const templates = [
    { name: 'Button', folder: 'atoms' }, { name: 'Input', folder: 'atoms' },
    { name: 'Avatar', folder: 'atoms' }, { name: 'UserPhotoItem', folder: 'atoms' },
    { name: 'AuthForm', folder: 'organisms' },
    { name: 'ProfileHeader', folder: 'molecules' },
    { name: 'PostCard', folder: 'molecules' },
    { name: 'DonationModal', folder: 'molecules' },
    { name: 'PostFormModal', folder: 'molecules' },
    { name: 'Sidebar', folder: 'organisms' },
    { name: 'ProfileContent', folder: 'organisms' },
    { name: 'AuthPage', folder: 'pages' }, { name: 'ProfilePage', folder: 'pages' },
    { name: 'ProfileEditModal', folder: 'molecules' }
  ];

  templatesPromise = Promise.all(templates.map(async ({ name, folder }) => {
    try {
      const path = folder === 'pages'
        ? `/pages/${name}/${name}.hbs`
        : `/components/${folder}/${name}/${name}.hbs`;

      const response = await fetch(path);
      const source = await response.text();
      Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
    } catch (error) {
      console.error(`❌ Failed to load template ${name}:`, error);
    }
  }));

  return templatesPromise;
}
// ===== РОУТЕР =====

function createRouter(api) {
  let currentUserPromise = null;

  function setCurrentUser(user) {
    currentUserPromise = Promise.resolve(user);
  }

  async function getCurrentUser({ force = false } = {}) {
    if (!force && currentUserPromise) {
      return currentUserPromise;
    }

    currentUserPromise = api.getCurrentUser().catch(error => {
      currentUserPromise = null;
      throw error;
    });

    return currentUserPromise;
  }

  function navigateTo(path) {
    history.pushState({}, '', path);
    handleRouting();
  }

  async function showAuthPage() {
    const app = document.getElementById('app');
    renderBootScreen(app, 'Загружаем страницу входа');
    document.body.classList.add('auth-page');

    try {
      const { renderAuthPage } = await import('/pages/AuthPage/AuthPage.js');
      await renderAuthPage(app, api);
    } catch (error) {
      console.error('Failed to load AuthPage:', error);
      app.innerHTML = `
        <div style="color: red; padding: 20px;">
          <h2>Ошибка загрузки страницы авторизации</h2>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  async function showProfilePage(currentUser) {
    const app = document.getElementById('app');
    renderProfileShell(app);
    document.body.classList.remove('auth-page');

    try {
      const userId = currentUser?.user?.user_id;
      const [{ renderProfilePage }, data] = await Promise.all([
        import('/pages/ProfilePage/ProfilePage.js'),
        loadProfilePageData(api, userId, currentUser)
      ]);

      await renderProfilePage(api, app, {
        profile: data.profile,
        currentUser: data.currentUser,
        subscriptions: [],
        posts: data.posts,
        activeTab: 'publications',
        popularPosts: [],
        viewedUserId: data.viewedUserId,
        onLogout: async () => {
          try {
            await api.logout();
            setCurrentUser(null);
            localStorage.removeItem('user');
            navigateTo('/auth');
          } catch (error) {
            console.error('Logout error:', error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load ProfilePage:', error);
      app.innerHTML = `
        <div style="color: red; padding: 20px; text-align: center;">
          <h3>Ошибка загрузки профиля</h3>
          <p>${error.message}</p>
          <button onclick="window.router.navigateTo('/auth')" style="
            margin-top: 16px;
            padding: 8px 16px;
            background: var(--primary-orange);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
          ">
            Вернуться к авторизации
          </button>
        </div>
      `;
    }
  }

  async function handleRouting() {
    const [, currentUser] = await Promise.all([
      loadTemplates(),
      getCurrentUser()
    ]);
    const isAuthenticated = !!currentUser;
    const path = window.location.pathname;

    if (path === '/' || path === '/index.html') {
      navigateTo(isAuthenticated ? '/profile' : '/auth');
      return;
    }

    if (path === '/auth') {
      if (isAuthenticated) {
        navigateTo('/profile');
      } else {
        await showAuthPage();
      }
      return;
    }

    if (path === '/profile') {
      if (!isAuthenticated) {
        navigateTo('/auth');
      } else {
        await showProfilePage(currentUser);
      }
      return;
    }

    navigateTo(isAuthenticated ? '/profile' : '/auth');
  }

  return { handleRouting, navigateTo, setCurrentUser, getCurrentUser };
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ (PRODUCTION) =====

document.addEventListener('DOMContentLoaded', async () => {
  // Service Worker (опционально - для офлайн режима)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  }

  const apiClient = new ApiClient(API_BASE_URL);
  const router = createRouter(apiClient);
  window.router = router;
  renderBootScreen(document.getElementById('app'));
  await router.handleRouting();

  window.addEventListener('popstate', () => {
    router.handleRouting();
  });
});
