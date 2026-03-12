// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====
Handlebars.templates = {};

async function loadTemplates() {
    const templates = [
        { name: 'Button', folder: 'atoms' },
        { name: 'Input', folder: 'atoms' },
        { name: 'Avatar', folder: 'atoms' },
        { name: 'UserPhotoItem', folder: 'atoms' },
        { name: 'AuthForm', folder: 'organisms' },
        { name: 'ProfileHeader', folder: 'molecules' },
        { name: 'PostCard', folder: 'molecules' },
        { name: 'Sidebar', folder: 'organisms' },
        { name: 'ProfileContent', folder: 'organisms' },
        { name: 'AuthPage', folder: 'pages' },
        { name: 'ProfilePage', folder: 'pages' }
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

// ===== ПРОФИЛЬ =====
function mapProfileData(apiData, currentUser) {
    const isOwnProfile = apiData.is_me;
    const firstName = apiData.profile.first_name || '';
    const lastName = apiData.profile.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';

    return {
        profile: {
            name: fullName,
            role: apiData.is_trainer ? 'Тренер' : 'Клиент',
            avatar: apiData.profile.avatar_url,
            isOwnProfile: isOwnProfile
        },
        currentUser: currentUser ? {
            id: currentUser.user.user_id,
            name: `${currentUser.user.profile.first_name} ${currentUser.user.profile.last_name}`.trim(),
            role: currentUser.user.is_trainer ? 'Тренер' : 'Клиент',
            avatar: currentUser.user.profile.avatar_url
        } : null
    };
}

async function loadProfilePageData(userId = 1) {
    try {
        const profileData = await api.getProfile(userId);

        let currentUser = null;
        try {
            currentUser = await api.getCurrentUser();
        } catch (e) {
            // User not logged in
        }

        let postsData = { posts: [] };
        try {
            postsData = await api.getUserPosts(userId);
        } catch (e) {
            // No posts or error loading posts
        }

        const posts = postsData.posts.map(post => ({
            post_id: post.post_id,
            title: post.title,
            content: 'Загрузите пост для просмотра',
            authorName: `${profileData.profile.first_name || ''} ${profileData.profile.last_name || ''}`.trim(),
            authorRole: profileData.is_trainer ? 'Тренер' : 'Клиент',
            likes: 0,
            comments: 0,
            can_view: post.can_view
        }));

        const mappedData = mapProfileData(profileData, currentUser);

        return {
            ...mappedData,
            posts
        };
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

    app.innerHTML = '<div style="text-align: center; padding: 50px;">⏳ Загрузка данных...</div>';

    try {
        const { renderProfilePage } = await import('/pages/ProfilePage/ProfilePage.js');

        const userId = 1;
        const data = await loadProfilePageData(userId);

        const subscriptions = [
            { id: 1, name: 'Ярослав-Лют... Владимиров', role: 'Физиолог' },
            { id: 2, name: 'Антон Переславль-З...', role: 'Тренер ОФП' },
            { id: 3, name: 'Ксения Бортникова', role: 'Тренер по КОНК...' },
            { id: 4, name: 'Сергей Генц', role: 'Диетолог' },
            { id: 5, name: 'Мария Иванова', role: 'Йога-инструктор' },
            { id: 6, name: 'Алексей Петров', role: 'Персональный тренер' },
            { id: 7, name: 'Елена Смирнова', role: 'Нутрициолог' },
            { id: 8, name: 'Дмитрий Козлов', role: 'Тренер по боксу' }
        ];

        const popularPosts = [
            { title: 'Топ упражнений на грудные мышцы', description: 'Лучшие упражнения для развития грудных мышц' },
            { title: 'Топ упражнений на мышцы спины', description: 'Как накачать широкую спину' },
            { title: 'Питание для набора массы', description: 'Что есть чтобы мышцы росли' },
            { title: 'Кардио для жиросжигания', description: 'Интервальные тренировки' },
            { title: 'Растяжка после тренировки', description: 'Комплекс упражнений для заминки' }
        ];

        await renderProfilePage(app, {
            profile: data.profile,
            currentUser: data.currentUser || {
                id: userId,
                name: data.profile.name,
                role: data.profile.role
            },
            subscriptions,
            posts: data.posts,
            activeTab: 'publications',
            popularPosts,
            onLogout: async () => {
                try {
                    await api.logout();
                    alert('Вы вышли из системы');
                    window.location.reload();
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
    constructor() {
        this.currentPage = null;
        this.app = document.getElementById('app');
    }

    async init() {
        await loadTemplates();

        let path = window.location.pathname;

        if (path === '/' || path === '/index.html') {
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
            const { AuthPage } = await import('/pages/AuthPage/AuthPage.js');
            const authPage = new AuthPage(this.app);
            await authPage.render();
            this.currentPage = authPage;
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
        await demoProfilePage();
    }

    async showMainPage() {
        this.app.innerHTML = '';
        document.body.classList.remove('auth-page');

        this.app.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h1 style="color: var(--primary-orange);">SPORT.tech</h1>
                <p style="margin-top: 20px;">Главная страница</p>
                <div style="margin-top: 20px;">
                    <button onclick="window.location.href='/auth'" style="
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
                    <button onclick="window.location.href='/profile'" style="
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

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    window.app = app;
    await app.init();
});