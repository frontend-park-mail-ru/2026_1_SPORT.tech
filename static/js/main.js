// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====
Handlebars.templates = {};

async function loadTemplates() {
    // Определяем где искать каждый шаблон
    const templates = [
        // atoms
        { name: 'Button', folder: 'atoms' },
        { name: 'Input', folder: 'atoms' },
        { name: 'Avatar', folder: 'atoms' },
        { name: 'UserPhotoItem', folder: 'atoms' },
        // molecules
        { name: 'ProfileHeader', folder: 'molecules' },
        { name: 'PostCard', folder: 'molecules' },
        // organisms
        { name: 'Sidebar', folder: 'organisms' },
        { name: 'ProfileContent', folder: 'organisms' },
        // pages
        { name: 'ProfilePage', folder: 'pages' }
    ];

    for (const { name, folder } of templates) {
        try {
            // Исправляем путь: убираем лишний "/components/" для pages
            let path;
            if (folder === 'pages') {
                path = `/pages/${name}/${name}.hbs`;
            } else {
                path = `/components/${folder}/${name}/${name}.hbs`;
            }
            
            const response = await fetch(path);
            const source = await response.text();
            Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
            console.log(`✅ Loaded template: ${name} from ${folder}`);
        } catch (error) {
            console.error(`❌ Failed to load template ${name}:`, error);
        }
    }
}

// Демо страницы профиля
async function demoProfilePage() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('❌ Element with id "app" not found');
        return;
    }
    
    app.innerHTML = '';
    
    try {
        const { renderProfilePage } = await import('/pages/ProfilePage/ProfilePage.js');
        
        // БОЛЬШОЙ СПИСОК ПОДПИСОК для скролла
        const manySubscriptions = [
            { id: 1, name: 'Ярослав-Лют... Владимиров', role: 'Физиолог' },
            { id: 2, name: 'Антон Переславль-З...', role: 'Тренер ОФП' },
            { id: 3, name: 'Ксения Бортникова', role: 'Тренер по КОНК...' },
            { id: 4, name: 'Сергей Генц', role: 'Диетолог' },
            { id: 5, name: 'Мария Иванова', role: 'Йога-инструктор' },
            { id: 6, name: 'Алексей Петров', role: 'Персональный тренер' },
            { id: 7, name: 'Елена Смирнова', role: 'Нутрициолог' },
            { id: 8, name: 'Дмитрий Козлов', role: 'Тренер по боксу' },
            { id: 9, name: 'Анна Морозова', role: 'Фитнес-инструктор' },
            { id: 10, name: 'Игорь Соколов', role: 'Тренер по плаванию' },
            { id: 11, name: 'Ольга Попова', role: 'Пилатес-инструктор' },
            { id: 12, name: 'Николай Волков', role: 'Тренер по кроссфиту' }
        ];
        
        await renderProfilePage(app, {
            profile: {
                name: 'Абдурахман Гасанов',
                role: 'Фитнес-тренер',
                isOwnProfile: false
            },
            currentUser: {
                id: 999,
                name: 'Абдурахман Гасанов',
                role: 'Фитнес-тренер'
            },
            subscriptions: manySubscriptions, // Много подписок для скролла
            posts: [
                {
                    title: 'Топ упражнений на грудные мышцы',
                    content: `
                        <h4>Анатомия и важность тренировки груди</h4>
                        <p>Грудные мышцы — это мощный массив, состоящий в первую очередь из большой и малой грудных мышц, а также передней зубчатой мышцы. Они отвечают за приведение и вращение руки, а также стабилизацию плечевого пояса. Развитая грудь не только придаёт фигуре эстетичный и мужественный силуэт, но и улучшает осанку, помогая бороться с сутулостью, и повышает результаты во многих видах спорта — от плавания до бокса.</p>
                        <h4>Правила эффективного тренинга</h4>
                        <ol>
                            <li><strong>Разминка обязательна:</strong> Разогрейте суставы и мышцы, чтобы подготовить их к нагрузке и избежать травм.</li>
                            <li><strong>Разнообразие углов:</strong> Грудь состоит из разных пучков (верх, середина, низ). Чтобы проработать их все...</li>
                        </ol>
                    `,
                    authorName: 'Абдурахман Гасанов',
                    authorRole: 'Фитнес-тренер',
                    likes: 52,
                    comments: 42
                }
            ],
            popularPosts: [
                { title: 'Топ упражнений на грудные мышцы', image: null },
                { title: 'Топ упражнений на мышцы спины', image: null }
            ],
            onLogout: () => {
                console.log('👋 Выход из системы');
                alert('Вы вышли из системы');
            }
        });
        
        console.log('✅ Profile page rendered successfully');
    } catch (error) {
        console.error('❌ Failed to render profile page:', error);
        app.innerHTML = '<div style="color: red; padding: 20px;">Ошибка загрузки страницы профиля</div>';
    }
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Starting application...');
    await loadTemplates();
    await demoProfilePage();
});