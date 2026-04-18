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
    app.innerHTML = '';
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
    app.innerHTML = '';
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
  await router.handleRouting();

  window.addEventListener('popstate', () => {
    router.handleRouting();
  });
});
