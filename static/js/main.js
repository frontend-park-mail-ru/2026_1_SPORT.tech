// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====
Handlebars.templates = {};

async function loadTemplates() {
    const templates = [
        { name: 'Button', folder: 'atoms' },
        { name: 'Input', folder: 'atoms' },
        { name: 'Avatar', folder: 'atoms' },
        { name: 'UserPhotoItem', folder: 'atoms' },
        { name: 'ProfileHeader', folder: 'molecules' },
        { name: 'PostCard', folder: 'molecules' },
        { name: 'Sidebar', folder: 'organisms' },
        { name: 'ProfileContent', folder: 'organisms' },
        { name: 'ProfilePage', folder: 'pages' }
    ];

    for (const { name, folder } of templates) {
        try {
            let path = folder === 'pages' 
                ? `/pages/${name}/${name}.hbs`
                : `/components/${folder}/${name}/${name}.hbs`;
            
            const response = await fetch(path);
            const source = await response.text();
            Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
            console.log(`✅ Loaded template: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to load template ${name}:`, error);
        }
    }
}

// Преобразование данных из API в формат компонентов
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

// Загрузка данных профиля
async function loadProfilePageData(userId = 123) {
    try {
        console.log(`📦 Loading profile data for user ${userId}...`);
        
        // Загружаем профиль
        const profileData = await api.getProfile(userId);
        console.log('📊 Profile data:', profileData);
        
        // Загружаем текущего пользователя (если авторизован)
        let currentUser = null;
        try {
            currentUser = await api.getCurrentUser();
            console.log('👤 Current user:', currentUser);
        } catch (e) {
            console.log('User not logged in');
        }
        
        // Загружаем посты пользователя
        let postsData = { posts: [] };
        try {
            postsData = await api.getUserPosts(userId);
            console.log('📝 Posts data:', postsData);
        } catch (e) {
            console.log('No posts or error loading posts');
        }
        
        // Преобразуем посты в формат компонента PostCard
        const posts = postsData.posts.map(post => ({
            post_id: post.post_id,
            title: post.title,
            content: 'Загрузите пост для просмотра', // Нужно загружать отдельно по post_id
            authorName: profileData.profile.first_name + ' ' + profileData.profile.last_name,
            authorRole: profileData.is_trainer ? 'Тренер' : 'Клиент',
            likes: 0, // В API пока нет лайков
            comments: 0, // В API пока нет комментариев
            can_view: post.can_view
        }));
        
        const mappedData = mapProfileData(profileData, currentUser);
        
        return {
            ...mappedData,
            posts: posts
        };
    } catch (error) {
        console.error('❌ Failed to load profile data:', error);
        throw error;
    }
}

// Демо страницы профиля с реальными данными
async function demoProfilePage() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('❌ Element with id "app" not found');
        return;
    }
    
    app.innerHTML = '<div style="text-align: center; padding: 50px;">⏳ Загрузка данных...</div>';
    
    try {
        const { renderProfilePage } = await import('/pages/ProfilePage/ProfilePage.js');
        
        // Загружаем реальные данные (ID пользователя можно менять)
        const userId = 123; // Тестовый ID
        const data = await loadProfilePageData(userId);
        
        // В API пока нет подписок, используем моковые
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
        
        // Популярные посты пока моковые
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
            subscriptions: subscriptions,
            posts: data.posts,
            activeTab: 'publications',
            popularPosts: popularPosts,
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
        
        console.log('✅ Profile page rendered with real data');
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

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Starting application...');
    await loadTemplates();
    await demoProfilePage();
});