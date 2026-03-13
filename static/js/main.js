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

import { API_BASE_URL } from '/src/config/constants.js';
import { ApiClient } from '/src/utils/api.js';

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

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ПРОФИЛЕМ =====

/**
 * Получить текстовую метку роли пользователя
 * @param {boolean} isTrainer - Является ли пользователь тренером
 * @returns {string} 'Тренер' или 'Клиент'
 */
function getUserRoleLabel(isTrainer) {
  return isTrainer ? 'Тренер' : 'Клиент';
}

/**
 * Получить полное имя из профиля
 * @param {Object} profile - Профиль пользователя
 * @param {string} [profile.first_name] - Имя
 * @param {string} [profile.last_name] - Фамилия
 * @param {string} [profile.username] - Имя пользователя
 * @returns {string} Полное имя или 'Пользователь'
 */
function getFullName(profile = {}) {
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
      profile.username || 'Пользователь';
}

/**
 * Экранирует HTML-спецсимволы в строке
 * @param {string} value - Исходная строка
 * @returns {string} Экранированная строка
 */
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

/**
 * Форматирует содержимое поста для отображения
 * @param {string} textContent - Текст поста
 * @returns {string} Отформатированный HTML
 */
function formatPostContent(textContent) {
  if (!textContent) {
    return 'Нет доступа к содержимому поста';
  }

  return escapeHtml(textContent).replace(/\n/g, '<br>');
}

/**
 * Преобразует данные из API в формат для компонентов
 * @param {Object} apiData - Данные из API
 * @param {Object} currentUser - Текущий пользователь
 * @returns {Object} Отформатированные данные для компонентов
 */
function mapProfileData(apiData, currentUser) {
  const isOwnProfile = apiData.is_me;
  const fullName = getFullName(apiData.profile);

  return {
    profile: {
      name: fullName,
      role: getUserRoleLabel(apiData.is_trainer),
      avatar: apiData.profile.avatar_url,
      isOwnProfile: isOwnProfile
    },
    currentUser: currentUser?.user ? {
      id: currentUser.user.user_id,
      name: getFullName(currentUser.user.profile),
      role: getUserRoleLabel(currentUser.user.is_trainer),
      avatar: currentUser.user.profile.avatar_url
    } : null
  };
}

/**
 * Загружает данные для страницы профиля
 * @async
 * @param {Object} api - API клиент
 * @param {number} userId - ID пользователя
 * @param {Object} [currentUser=null] - Текущий пользователь
 * @returns {Promise<Object>} Данные для отображения профиля
 * @throws {Error} Если пользователь не авторизован
 */
async function loadProfilePageData(api, userId, currentUser = null) {
  try {
    const resolvedUserId = userId || currentUser?.user?.user_id;

    if (!resolvedUserId) {
      throw new Error('Пользователь не авторизован');
    }

    const [profileData, postsData] = await Promise.all([
      api.getProfile(resolvedUserId),
      api.getUserPosts(resolvedUserId).catch(error => {
        return { posts: [] };
      })
    ]);

    const authorName = getFullName(profileData.profile);
    const authorRole = getUserRoleLabel(profileData.is_trainer);
    const postList = Array.isArray(postsData?.posts) ? postsData.posts : [];

    const posts = await Promise.all(postList.map(async post => {
      let fullPost = null;

      if (post.can_view) {
        try {
          fullPost = await api.getPost(post.post_id);
        } catch (error) {
          // Игнорируем ошибки загрузки отдельных постов
        }
      }

      const textContent = fullPost?.text_content || '';

      return {
        post_id: post.post_id,
        title: post.title,
        content: post.can_view ? formatPostContent(textContent) : 'Нет доступа к содержимому поста',
        authorName,
        authorRole,
        likes: 0,
        comments: 0,
        can_view: post.can_view,
        created_at: post.created_at,
        min_tier_id: post.min_tier_id ?? null,
        attachments: fullPost?.attachments || []
      };
    }));

    const mappedData = mapProfileData(profileData, currentUser);

    return { ...mappedData, posts, subscriptions: [], popularPosts: [] };
  } catch (error) {
    console.error('❌ Failed to load profile data:', error);
    throw error;
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

    console.log('Route:', { path, isAuthenticated });

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

    console.log(`Маршрут ${path} не найден, редирект`);
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
  const apiClient = new ApiClient(API_BASE_URL);

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
