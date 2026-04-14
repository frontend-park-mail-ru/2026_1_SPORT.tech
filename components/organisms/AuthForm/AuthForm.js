/**
 * @fileoverview Компонент формы авторизации
 * Поддерживает:
 * - Вход (login)
 * - Регистрацию клиента
 * - Регистрацию тренера
 * - Валидацию всех полей
 * - Интеграцию с API
 *
 * @module components/organisms/AuthForm
 */

import { Validator } from '/src/utils/validator.js';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button.js';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.js';

/**
 * @constant {Object} AUTH_MODES - Режимы работы формы авторизации
 * @property {string} LOGIN - Режим входа
 * @property {string} REGISTER_CLIENT - Регистрация клиента
 * @property {string} REGISTER_TRAINER - Регистрация тренера
 */
export const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER_CLIENT: 'register-client',
  REGISTER_TRAINER: 'register-trainer'
};

/**
 * Форматирует ввод даты в формате ГГГГ-ММ-ДД
 * @private
 * @param {string} value - Введенное значение
 * @returns {string} Отформатированная дата
 *
 * @example
 * formatDateInput('2024') // '2024'
 * formatDateInput('202412') // '2024-12'
 * formatDateInput('20241225') // '2024-12-25'
 */
function formatDateInput(value) {
  // Если уже в правильном формате YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Пробуем парсить DD.MM.YYYY или DD/MM/YYYY
  const parts = value.split(/[.\/]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && year.length === 4 && day.length <= 2 && month.length <= 2) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Старая логика для цифрового ввода (20241225 -> 2024-12-25)
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;

  return value;
}

/**
 * Рендерит форму авторизации
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} config - Конфигурация формы
 * @param {string} [config.mode=AUTH_MODES.LOGIN] - Режим работы формы
 * @param {Function} [config.onSubmit=null] - Обработчик отправки формы
 * @param {Function} [config.onSwitchMode=null] - Обработчик переключения режима
 * @param {Object} [config.api] - API клиент
 * @returns {Promise<Object>} API для управления формой
 */
