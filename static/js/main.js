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
            console.log(`Loaded template: ${name} from ${folder}`);
        } catch (error) {
            console.error(`Failed to load template ${name}:`, error);
        }
    }
}

// Демо страницы профиля
async function demoProfilePage() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Element with id "app" not found');
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
        
        // 10 ПОСТОВ для скролла
        const manyPosts = [
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
            },
            {
                title: 'Топ упражнений на мышцы спины',
                content: `
                    <h4>База для здоровой спины</h4>
                    <p>Широчайшие мышцы спины — это основа V-образного силуэта. Регулярные тренировки спины помогают улучшить осанку и предотвратить боли в позвоночнике.</p>
                    <h4>Лучшие упражнения</h4>
                    <ul>
                        <li>Подтягивания широким хватом</li>
                        <li>Тяга штанги в наклоне</li>
                        <li>Тяга верхнего блока к груди</li>
                    </ul>
                `,
                authorName: 'Абдурахман Гасанов',
                authorRole: 'Фитнес-тренер',
                likes: 48,
                comments: 36
            },
            {
                title: 'Питание для набора мышечной массы',
                content: `
                    <h4>Основы правильного питания</h4>
                    <p>Для роста мышц необходим профицит калорий и достаточное количество белка. В этой статье разберем основные принципы питания для атлетов.</p>
                    <h4>Ключевые продукты</h4>
                    <ul>
                        <li>Куриная грудка, рыба, яйца</li>
                        <li>Гречка, рис, овсянка</li>
                        <li>Орехи, авокадо, оливковое масло</li>
                    </ul>
                `,
                authorName: 'Абдурахман Гасанов',
                authorRole: 'Фитнес-тренер',
                likes: 67,
                comments: 53
            },
            {
                title: 'Кардио тренировки для жиросжигания',
                content: `
                    <h4>Эффективное кардио</h4>
                    <p>Интервальные тренировки сжигают больше жира за меньшее время. Рассказываем о лучших видах кардио для похудения.</p>
                `,
                authorName: 'Абдурахман Гасанов',
                authorRole: 'Фитнес-тренер',
                likes: 41,
                comments: 28
            },
            {
                title: 'Растяжка после тренировки',
                content: `
                    <h4>Почему важно тянуться</h4>
                    <p>Растяжка помогает восстановить мышцы, улучшить гибкость и предотвратить травмы. Комплекс упражнений для заминки.</p>
                `,
                authorName: 'Абдурахман Гасанов',
                authorRole: 'Фитнес-тренер',
                likes: 39,
                comments: 21
            }
        ];
        
        // 8 ПОПУЛЯРНЫХ ПУБЛИКАЦИЙ
        const manyPopularPosts = [
            { 
                title: 'Топ упражнений на грудные мышцы', 
                image: null,
                description: 'Лучшие упражнения для развития грудных мышц'
            },
            { 
                title: 'Топ упражнений на мышцы спины', 
                image: null,
                description: 'Как накачать широкую спину'
            },
            { 
                title: 'Питание для набора массы', 
                image: null,
                description: 'Что есть чтобы мышцы росли'
            },
            { 
                title: 'Кардио для жиросжигания', 
                image: null,
                description: 'Интервальные тренировки'
            },
            { 
                title: 'Растяжка после тренировки', 
                image: null,
                description: 'Комплекс упражнений для заминки'
            },
            { 
                title: 'Как увеличить силу хвата', 
                image: null,
                description: 'Упражнения для предплечий'
            },
            { 
                title: 'Тренировка ног дома', 
                image: null,
                description: 'Без железа и тренажеров'
            },
            { 
                title: 'Спортивные добавки', 
                image: null,
                description: 'Что реально работает'
            }
        ];
        
        await renderProfilePage(app, {
            profile: {
                name: 'Абдурахман Гасанов',
                role: 'Фитнес-тренер',
                isOwnProfile: true
            },
            currentUser: {
                id: 999,
                name: 'Абдурахман Гасанов',
                role: 'Фитнес-тренер'
            },
            subscriptions: manySubscriptions,
            posts: manyPosts,
            activeTab: 'publications',
            popularPosts: manyPopularPosts,
            onLogout: () => {
                console.log('👋 Выход из системы');
                alert('Вы вышли из системы');
            }
        });
        
        console.log('Profile page rendered successfully');
    } catch (error) {
        console.error('Failed to render profile page:', error);
        app.innerHTML = '<div style="color: red; padding: 20px;">Ошибка загрузки страницы профиля</div>';
    }
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting application...');
    await loadTemplates();
    await demoProfilePage();
});
