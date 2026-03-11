// ===== РЕГИСТРАЦИЯ ШАБЛОНОВ HANDLEBARS =====
Handlebars.templates = {};

async function loadTemplates() {
    const templates = [
        'Button',
        'Input',
        'Avatar',
        'UserPhotoItem',
        'AuthForm',  // Добавили AuthForm
        'AuthPage'
    ];

    for (const name of templates) {
        try {
            let path;
            if (name === 'AuthForm') {
                path = '/components/organisms/AuthForm/AuthForm.hbs';
            } else if (name === 'AuthPage') {
                path = '/pages/AuthPage/AuthPage.hbs';  // Путь к шаблону страницы
            } else {
                path = `/components/atoms/${name}/${name}.hbs`;
            }

            const response = await fetch(path);
            const source = await response.text();
            Handlebars.templates[`${name}.hbs`] = Handlebars.compile(source);
            console.log(`✅ Loaded template: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to load template ${name}:`, error);
        }
    }
}

// ===== ДЕМОНСТРАЦИЯ КОМПОНЕНТОВ (МОЖНО УДАЛИТЬ, ЕСЛИ НЕ НУЖНО) =====
async function demoAllComponents() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    app.innerHTML = '<h1 style="color: var(--primary-orange); padding: 20px;">Загрузка...</h1>';
}

// ===== НАВИГАЦИЯ =====
class App {
    constructor() {
        this.currentPage = null;
        this.app = document.getElementById('app');
    }

    async init() {
        console.log('App initializing...');

        // Загружаем шаблоны
        await loadTemplates();

        // Определяем текущий путь
        let path = window.location.pathname;

        // Для локального тестирования без сервера
        if (path === '/' || path === '/index.html') {
            path = '/auth';  // Всегда показываем авторизацию
        }

        console.log('Current path:', path);

        if (path === '/auth') {
            await this.showAuthPage();
        } else {
            await this.showMainPage();
        }
    }

    async showAuthPage() {
        console.log('Showing auth page');
        this.app.innerHTML = '';
        document.body.classList.add('auth-page');

        try {
            // Динамический импорт AuthPage
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

    async showMainPage() {
        console.log('Showing main page');
        this.app.innerHTML = '';
        document.body.classList.remove('auth-page');

        // Временно показываем заглушку
        this.app.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h1 style="color: var(--primary-orange);">SPORT.tech</h1>
                <p style="margin-top: 20px;">Главная страница</p>
                <button onclick="window.location.href='/auth'" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: var(--primary-orange);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                ">
                    Перейти к авторизации
                </button>
            </div>
        `;
    }
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');

    // Создаем и запускаем приложение
    const app = new App();
    window.app = app; // Для отладки
    await app.init();
});
