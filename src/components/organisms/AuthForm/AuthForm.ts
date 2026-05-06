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

import type { ApiClient } from '../../../utils/api';
import { translateErrorMessage } from '../../../utils/api';
import type { InputAPI, InputType } from '../../atoms/Input/Input';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { SportTypeFieldApi, SportTypeFieldOption } from '../../../types/components.types';
import type { ValidationResult } from '../../../types/validation.types';
import { Validator } from '../../../utils/validator';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';

export const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER_CLIENT: 'register-client',
  REGISTER_TRAINER: 'register-trainer'
} as const;

export type AuthMode = typeof AUTH_MODES[keyof typeof AUTH_MODES];

interface FieldConfig {
  type: InputType;
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  showEye?: boolean;
}

interface ModeConfig {
  title: string;
  subtitle: string;
  submitText: string;
  altText: string;
  altLinkText: string;
  fields: FieldConfig[];
}

interface AuthFormConfig {
  mode?: AuthMode;
  onSubmit?: ((data: Record<string, unknown>, mode: string) => Promise<void>) | null;
  onSwitchMode?: ((mode: string) => void) | null;
  api?: ApiClient;
}

export interface AuthFormAPI {
  element: HTMLFormElement;
  getData: () => Record<string, unknown>;
  validate: () => boolean;
  reset: () => void;
  setErrors: (errors: Array<{ field: string; message: string }>) => void;
  setGlobalError: (message: string) => void;
  clearGlobalError: () => void;
  inputs: Map<string, InputAPI | SportTypeFieldApi>;
}

let sportTypesPromise: Promise<SportTypeFieldOption[]> | null = null;

export async function loadSportTypes(api: ApiClient): Promise<SportTypeFieldOption[]> {
  if (!api?.getSportTypes) {
    return [];
  }

  if (!sportTypesPromise) {
    sportTypesPromise = api.getSportTypes()
      .then(response => Array.isArray(response?.sport_types) ? response.sport_types : [])
      .catch(() => {
        sportTypesPromise = null;
        return [];
      });
  }

  return sportTypesPromise;
}