export async function renderAuthForm(container, config = {}) {
  const { mode = AUTH_MODES.LOGIN, onSubmit = null, onSwitchMode = null, api } = config;

  const validator = new Validator();
  const template = Handlebars.templates['AuthForm.hbs'];

  /**
   * @constant {Object} modeConfig - Конфигурация для текущего режима
   * @property {string} title - Заголовок формы
   * @property {string} subtitle - Подзаголовок
   * @property {string} submitText - Текст кнопки отправки
   * @property {string} altText - Текст альтернативного действия
   * @property {string} altLinkText - Текст ссылки альтернативного действия
   * @property {Array} fields - Массив полей формы
   */
  const modeConfig = {
    [AUTH_MODES.LOGIN]: {
      title: 'Вход в Sporteon',
      subtitle: 'Войдите, чтобы быть в тонусе',
      submitText: 'Войти',
      altText: 'Нет аккаунта?',
      altLinkText: 'Зарегистрироваться',
      fields: [
        {
          type: INPUT_TYPES.MAIL,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD,
          name: 'password',
          label: 'Пароль',
          placeholder: 'Введите пароль',
          required: true,
          showEye: true
        }
      ]
    },
    [AUTH_MODES.REGISTER_CLIENT]: {
      title: 'Регистрация',
      subtitle: 'Создайте аккаунт, чтобы начать',
      submitText: 'Зарегистрироваться',
      altText: 'Уже есть аккаунт?',
      altLinkText: 'Войти',
      fields: [
        {
          type: INPUT_TYPES.NAME,
          name: 'first_name',
          label: 'Имя',
          placeholder: 'Введите имя',
          required: true
        },
        {
          type: INPUT_TYPES.NAME,
          name: 'last_name',
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'username',
          label: 'Имя пользователя',
          placeholder: 'john_doe',
          required: true
        },
        {
          type: INPUT_TYPES.MAIL,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD,
          name: 'password',
          label: 'Пароль',
          placeholder: 'Минимум 8 символов',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.PASSWORD,
          name: 'password_repeat',
          label: 'Подтверждение пароля',
          placeholder: 'Повторите пароль',
          required: true,
          showEye: true
        }
      ]
    },
    [AUTH_MODES.REGISTER_TRAINER]: {
      title: 'Регистрация тренера',
      subtitle: 'Создайте аккаунт тренера',
      submitText: 'Зарегистрироваться',
      altText: 'Уже есть аккаунт?',
      altLinkText: 'Войти',
      fields: [
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'username',
          label: 'Никнейм (отображаемое имя)',
          placeholder: 'john_doe',
          required: true
        },
        {
          type: INPUT_TYPES.NAME,
          name: 'first_name',
          label: 'Имя',
          placeholder: 'Введите имя',
          required: true
        },
        {
          type: INPUT_TYPES.NAME,
          name: 'last_name',
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
          required: true
        },
        {
          type: INPUT_TYPES.MAIL,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD,
          name: 'password',
          label: 'Пароль',
          placeholder: 'Минимум 8 символов',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.PASSWORD,
          name: 'password_repeat',
          label: 'Подтверждение пароля',
          placeholder: 'Повторите пароль',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'education_degree',
          label: 'Образование',
          placeholder: 'Введите образование',
          required: false
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'career_since_date',
          label: 'Дата начала профессиональной деятельности',
          placeholder: 'ГГГГ-ММ-ДД',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'sport_discipline',
          label: 'Вид дисциплины/спорта',
          placeholder: 'например: футбол, плавание, бокс',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'bio',
          label: 'О себе',
          placeholder: 'Расскажите о себе',
          required: false
        }
      ]
    }
  };

  const currentMode = modeConfig[mode];

  const html = template({
    title: currentMode.title,
    subtitle: currentMode.subtitle,
    hasAltAction: true,
    altText: currentMode.altText,
    altLinkText: currentMode.altLinkText
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const form = wrapper.firstElementChild;
  form.setAttribute('novalidate', '');

  const fieldsContainer = form.querySelector('.auth-form__fields');
  const submitContainer = form.querySelector('.auth-form__submit-container');

  /** @type {Map<string, HTMLElement>} */
  const inputs = new Map();
  /** @type {Map<string, Object>} */
  const inputsApi = new Map();

  /**
   * Валидация поля
   * @param {string} fieldName - Имя поля
   * @param {string} value - Значение поля
   * @returns {boolean} true если валидно
   */
  const validateField = (fieldName, value) => {
    const api = inputsApi.get(fieldName);
    if (!api) return true;

    let result;
    switch (fieldName) {
      case 'email':
        result = validator.validateEmail(value);
        break;
      case 'password':
        result = validator.validatePassword(value);
        break;
      case 'username':
        result = validator.validateUsername(value);
        break;
      case 'first_name':
        result = validator.validateFirstName(value);
        break;
      case 'last_name':
        result = validator.validateLastName(value);
        break;
      case 'password_repeat':
        const password = inputsApi.get('password')?.getValue() || '';
        result = validator.validatePasswordWithConfirmation(password, value);
        break;
      case 'education_degree': {
  validator.reset();
  const validationResult = {
    isValid: true,
    errors: []
  };

  if (value && value.trim() !== '') {
    validator.validateField(value, 'education_degree', validator.rules.education_degree);

    if (validator.hasErrors()) {
      validationResult.isValid = false;
      validationResult.errors = validator.getErrors();
    }
  }

  result = validationResult;
  break;
}
      case 'career_since_date':
  if (!value) {
    result = {
      isValid: false,
      errors: [{ field: 'career_since_date', message: 'Дата начала деятельности обязательна' }]
    };
  } else {
    // Проверяем разные форматы
    const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const ddMmYyyy = /^\d{2}[.\/]\d{2}[.\/]\d{4}$/.test(value);

    if (yyyyMmDd) {
      result = { isValid: true, errors: [] };
    } else if (ddMmYyyy) {
      // Преобразуем DD.MM.YYYY в YYYY-MM-DD
      const parts = value.split(/[.\/]/);
      const [day, month, year] = parts;
      const converted = `${year}-${month}-${day}`;
      // Обновляем значение в поле
      api.setValue(converted);
      result = { isValid: true, errors: [] };
    } else {
      result = {
        isValid: false,
        errors: [{ field: 'career_since_date', message: 'Дата должна быть в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ' }]
      };
    }
  }
  break;
      case 'sport_discipline': {
  validator.reset();
  const validationResult = {
    isValid: true,
    errors: []
  };

  if (value && value.trim() !== '') {
    validator.validateField(value, 'sport_discipline', validator.rules.sports_rank);

    if (validator.hasErrors()) {
      validationResult.isValid = false;
      const errors = validator.getErrors().map(err => ({
        ...err,
        field: 'sport_discipline'
      }));
      validationResult.errors = errors;
    }
  }

  result = validationResult;
  break;
}
      case 'bio':
        const bioValid = !value || value.length <= 1000;
        result = {
          isValid: bioValid,
          errors: bioValid ? [] : [{ field: 'bio', message: 'Максимум 1000 символов' }]
        };
        break;
      default:
        return true;
    }

    if (!result.isValid && result.errors.length > 0) {
      api.setError(result.errors[0].message);
      return false;
    } else {
      api.setNormal();
      return true;
    }
  };

  /**
   * Создание полей формы
   * @param {Object} fieldConfig - Конфигурация поля
   */
  for (const fieldConfig of currentMode.fields) {
    const fieldContainer = document.createElement('div');
    fieldsContainer.appendChild(fieldContainer);

    // AuthForm.js - в цикле создания полей

if (fieldConfig.name === 'career_since_date') {
    const inputApi = await renderInput(fieldContainer, {
        type: fieldConfig.type,
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        name: fieldConfig.name,
        required: fieldConfig.required,
        onChange: value => validateField(fieldConfig.name, value)
    });

    const input = inputApi.input;

    // Маска для автоматического форматирования
    input.addEventListener('input', e => {
        let value = e.target.value;

        // Удаляем все не-цифры
        value = value.replace(/\D/g, '');

        // Форматируем как ГГГГ-ММ-ДД
        if (value.length >= 4) {
            let formatted = value.substring(0, 4);

            if (value.length > 4) {
                formatted += '-' + value.substring(4, 6);
            }

            if (value.length > 6) {
                formatted += '-' + value.substring(6, 8);
            }

            e.target.value = formatted;
        } else {
            e.target.value = value;
        }

        validateField(fieldConfig.name, e.target.value);
    });

    inputs.set(fieldConfig.name, fieldContainer);
    inputsApi.set(fieldConfig.name, inputApi);
}
    else if (fieldConfig.name === 'sport_discipline') {
      const inputApi = await renderInput(fieldContainer, {
        type: fieldConfig.type,
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        name: fieldConfig.name,
        required: fieldConfig.required,
        showEye: fieldConfig.showEye,
        onChange: value => validateField(fieldConfig.name, value)
      });

      const helpText = document.createElement('small');
      helpText.textContent = 'Можно указать несколько через запятую';
      helpText.style.cssText = `
        font-size: var(--font-size-xs);
        color: var(--text-placeholder);
        margin-top: 2px;
        display: block;
      `;
      fieldContainer.appendChild(helpText);

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, inputApi);
    } else {
      const inputApi = await renderInput(fieldContainer, {
        type: fieldConfig.type,
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        name: fieldConfig.name,
        required: fieldConfig.required,
        showEye: fieldConfig.showEye,
        onChange: value => validateField(fieldConfig.name, value)
      });

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, inputApi);
    }
  }

  const submitBtn = await renderButton(submitContainer, {
    text: currentMode.submitText,
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    fullWidth: true
  });

  /**
   * Валидация всей формы
   * @returns {boolean} true если форма валидна
   */
  const validateForm = () => {
    let isValid = true;

    for (const [name, api] of inputsApi) {
      const value = api.getValue();
      if (!validateField(name, value)) {
        isValid = false;
      }
    }

    if (mode !== AUTH_MODES.LOGIN) {
      const password = inputsApi.get('password')?.getValue();
      const passwordRepeat = inputsApi.get('password_repeat')?.getValue();

      if (password && passwordRepeat && password !== passwordRepeat) {
        const repeatApi = inputsApi.get('password_repeat');
        repeatApi.setError('Пароли не совпадают');
        isValid = false;
      }
    }

    return isValid;
  };

  /**
   * Получить данные формы
   * @returns {Object} Объект с данными формы
   */
