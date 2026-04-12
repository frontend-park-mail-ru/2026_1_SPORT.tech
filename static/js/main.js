/**
 * @fileoverview Главный файл приложения
 * Отвечает за:
 * - Загрузку Handlebars шаблонов
 * - Инициализацию API клиента
 * - Маршрутизацию между страницами
 * - Загрузку данных профиля
 * 
 * @module static/js/main
 */

import { API_BASE_URL, getDevMockMode } from '/src/config/constants.js';
import { ApiClient } from '/src/utils/api.js';
import { applyDevMockApiOverrides } from '/src/utils/devMockApi.js';
import { loadProfilePageData } from '/src/utils/profilePageData.js';

// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====

/** @type {Object} Хранилище скомпилированных Handlebars шаблонов */
Handlebars.templates = {};

/**
 * Загружает и компилирует все Handlebars шаблоны
 * @async
 * @returns {Promise<void>}
 */
async function loadTemplates() {
  /** @constant {Array<{name: string, folder: string}>} Список шаблонов для загрузки */
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
    { name: 'AuthPage', folder: 'pages' }, { name: 'ProfilePage', folder: 'pages' }
  ];

  for (const { name, folder } of templates) {
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
  }
}

// ===== РОУТЕР =====

/**
 * Создает объект роутера для навигации
 * @param {Object} api - API клиент
 * @returns {Object} Объект роутера с методами handleRouting и navigateTo
 */
function createRouter(api) {
  /**
   * Функция навигации
   * @param {string} path - Путь для перехода
   */
  function navigateTo(path) {
    history.pushState({}, '', path);
    handleRouting();
  }

  /**
   * Показывает страницу авторизации
   * @async
   */
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

  /**
   * Показывает страницу профиля
   * @async
   */
  async function showProfilePage() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    document.body.classList.remove('auth-page');

    try {
      const { renderProfilePage } = await import('/pages/ProfilePage/ProfilePage.js');
      const currentUser = await api.getCurrentUser();

      const userId = currentUser?.user?.user_id;
      const data = await loadProfilePageData(api, userId, currentUser);

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
            localStorage.removeItem('user');
            alert('Вы вышли из системы');
            navigateTo('/auth');
          } catch (error) {
            alert('Ошибка при выходе');
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

  /**
   * Обрабатывает маршрутизацию на основе текущего URL
   * @async
   */
  async function handleRouting() {
    await loadTemplates();

    const currentUser = await api.getCurrentUser();
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
        await showProfilePage();
      }
      return;
    }

    navigateTo(isAuthenticated ? '/profile' : '/auth');
  }

  return { handleRouting, navigateTo };
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====

/**
 * Инициализация приложения после загрузки DOM
 * @listens document#DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  }

  const apiClient = new ApiClient(API_BASE_URL);
  const devMock = getDevMockMode();
  if (devMock) {
    console.warn(
      '[SPORT] Режим mock без бэкенда:',
      devMock,
      '(добавьте ?mock=0 в URL чтобы выключить)'
    );
    applyDevMockApiOverrides(apiClient, devMock);
  }

  const router = createRouter(apiClient);
  window.router = router;
  await router.handleRouting();

  /**
   * Обработчик изменения истории браузера (кнопки назад/вперед)
   * @listens window#popstate
   */
  window.addEventListener('popstate', () => {
    router.handleRouting();
  });
});
