/**
 * @fileoverview Страница авторизации
 * Объединяет форму авторизации и API
 *
 * @module pages/AuthPage
 */

import { AUTH_MODES, renderAuthForm } from '../../components/organisms/AuthForm/AuthForm.js';

/**
 * Рендерит страницу авторизации
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} api - API клиент
 * @returns {Promise<void>}
 *
 * @example
 * await renderAuthPage(document.getElementById('app'), apiClient);
 */
export async function renderAuthPage(container, api) {
  /** @type {string} Текущий режим формы */
  let currentMode = AUTH_MODES.LOGIN;
  /** @type {Object} API формы */
  let form = null;

  /**
   * Обработка входа
   * @async
   * @param {Object} data - Данные формы
   * @param {string} data.email - Email пользователя
   * @param {string} data.password - Пароль
   * @throws {Error} Ошибка авторизации
   */
  async function handleLogin(data) {
    try {
      const response = await api.login(data.email, data.password);

      if (response?.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        window.router?.setCurrentUser(response);
      }

      window.router.navigateTo('/');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Обработка регистрации клиента
   * @async
   * @param {Object} data - Данные формы
   * @throws {Error} Ошибка регистрации
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
        window.router?.setCurrentUser(response);
      }

      window.router.navigateTo('/');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Обработка регистрации тренера
   * @async
   * @param {Object} data - Данные формы
   * @throws {Error} Ошибка регистрации
   */
  /**
 * Нормализует дату в формат YYYY-MM-DD
 * @param {string} dateString - Входящая дата
 * @returns {string} Дата в формате YYYY-MM-DD
 */


/**
 * Обработка регистрации тренера
 */
async function handleTrainerRegister(data) {
    try {
        const careerDate = data.trainer_details?.career_since_date?.trim() || '';
        const sports = Array.isArray(data.trainer_details?.sports) ? data.trainer_details.sports : [];

        if (!/^\d{4}-\d{2}-\d{2}$/.test(careerDate)) {
            alert('Введите дату в формате ГГГГ-ММ-ДД (например, 2020-01-01)');
            return;
        }

        if (sports.length === 0) {
            alert('Выберите хотя бы один вид спорта');
            return;
        }

        const response = await api.registerTrainer({
            username: data.username,
            email: data.email,
            password: data.password,
            password_repeat: data.password_repeat,
            first_name: data.first_name,
            last_name: data.last_name,
            trainer_details: {
                education_degree: data.trainer_details?.education_degree || '',
                career_since_date: careerDate,
                sports
            }
        });

        if (response?.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
            window.router?.setCurrentUser(response);
            window.router.navigateTo('/');
        }
    } catch (error) {
        throw error;
    }
}
  /**
   * Переключение режима формы
   * @async
   * @param {string} newMode - Новый режим из AUTH_MODES
   */
  async function switchMode(newMode) {
    currentMode = newMode;
    await render();
  }

  /**
   * Рендер страницы
   * @async
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
      /**
       * Обработчик отправки формы
       * @param {Object} data - Данные формы
       * @param {string} mode - Режим формы
       */
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
          throw error;
        }
      },
      onSwitchMode: newMode => {
        switchMode(newMode);
      }
    });

    /**
     * Обработчики кнопок выбора роли
     * @param {MouseEvent} e - Событие клика
     */
    const roleButtons = pageElement.querySelectorAll('.auth-page__role-btn');
    roleButtons.forEach(btn => {
      btn.addEventListener('click', e => {
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