export function createSportTypesField(
  container: HTMLElement,
  config: {
    label: string;
    placeholder: string;
    required: boolean;
    options: SportTypeFieldOption[];
    onChange?: (values: number[]) => void;
  }
): SportTypeFieldApi {
  const { label, placeholder, required, options, onChange } = config;

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

  const trigger = wrapper.querySelector('.sport-types-field__trigger') as HTMLElement;
  const triggerText = wrapper.querySelector('.sport-types-field__trigger-text') as HTMLElement;
  const dropdown = wrapper.querySelector('.sport-types-field__dropdown') as HTMLElement;
  const message = wrapper.querySelector('.sport-types-field__message') as HTMLElement;
  const selectedIds = new Set<string>();

  const updateTriggerText = (): void => {
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

  const openDropdown = (): void => {
    dropdown.hidden = false;
    wrapper.classList.add('sport-types-field--open');
    trigger.setAttribute('aria-expanded', 'true');
  };

  const closeDropdown = (): void => {
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

    const checkbox = item.querySelector('input') as HTMLInputElement;
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

  document.addEventListener('click', (event: MouseEvent) => {
    if (!wrapper.contains(event.target as Node)) {
      closeDropdown();
    }
  });

  container.appendChild(wrapper);
  updateTriggerText();

  return {
    element: wrapper,
    input: trigger,
    setValue: (values: number[]): void => {
      selectedIds.clear();
      const normalizedValues = Array.isArray(values) ? values.map(value => String(value)) : [];
      dropdown.querySelectorAll('.sport-types-field__checkbox').forEach(checkbox => {
        const htmlCheckbox = checkbox as HTMLInputElement;
        htmlCheckbox.checked = normalizedValues.includes(htmlCheckbox.value);
        if (htmlCheckbox.checked) {
          selectedIds.add(htmlCheckbox.value);
        }
      });
      updateTriggerText();
      onChange?.(Array.from(selectedIds).map(Number));
    },
    getValue: (): number[] => Array.from(selectedIds).map(Number),
    focus: (): void => trigger.focus(),
    blur: (): void => trigger.blur(),
    setError: (text: string): void => {
      wrapper.classList.remove('sport-types-field--normal');
      wrapper.classList.add('sport-types-field--error');
      message.textContent = text || '';
    },
    setNormal: (): void => {
      wrapper.classList.remove('sport-types-field--error');
      wrapper.classList.add('sport-types-field--normal');
      message.textContent = '';
    },
    clearError: (): void => {
      wrapper.classList.remove('sport-types-field--error');
      wrapper.classList.add('sport-types-field--normal');
      message.textContent = '';
    }
  };
}

export async function renderAuthForm(
  container: HTMLElement,
  config: AuthFormConfig = {}
): Promise<AuthFormAPI> {
  const { mode = AUTH_MODES.LOGIN, onSubmit = null, onSwitchMode = null, api } = config;

  const validator = new Validator();
  const template = (window as any).Handlebars.templates['AuthForm.hbs'];

  const modeConfig: Record<string, ModeConfig> = {
    [AUTH_MODES.LOGIN]: {
      title: 'Вход в Sporteon',
      subtitle: 'Войдите, чтобы быть в тонусе',
      submitText: 'Войти',
      altText: 'Нет аккаунта?',
      altLinkText: 'Зарегистрироваться',
      fields: [
        {
          type: INPUT_TYPES.MAIL as InputType,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD as InputType,
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
          type: INPUT_TYPES.NAME as InputType,
          name: 'first_name',
          label: 'Имя',
          placeholder: 'Введите имя',
          required: true
        },
        {
          type: INPUT_TYPES.NAME as InputType,
          name: 'last_name',
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS as InputType,
          name: 'username',
          label: 'Имя пользователя',
          placeholder: 'john_doe',
          required: true
        },
        {
          type: INPUT_TYPES.MAIL as InputType,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD as InputType,
          name: 'password',
          label: 'Пароль',
          placeholder: 'Минимум 8 символов',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.PASSWORD as InputType,
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
          type: INPUT_TYPES.WITHOUTS as InputType,
          name: 'username',
          label: 'Никнейм (отображаемое имя)',
          placeholder: 'john_doe',
          required: true
        },
        {
          type: INPUT_TYPES.NAME as InputType,
          name: 'first_name',
          label: 'Имя',
          placeholder: 'Введите имя',
          required: true
        },
        {
          type: INPUT_TYPES.NAME as InputType,
          name: 'last_name',
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
          required: true
        },
        {
          type: INPUT_TYPES.MAIL as InputType,
          name: 'email',
          label: 'Почта',
          placeholder: 'email@example.com',
          required: true
        },
        {
          type: INPUT_TYPES.PASSWORD as InputType,
          name: 'password',
          label: 'Пароль',
          placeholder: 'Минимум 8 символов',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.PASSWORD as InputType,
          name: 'password_repeat',
          label: 'Подтверждение пароля',
          placeholder: 'Повторите пароль',
          required: true,
          showEye: true
        },
        {
          type: INPUT_TYPES.WITHOUTS as InputType,
          name: 'education_degree',
          label: 'Образование',
          placeholder: 'Введите образование',
          required: false
        },
        // ← career_since_date теперь опционально
        {
          type: INPUT_TYPES.WITHOUTS as InputType,
          name: 'career_since_date',
          label: 'Дата начала профессиональной деятельности',
          placeholder: 'Выберите дату',
          required: false   // было true
        },
        {
          type: INPUT_TYPES.WITHOUTS as InputType,
          name: 'sport_discipline',
          label: 'Вид дисциплины/спорта',
          placeholder: 'Выберите виды спорта',
          required: true
        },
        {
          type: INPUT_TYPES.WITHOUTS as InputType,
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
  const form = wrapper.firstElementChild as HTMLFormElement;
  form.setAttribute('novalidate', '');

  const fieldsContainer = form.querySelector('.auth-form__fields') as HTMLElement;
  const submitContainer = form.querySelector('.auth-form__submit-container') as HTMLElement;

  const inputs = new Map<string, HTMLElement>();
  const inputsApi = new Map<string, InputAPI | SportTypeFieldApi>();

  const validateField = (fieldName: string, value: string | number[]): boolean => {
    const api = inputsApi.get(fieldName);
    if (!api) return true;

    let result: ValidationResult;

    switch (fieldName) {
    case 'email':
      result = validator.validateEmail(value as string);
      break;
    case 'password':
      result = validator.validatePassword(value as string);
      break;
    case 'username':
      result = validator.validateUsername(value as string);
      break;
    case 'first_name':
      result = validator.validateFirstName(value as string);
      break;
    case 'last_name':
      result = validator.validateLastName(value as string);
      break;
    case 'password_repeat': {
      const password = (inputsApi.get('password') as InputAPI)?.getValue() || '';
      result = validator.validatePasswordWithConfirmation(password, value as string);
      break;
    }
    case 'education_degree': {
      validator.reset();
      const validationResult: ValidationResult = {
        isValid: true,
        errors: []
      };
      if (typeof value === 'string' && value.trim() !== '') {
        validator.validateField(value, 'education_degree', validator.rules.education_degree);
        if (validator.hasErrors()) {
          validationResult.isValid = false;
          validationResult.errors = validator.getErrors();
        }
      }
      result = validationResult;
      break;
    }
    case 'career_since_date': {
      const dateStr = (value as string).trim();
      if (!dateStr) {
        // теперь поле опционально
        result = { isValid: true, errors: [] };
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        result = {
          isValid: false,
          errors: [{ field: 'career_since_date', message: 'Дата должна быть в формате ГГГГ-ММ-ДД' }]
        };
      } else if (Validator.isFutureDate(dateStr)) {
        result = {
          isValid: false,
          errors: [{ field: 'career_since_date', message: 'Дата не может быть в будущем' }]
        };
      } else {
        result = { isValid: true, errors: [] };
      }
      break;
    }
    case 'sport_discipline':
      result = Array.isArray(value) && value.length > 0
        ? { isValid: true, errors: [] }
        : {
          isValid: false,
          errors: [{ field: 'sport_discipline', message: 'Выберите хотя бы один вид спорта' }]
        };
      break;
    case 'bio': {
      const bioValid = !value || (typeof value === 'string' && value.length <= 1000);
      result = {
        isValid: bioValid,
        errors: bioValid ? [] : [{ field: 'bio', message: 'Максимум 1000 символов' }]
      };
      break;
    }
    default:
      return true;
    }

    if (!result.isValid && result.errors.length > 0) {
      if ('setError' in api) {
        (api as InputAPI).setError(result.errors[0].message);
      }
      return false;
    } else {
      if ('setNormal' in api) {
        (api as InputAPI).setNormal();
      }
      return true;
    }
  };

  const sportTypeOptions: SportTypeFieldOption[] = mode === AUTH_MODES.REGISTER_TRAINER && api
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
        onChange: (value: string) => validateField(fieldConfig.name, value)
      });

      inputApi.input.type = 'date';
      inputApi.input.max = new Date().toISOString().slice(0, 10);
      inputApi.input.placeholder = '';

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, inputApi);
    } else if (fieldConfig.name === 'sport_discipline') {
      const sportFieldApi: SportTypeFieldApi = createSportTypesField(fieldContainer, {
        label: fieldConfig.label,
        placeholder: fieldConfig.placeholder,
        required: fieldConfig.required,
        options: sportTypeOptions,
        onChange: (value: number[]) => validateField(fieldConfig.name, value)
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
        onChange: (value: string) => validateField(fieldConfig.name, value)
      });

      inputs.set(fieldConfig.name, fieldContainer);
      inputsApi.set(fieldConfig.name, inputApi);
    }
  }

  const submitBtn: ButtonAPI = await renderButton(submitContainer, {
    text: currentMode.submitText,
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    fullWidth: true
  });

  const validateForm = (): boolean => {
    let isValid = true;

    for (const [name, api] of inputsApi) {
      const value = api.getValue();
      if (!validateField(name, value)) {
        isValid = false;
      }
    }

    if (mode !== AUTH_MODES.LOGIN) {
      const password = (inputsApi.get('password') as InputAPI)?.getValue();
      const passwordRepeat = (inputsApi.get('password_repeat') as InputAPI)?.getValue();

      if (password && passwordRepeat && password !== passwordRepeat) {
        const repeatApi = inputsApi.get('password_repeat');
        if (repeatApi && 'setError' in repeatApi) {
          (repeatApi as InputAPI).setError('Пароли не совпадают');
        }
        isValid = false;
      }
    }

    return isValid;
  };

  const getFormData = (): Record<string, unknown> => {
    const data: Record<string, unknown> = {};
    for (const [name, api] of inputsApi) {
      data[name] = api.getValue();
    }

    if (mode === AUTH_MODES.REGISTER_TRAINER) {
      const selectedSportTypes = Array.isArray(data.sport_discipline) ? data.sport_discipline as number[] : [];
      const careerDate = (data.career_since_date as string || '').trim();
      const trainerDetails: Record<string, unknown> = {
        education_degree: (data.education_degree as string).trim(),
        ...(careerDate ? { career_since_date: careerDate } : {}),
        sports: selectedSportTypes.map(sportTypeId => ({
          sport_type_id: Number(sportTypeId),
          experience_years: 0
        }))
      };
      data.trainer_details = trainerDetails;
      // Триммируем основные поля
      data.username = (data.username as string).trim();
      data.first_name = (data.first_name as string).trim();
      data.last_name = (data.last_name as string).trim();
      data.bio = (data.bio as string).trim();
      data.email = (data.email as string).trim().toLowerCase();
    } else {
      // Для логина и регистрации клиента
      if (data.email) data.email = (data.email as string).trim().toLowerCase();
      if (data.username) data.username = (data.username as string).trim();
      if (data.first_name) data.first_name = (data.first_name as string).trim();
      if (data.last_name) data.last_name = (data.last_name as string).trim();
      if (data.bio) data.bio = (data.bio as string).trim();
    }

    return data;
  };

  const setApiErrors = (errors: Array<{ field: string; message: string }>): void => {
    if (!errors || !Array.isArray(errors)) return;

    errors.forEach(error => {
      const fieldName = error.field === 'sports' || error.field?.startsWith('sports[')
        ? 'sport_discipline'
        : error.field;
      const api = inputsApi.get(fieldName);
      if (api && 'setError' in api) {
        const translatedMessage = translateErrorMessage(error.message);
        (api as InputAPI).setError(translatedMessage);
      }
    });
  };

  const resetForm = (): void => {
    for (const api of inputsApi.values()) {
      const currentValue = api.getValue();
      if (Array.isArray(currentValue)) {
        (api as SportTypeFieldApi).setValue([]);
      } else {
        (api as InputAPI).setValue('');
      }
      if ('setNormal' in api) {
        (api as InputAPI).setNormal();
      }
    }
  };

  const setGlobalError = (message: string): void => {
    let globalError = form.querySelector('.auth-form__global-error') as HTMLElement | null;
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
      fieldsContainer.parentNode?.insertBefore(globalError, fieldsContainer);
    }
    globalError.textContent = translateErrorMessage(message);
  };

  const clearGlobalError = (): void => {
    const globalError = form.querySelector('.auth-form__global-error');
    if (globalError) {
      globalError.remove();
    }
  };

  submitBtn.element.addEventListener('click', async (e: MouseEvent) => {
    e.preventDefault();
    clearGlobalError();

    if (!validateForm()) {
      return;
    }

    const formData = getFormData();

    if (onSubmit) {
      try {
        await onSubmit(formData, mode);
      } catch (error: unknown) {
        const err = error as { message?: string; data?: { error?: { fields?: Array<{ field: string; message: string }> } } };
        if (err.data?.error?.fields) {
          setApiErrors(err.data.error.fields);
        } else {
          setGlobalError(err.message || 'Произошла ошибка');
        }
      }
    }
  });

  const altLink = form.querySelector('.auth-form__link--alt') as HTMLElement | null;
  if (altLink && onSwitchMode) {
    altLink.addEventListener('click', (e: MouseEvent) => {
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
