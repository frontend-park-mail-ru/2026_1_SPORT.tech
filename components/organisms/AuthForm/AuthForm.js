/**
 * КОМПОНЕНТ ФОРМЫ АВТОРИЗАЦИИ
 * Поддерживает:
 * - Вход (login)
 * - Регистрацию клиента
 * - Регистрацию тренера
 * - Валидацию всех полей
 * - Интеграцию с API
 */

import {validateEmail, validateFirstName, validateLastName, validatePassword, validatePasswordWithConfirmation, validateUsername} from '/src/utils/validator.js';

import {BUTTON_SIZES, BUTTON_VARIANTS, renderButton} from '../../atoms/Button/Button.js';
import {INPUT_STATES, INPUT_TYPES, renderInput} from '../../atoms/Input/Input.js';

export const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER_CLIENT: 'register-client',
  REGISTER_TRAINER: 'register-trainer'
};

// Функция форматирования даты
function formatDateInput(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
}

/**
 * Рендерит форму авторизации
 * @param {HTMLElement} container - Контейнер для вставки
 * @param {Object} config - Конфигурация
 * @param {string} config.mode - Режим (login, register-client,
 *     register-trainer)
 * @param {Function} config.onSubmit - Обработчик отправки формы
 * @param {Function} config.onSwitchMode - Обработчик переключения режима
 * @returns {Promise<Object>} API формы
 */
export async function renderAuthForm(container, config = {}) {
  const {mode = AUTH_MODES.LOGIN, onSubmit = null, onSwitchMode = null} =
      config;

  const template = Handlebars.templates['AuthForm.hbs'];

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
    },
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

  const inputs = new Map();
  const inputsApi = new Map();

  /**
   * Валидация поля
   */
  const validateField = (fieldName, value) => {
    const api = inputsApi.get(fieldName);
    if (!api) return true;

    let result;
    switch (fieldName) {
      case 'email':
        result = validateEmail(value);
        break;
      case 'password':
        result = validatePassword(value);
        console.log(
            'Password validation:',
            {value, isValid: result.isValid, errors: result.errors});
        break;
      case 'username':
        result = validateUsername(value);
        break;
      case 'first_name':
        result = validateFirstName(value);
        break;
      case 'last_name':
        result = validateLastName(value);
        break;
      case 'password_repeat':
        const password = inputsApi.get('password')?.getValue() || '';
        result = validatePasswordWithConfirmation(password, value);
        break;
      case 'education_degree':
        const eduValid = !value || value.length <= 255;
        result = {
          isValid: eduValid,
          errors: eduValid ? [] : [{field: 'education_degree', message: 'Максимум 255 символов'}]
        };
        break;
      case 'career_since_date':
        if (!value) {
          result = {
            isValid: false,
            errors: [{field: 'career_since_date', message: 'Дата начала деятельности обязательна'}]
          };
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          result = {
            isValid: false,
            errors: [{field: 'career_since_date', message: 'Дата должна быть в формате ГГГГ-ММ-ДД'}]
          };
        } else {
          result = {isValid: true, errors: []};
        }
        break;
      case 'sport_discipline':
        if (!value || value.trim().length === 0) {
          result = {
            isValid: false,
            errors: [{field: 'sport_discipline', message: 'Вид спорта обязателен'}]
          };
        } else if (value.length > 100) {
          result = {
            isValid: false,
            errors: [{field: 'sport_discipline', message: 'Максимум 100 символов'}]
          };
        } else {
          result = {isValid: true, errors: []};
        }
        break;
      case 'bio':
        const bioValid = !value || value.length <= 1000;
        result = {
          isValid: bioValid,
          errors: bioValid ? [] : [{field: 'bio', message: 'Максимум 1000 символов'}]
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

  for (const fieldConfig of currentMode.fields) {
    const fieldContainer = document.createElement('div');
    fieldsContainer.appendChild(fieldContainer);

    if (fieldConfig.name === 'career_since_date') {
      const inputApi = await renderInput(fieldContainer, {
        type: fieldConfig.type,
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        name: fieldConfig.name,
        required: fieldConfig.required,
        showEye: fieldConfig.showEye,
        onChange: (value) => validateField(fieldConfig.name, value)
      });

      const input = inputApi.input;
      input.addEventListener('input', (e) => {
        const formatted = formatDateInput(e.target.value);
        if (formatted !== e.target.value) {
          e.target.value = formatted;
          validateField(fieldConfig.name, formatted);
        }
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
        onChange: (value) => validateField(fieldConfig.name, value)
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
    }
    else {
      const inputApi = await renderInput(fieldContainer, {
        type: fieldConfig.type,
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        name: fieldConfig.name,
        required: fieldConfig.required,
        showEye: fieldConfig.showEye,
        onChange: (value) => validateField(fieldConfig.name, value)
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
   */
  const getFormData = () => {
    const data = {};
    for (const [name, api] of inputsApi) {
      data[name] = api.getValue();
    }
    return data;
  };

  /**
   * Установить ошибки из API
   */
  const setApiErrors = (errors) => {
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
   */
  const setGlobalError = (message) => {
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

  submitBtn.element.addEventListener('click', async (e) => {
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

  const altLink = form.querySelector('.auth-form__link--alt');
  if (altLink && onSwitchMode) {
    altLink.addEventListener('click', (e) => {
      e.preventDefault();
      const newMode = mode === AUTH_MODES.LOGIN ? AUTH_MODES.REGISTER_CLIENT :
                                                  AUTH_MODES.LOGIN;
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
