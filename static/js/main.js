/**
 * @fileoverview Главный файл приложения (Production версия)
 * @module static/js/main
 */

import { API_BASE_URL } from '/src/config/constants.js';
import { ApiClient } from '/src/utils/api.js';

// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====

Handlebars.templates = {};

async function loadTemplates() {
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function getUserRoleLabel(isTrainer) {
  return isTrainer ? 'Тренер' : 'Клиент';
}

function getFullName(profile = {}) {
  const first = profile.first_name || '';
  const last = profile.last_name || '';
  return `${first} ${last}`.trim() || profile.username || 'Пользователь';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

function formatPostContent(textContent) {
  if (!textContent) {
    return 'Нет доступа к содержимому поста';
  }
  return escapeHtml(textContent).replace(/\n/g, '<br>');
}

function mapProfileData(apiData, currentUser) {
  const isOwnProfile = apiData.is_me;
  const fullName = getFullName(apiData);

  return {
    profile: {
      name: fullName,
      role: getUserRoleLabel(apiData.is_trainer),
      avatar: apiData.avatar_url,
      isOwnProfile: isOwnProfile,
      isTrainer: apiData.is_trainer
    },
    currentUser: currentUser?.user ? {
      id: currentUser.user.user_id,
      name: getFullName(currentUser.user),
      role: getUserRoleLabel(currentUser.user.is_trainer),
      avatar: currentUser.user.avatar_url
    } : null
  };
}

async function loadProfilePageData(api, userId, currentUser = null) {
  try {
    const resolvedUserId = userId || currentUser?.user?.user_id;

    if (!resolvedUserId) {
      throw new Error('Пользователь не авторизован');
    }

    const [profileData, postsData] = await Promise.all([
      api.getProfile(resolvedUserId),
      api.getUserPosts(resolvedUserId).catch(() => ({ posts: [] }))
    ]);

    // profileData — это сам объект профиля
    const authorName = getFullName(profileData);
    const authorRole = getUserRoleLabel(profileData.is_trainer);
    const postList = Array.isArray(postsData?.posts) ? postsData.posts : [];

    const posts = await Promise.all(postList.map(async post => {
      let fullPost = null;
      if (post.can_view) {
        try {
          fullPost = await api.getPost(post.post_id);
        } catch (error) {
          // игнорируем
        }
      }
      const textContent = fullPost?.text_content || '';
      return {
        post_id: post.post_id,
        title: post.title,
        content: post.can_view ? formatPostContent(textContent) : 'Нет доступа к содержимому поста',
        authorName,
        authorRole,
        likes: fullPost?.likes_count || 0,
        liked: fullPost?.is_liked || false,
        comments: 0,
        can_view: post.can_view,
        created_at: post.created_at,
        min_tier_id: post.min_tier_id ?? null,
        attachments: fullPost?.attachments || []
      };
    }));

    const mappedData = mapProfileData(profileData, currentUser);
    return { ...mappedData, posts, subscriptions: [], popularPosts: [], viewedUserId: resolvedUserId };
  } catch (error) {
    console.error('❌ Failed to load profile data:', error);
    throw error;
  }
}
// ===== РОУТЕР =====

function createRouter(api) {
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

  async function showProfilePage() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    document.body.classList.remove('auth-page');

    try {
      const { renderProfilePage } = await import('/pages/ProfilePage/ProfilePage.js');
      await new Promise(resolve => setTimeout(resolve, 100));
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
