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
    { name: 'Sidebar', folder: 'organisms' },
    { name: 'ProfileContent', folder: 'organisms' },
    { name: 'AuthPage', folder: 'pages' }, { name: 'ProfilePage', folder: 'pages' }
  ];

  for (const { name, folder } of templates) {
    try {
      const path = folder === 'pages' ?
          `/pages/${name}/${name}.hbs` :
          `/components/${folder}/${name}/${name}.hbs`;

      const response = await fetch(path);
      const source = await response.text();
      Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
    } catch (error) {
      console.error(`❌ Failed to load template ${name}:`, error);
    }
  }
}

// ===== ПРОФИЛЬ =====
function getUserRoleLabel(isTrainer) {
  return isTrainer ? 'Тренер' : 'Клиент';
}

function getFullName(profile = {}) {
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
      profile.username || 'Пользователь';
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
    } :
      null
  };
}

async function loadProfilePageData(userId, currentUser = null) {
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
        }
      }

      const textContent = fullPost?.text_content || '';

      return {
        post_id: post.post_id,
        title: post.title,
        content: post.can_view ? formatPostContent(textContent) :
          'Нет доступа к содержимому поста',
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

async function demoProfilePage() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('❌ Element with id "app" not found');
    return;
  }

  try {
    const { renderProfilePage } =
        await import('/pages/ProfilePage/ProfilePage.js');
    const currentUser = await api.getCurrentUser();
    const userId = currentUser?.user?.user_id;

    if (!userId) {
      window.location.hash = '#/auth';
      return;
    }

    const data = await loadProfilePageData(userId, currentUser);

    await renderProfilePage(app, {
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
          window.location.hash = '#/auth';
        } catch (error) {
          alert('Ошибка при выходе');
        }
      }
    });

  } catch (error) {
    console.error('❌ Failed to render profile page:', error);
    app.innerHTML = `
            <div style="color: red; padding: 20px; text-align: center;">
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
                <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 16px;">
                    Повторить
                </button>
            </div>
        `;
  }
}

// ===== НАВИГАЦИЯ =====
class App {
  constructor(api) {
    this.api = api;
    this.currentPage = null;
    this.app = document.getElementById('app');
  }

  async init() {
    await loadTemplates();

    // let path = window.location.pathname;

    // if (path === '/' || path === '/index.html') {
    //     path = '/auth';
    // }

    let path = window.location.hash.slice(1);

    if (!path || path === '/') {
      path = '/auth';
    }


    if (path === '/auth') {
      await this.showAuthPage();
    } else if (path === '/profile') {
      await this.showProfilePage();
    } else {
      await this.showMainPage();
    }
  }

  async showAuthPage() {
    this.app.innerHTML = '';
    document.body.classList.add('auth-page');

    try {
      const { renderAuthPage } = await import('/pages/AuthPage/AuthPage.js');
      await renderAuthPage(this.app, this.api);
    } catch (error) {
      console.error('Failed to load AuthPage:', error);
      this.app.innerHTML = `
            <div style="color: red; padding: 20px;">
                <h2>Ошибка загрузки страницы авторизации</h2>
                <p>${error.message}</p>
                <pre>${error.stack}</pre>
            </div>
        `;
    }
  }
  async showProfilePage() {
    this.app.innerHTML = '';
    document.body.classList.remove('auth-page');
    // await demoProfilePage();
    const { renderProfilePage } =
        await import('/pages/ProfilePage/ProfilePage.js');
    const currentUser = await this.api.getCurrentUser();
    await renderProfilePage(this.api, this.app, currentUser);
  }

  async showMainPage() {
    this.app.innerHTML = '';
    document.body.classList.remove('auth-page');

    this.app.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h1 style="color: var(--primary-orange);">SPORT.tech</h1>
                <p style="margin-top: 20px;">Главная страница</p>
                <div style="margin-top: 20px;">
                    <button onclick="window.location.hash='#/auth'" style="
                        margin: 10px;
                        padding: 10px 20px;
                        background: var(--primary-orange);
                        color: white;
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">
                        Перейти к авторизации
                    </button>
                    <button onclick="window.location.hash='#/profile'" style="
                        margin: 10px;
                        padding: 10px 20px;
                        background: var(--primary-orange);
                        color: white;
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">
                        Перейти в профиль
                    </button>
                </div>
            </div>
        `;
  }
}

window.addEventListener('hashchange', async () => {
  if (window.app) {
    await window.app.init();
  }
});

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
  const apiClient = new ApiClient(API_BASE_URL);

  // 2. Передаем его в конструктор App
  const app = new App(apiClient);
  await app.init();
});
