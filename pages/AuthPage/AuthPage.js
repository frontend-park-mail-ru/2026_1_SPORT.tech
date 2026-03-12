/**
 * Страница авторизации
 * Объединяет форму и API
 */

import { renderAuthForm, AUTH_MODES } from '../../components/organisms/AuthForm/AuthForm.js';

export async function renderAuthPage(container, api) {
    let currentMode = AUTH_MODES.LOGIN;
    let form = null;

    /**
     * Обработка входа
     */
    async function handleLogin(data) {
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
    async function handleClientRegister(data) {
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
    async function handleTrainerRegister(data) {
        try {
            const response = await api.registerTrainer({
                username: data.username,
                email: data.email,
                password: data.password,
                password_repeat: data.password_repeat,
                first_name: data.first_name,
                last_name: data.last_name,
                trainer_details: {
                    education_degree: data.education_degree || "",
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
    async function switchMode(newMode) {
        currentMode = newMode;
        await render();
    }

    /**
     * Рендер страницы
     */
    async function render() {
        container.innerHTML = '';

        const template = Handlebars.templates['AuthPage.hbs'];

        const html = template({
            showRoleSelector: currentMode !== AUTH_MODES.LOGIN,
            isClientActive: currentMode === AUTH_MODES.REGISTER_CLIENT,
            isTrainerActive: currentMode === AUTH_MODES.REGISTER_TRAINER
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const pageElement = wrapper.firstElementChild;

        const formContainer = pageElement.querySelector('.auth-form-container');

        form = await renderAuthForm(formContainer, {
            mode: currentMode,
            api: api,
            onSubmit: async (data, mode) => {
                try {
                    if (mode === AUTH_MODES.LOGIN) {
                        await handleLogin(data);
                    } else if (mode === AUTH_MODES.REGISTER_CLIENT) {
                        await handleClientRegister(data);
                    } else if (mode === AUTH_MODES.REGISTER_TRAINER) {
                        await handleTrainerRegister(data);
                    }
                } catch (error) {
                    console.error('Form submission error:', error);
                }
            },
            onSwitchMode: (newMode) => {
                switchMode(newMode);
            }
        });

        const roleButtons = pageElement.querySelectorAll('.auth-page__role-btn');
        roleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.target.dataset.role;
                if (role === 'client') {
                    switchMode(AUTH_MODES.REGISTER_CLIENT);
                } else if (role === 'trainer') {
                    switchMode(AUTH_MODES.REGISTER_TRAINER);
                }
            });
        });

        container.appendChild(pageElement);
    }

    await render();
}
