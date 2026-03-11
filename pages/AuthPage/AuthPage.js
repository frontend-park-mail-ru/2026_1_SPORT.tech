/**
 * Страница авторизации
 * Объединяет форму и API
 */

import { renderAuthForm, AUTH_MODES } from '../../components/organisms/AuthForm/AuthForm.js';

export class AuthPage {
    constructor(container) {
        this.container = container;
        this.form = null;
        this.currentMode = AUTH_MODES.LOGIN;
    }

    /**
     * Обработка входа
     */
    async handleLogin(data) {
        try {
            const response = await api.login(data.email, data.password);

            if (response?.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
            }

            window.location.hash = '#/profile';
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Обработка регистрации клиента
     */
    async handleClientRegister(data) {
        try {
            const response = await api.registerClient({
                username: data.username,
                email: data.email,
                password: data.password,
                password_repeat: data.password_repeat,
                first_name: data.first_name,
                last_name: data.last_name
            });

            if (response?.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
            }

            window.location.hash = '#/profile';
        } catch (error) {
            console.error('Register error:', error);
            throw error;
        }
    }

    /**
     * Обработка регистрации тренера
     */
    async handleTrainerRegister(data) {
        try {
            const response = await api.registerTrainer({
                username: data.username,
                email: data.email,
                password: data.password,
                password_repeat: data.password_repeat,
                first_name: data.first_name,
                last_name: data.last_name,
                trainer_details: {
                    education_degree: data.education || "",
                    career_since_date: data.career_since_date,
                    sports: [
                        {
                            sport_type_id: 1,
                            experience_years: 0,
                            sports_rank: ""
                        }
                    ]
                }
            });

            if (response?.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
            }

            window.location.hash = '#/profile';
        } catch (error) {
            console.error('Trainer register error:', error);
            throw error;
        }
    }

    /**
     * Переключение режима формы
     */
    async switchMode(newMode) {
        this.currentMode = newMode;
        await this.render();
    }

    /**
     * Рендер страницы
     */
    async render() {
        this.container.innerHTML = '';

        const template = Handlebars.templates['AuthPage.hbs'];

        const html = template({
            showRoleSelector: this.currentMode !== AUTH_MODES.LOGIN,
            isClientActive: this.currentMode === AUTH_MODES.REGISTER_CLIENT,
            isTrainerActive: this.currentMode === AUTH_MODES.REGISTER_TRAINER
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const pageElement = wrapper.firstElementChild;

        const formContainer = pageElement.querySelector('.auth-form-container');

        this.form = await renderAuthForm(formContainer, {
            mode: this.currentMode,
            onSubmit: async (data, mode) => {
                if (mode === AUTH_MODES.LOGIN) {
                    await this.handleLogin(data);
                } else if (mode === AUTH_MODES.REGISTER_CLIENT) {
                    await this.handleClientRegister(data);
                } else if (mode === AUTH_MODES.REGISTER_TRAINER) {
                    await this.handleTrainerRegister(data);
                }
            },
            onSwitchMode: (newMode) => {
                this.switchMode(newMode);
            }
        });

        const roleButtons = pageElement.querySelectorAll('.auth-page__role-btn');
        roleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.target.dataset.role;
                if (role === 'client') {
                    this.switchMode(AUTH_MODES.REGISTER_CLIENT);
                } else if (role === 'trainer') {
                    this.switchMode(AUTH_MODES.REGISTER_TRAINER);
                }
            });
        });

        this.container.appendChild(pageElement);
    }
}