const getFormData = () => {
  const data = {};
  for (const [name, api] of inputsApi) {
    data[name] = api.getValue();
  }

  if (mode === AUTH_MODES.REGISTER_TRAINER) {
    data.trainer_details = {
      education_degree: data.education_degree || '',
      career_since_date: data.career_since_date,
      sports: [{
        sport_type_id: 1,
        experience_years: 0,
        sports_rank: data.sports_rank || data.sport_discipline || ''
      }]
    };
  }

  return data;
};
  /**
   * Установить ошибки из API
   * @param {Array} errors - Массив ошибок
   */
  const setApiErrors = errors => {
    if (!errors || !Array.isArray(errors)) return;

    errors.forEach(error => {
      const api = inputsApi.get(error.field);
      if (api) {
        api.setError(error.message);
      }
    });
  };

  /**
   * Сбросить форму
   */
  const resetForm = () => {
    for (const api of inputsApi.values()) {
      api.setValue('');
      api.setNormal();
    }
  };

  /**
   * Показать глобальную ошибку
   * @param {string} message - Текст ошибки
   */
  const setGlobalError = message => {
    let globalError = form.querySelector('.auth-form__global-error');
    if (!globalError) {
      globalError = document.createElement('div');
      globalError.className = 'auth-form__global-error';
      globalError.style.cssText = `
        color: var(--error-red);
        background: var(--error-light);
        padding: var(--spacing-md);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-lg);
        font-size: var(--font-size-sm);
        text-align: center;
      `;
      fieldsContainer.parentNode.insertBefore(globalError, fieldsContainer);
    }
    globalError.textContent = message;
  };

  /**
   * Очистить глобальную ошибку
   */
  const clearGlobalError = () => {
    const globalError = form.querySelector('.auth-form__global-error');
    if (globalError) {
      globalError.remove();
    }
  };

  /**
   * Обработчик отправки формы
   * @param {MouseEvent} e - Событие клика
   */
  submitBtn.element.addEventListener('click', async e => {
    e.preventDefault();

    clearGlobalError();

    if (!validateForm()) {
      return;
    }

    const formData = getFormData();

    if (onSubmit) {
      try {
        await onSubmit(formData, mode);
      } catch (error) {
        if (error.data?.error?.fields) {
          setApiErrors(error.data.error.fields);
        } else {
          setGlobalError(error.message || 'Произошла ошибка');
        }
      }
    }
  });

  /**
   * Обработчик переключения режима
   * @param {MouseEvent} e - Событие клика
   */
  const altLink = form.querySelector('.auth-form__link--alt');
  if (altLink && onSwitchMode) {
    altLink.addEventListener('click', e => {
      e.preventDefault();
      const newMode = mode === AUTH_MODES.LOGIN ? AUTH_MODES.REGISTER_CLIENT : AUTH_MODES.LOGIN;
      onSwitchMode(newMode);
    });
  }

  container.appendChild(form);

  return {
    element: form,
    getData: getFormData,
    validate: validateForm,
    reset: resetForm,
    setErrors: setApiErrors,
    setGlobalError,
    clearGlobalError,
    inputs: inputsApi
  };
}
