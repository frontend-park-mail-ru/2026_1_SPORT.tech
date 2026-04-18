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

let sportTypesPromise = null;

export async function loadSportTypes(api) {
  if (!api?.getSportTypes) {
    return [];
  }

  if (!sportTypesPromise) {
    sportTypesPromise = api.getSportTypes()
      .then(response => Array.isArray(response?.sport_types) ? response.sport_types : [])
      .catch(error => {
        sportTypesPromise = null;
        throw error;
      });
  }

  return sportTypesPromise;
}

export function createSportTypesField(container, {
  label,
  placeholder,
  required,
  options,
  onChange
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sport-types-field sport-types-field--normal';
  wrapper.innerHTML = `
    <label class="sport-types-field__label">
      ${label}${required ? ' *' : ''}
    </label>
    <button type="button" class="sport-types-field__trigger" aria-expanded="false">
      <span class="sport-types-field__trigger-text">${placeholder}</span>
      <span class="sport-types-field__chevron" aria-hidden="true"></span>
    </button>
    <div class="sport-types-field__dropdown" hidden></div>
    <span class="sport-types-field__message"></span>
  `;

  const trigger = wrapper.querySelector('.sport-types-field__trigger');
  const triggerText = wrapper.querySelector('.sport-types-field__trigger-text');
  const dropdown = wrapper.querySelector('.sport-types-field__dropdown');
  const message = wrapper.querySelector('.sport-types-field__message');
  const selectedIds = new Set();

  const updateTriggerText = () => {
    if (selectedIds.size === 0) {
      triggerText.textContent = placeholder;
      triggerText.classList.add('sport-types-field__trigger-text--placeholder');
      return;
    }

    const selectedNames = options
      .filter(option => selectedIds.has(String(option.sport_type_id)))
      .map(option => option.name);

    triggerText.textContent = selectedNames.join(', ');
    triggerText.classList.remove('sport-types-field__trigger-text--placeholder');
  };

  const openDropdown = () => {
    dropdown.hidden = false;
    wrapper.classList.add('sport-types-field--open');
    trigger.setAttribute('aria-expanded', 'true');
  };

  const closeDropdown = () => {
    dropdown.hidden = true;
    wrapper.classList.remove('sport-types-field--open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  options.forEach(option => {
    const item = document.createElement('label');
    item.className = 'sport-types-field__option';
    item.innerHTML = `
      <input
        type="checkbox"
        class="sport-types-field__checkbox"
        value="${option.sport_type_id}"
      >
      <span class="sport-types-field__option-label">${option.name}</span>
    `;

    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedIds.add(String(option.sport_type_id));
      } else {
        selectedIds.delete(String(option.sport_type_id));
      }
      updateTriggerText();
      onChange?.(Array.from(selectedIds).map(Number));
    });

    dropdown.appendChild(item);
  });

  trigger.addEventListener('click', () => {
    if (dropdown.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) {
      closeDropdown();
    }
  });

  container.appendChild(wrapper);
  updateTriggerText();

  return {
    element: wrapper,
    input: trigger,
    setValue: values => {
      selectedIds.clear();
      const normalizedValues = Array.isArray(values) ? values.map(value => String(value)) : [];
      dropdown.querySelectorAll('.sport-types-field__checkbox').forEach(checkbox => {
        checkbox.checked = normalizedValues.includes(checkbox.value);
        if (checkbox.checked) {
          selectedIds.add(checkbox.value);
        }
      });
      updateTriggerText();
      onChange?.(Array.from(selectedIds).map(Number));
    },
    getValue: () => Array.from(selectedIds).map(Number),
    focus: () => trigger.focus(),
    blur: () => trigger.blur(),
    setError: text => {
      wrapper.classList.remove('sport-types-field--normal');
      wrapper.classList.add('sport-types-field--error');
      message.textContent = text || '';
    },
    setNormal: () => {
      wrapper.classList.remove('sport-types-field--error');
      wrapper.classList.add('sport-types-field--normal');
      message.textContent = '';
    },
    clearError: () => {
      wrapper.classList.remove('sport-types-field--error');
      wrapper.classList.add('sport-types-field--normal');
      message.textContent = '';
    }
  };
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
          placeholder: 'Выберите дату',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS,
          name: 'sport_discipline',
          label: 'Вид дисциплины/спорта',
          placeholder: 'Выберите виды спорта',
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
        result = !value
          ? {
            isValid: false,
            errors: [{ field: 'career_since_date', message: 'Дата начала деятельности обязательна' }]
          }
          : /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? { isValid: true, errors: [] }
            : {
              isValid: false,
              errors: [{ field: 'career_since_date', message: 'Дата должна быть в формате ГГГГ-ММ-ДД' }]
            };
        break;
      case 'sport_discipline':
        result = Array.isArray(value) && value.length > 0
          ? { isValid: true, errors: [] }
          : {
            isValid: false,
            errors: [{ field: 'sport_discipline', message: 'Выберите хотя бы один вид спорта' }]
          };
        break;
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
  const sportTypeOptions = mode === AUTH_MODES.REGISTER_TRAINER
    ? await loadSportTypes(api).catch(() => [])
    : [];

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
        onChange: value => validateField(fieldConfig.name, value)
      });

      inputApi.input.type = 'date';
      inputApi.input.max = new Date().toISOString().slice(0, 10);
      inputApi.input.placeholder = '';

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, inputApi);
    } else if (fieldConfig.name === 'sport_discipline') {
      const sportFieldApi = createSportTypesField(fieldContainer, {
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        required: fieldConfig.required,
        options: sportTypeOptions,
        onChange: value => validateField(fieldConfig.name, value)
      });

      const helpText = document.createElement('small');
      helpText.textContent = sportTypeOptions.length > 0
        ? 'Можно выбрать несколько дисциплин'
        : 'Не удалось загрузить список дисциплин';
      helpText.style.cssText = `
        font-size: var(--font-size-xs);
        color: var(--text-placeholder);
        margin-top: 2px;
        display: block;
      `;
      fieldContainer.appendChild(helpText);

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, sportFieldApi);
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
    const selectedSportTypes = Array.isArray(data.sport_discipline) ? data.sport_discipline : [];
    data.trainer_details = {
      education_degree: data.education_degree || '',
      career_since_date: data.career_since_date,
      sports: selectedSportTypes.map(sportTypeId => ({
        sport_type_id: Number(sportTypeId),
        experience_years: 0
      }))
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
      const fieldName = error.field === 'sports' || error.field?.startsWith('sports[')
        ? 'sport_discipline'
        : error.field;
      const api = inputsApi.get(fieldName);
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
