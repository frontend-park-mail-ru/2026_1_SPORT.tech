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
      }

      window.router.navigateTo('/profile');
    } catch (error) {
      console.error('Login error:', error);
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
      }

      window.router.navigateTo('/profile');
    } catch (error) {
      console.error('Register error:', error);
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
function normalizeDate(dateString) {
  if (!dateString) return '';

  // Уже в правильном формате
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Пробуем парсить DD.MM.YYYY или DD/MM/YYYY
  const parts = dateString.split(/[.\/]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && year.length === 4) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Пробуем через Date объект
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return dateString;
}

/**
 * Обработка регистрации тренера
 */
async function handleTrainerRegister(data) {
    try {
        // Дата уже отформатирована маской в AuthForm.js
        const careerDate = data.career_since_date?.trim() || '';

        console.log('📅 Дата из формы (career_since_date):', careerDate);

        // Простая проверка формата перед отправкой
        if (!/^\d{4}-\d{2}-\d{2}$/.test(careerDate)) {
            alert('Введите дату в формате ГГГГ-ММ-ДД (например, 2020-01-01)');
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
                education_degree: data.education_degree || '',
                career_since_date: careerDate,
                sports: [{
                    sport_type_id: 1,
                    experience_years: 1,   // ← 1 вместо 0 (на всякий случай)
                    sports_rank: data.sport_discipline || ''
                }]
            }
        });

        if (response?.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
            window.router.navigateTo('/profile');
        }
    } catch (error) {
        console.error('Trainer register error:', error);
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
          console.error('Form submission error:', error);
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
