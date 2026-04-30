/**
 * @fileoverview Базовый компонент поля ввода
 * Поддерживает все состояния из UI Kit:
 * - Типы: mail, password, name, without
 * - Состояния: normal, active, error, warning, correct, disabled
 * - Глазок: open/close, active/non-active
 * - Сообщения под полем
 * - Обработка длинного текста
 *
 * @module components/atoms/Input
 */

export const INPUT_TYPES = {
  MAIL: 'mail',
  PASSWORD: 'password',
  NAME: 'name',
  WITHOUTS: 'without'
} as const;

export const INPUT_STATES = {
  NORMAL: 'normal',
  ACTIVE: 'active',
  ERROR: 'error',
  WARNING: 'warning',
  CORRECT: 'correct',
  DISABLED: 'disabled'
} as const;

export const EYE_STATES = {
  ACTIVE: 'active',
  NON_ACTIVE: 'non-active'
} as const;

export type InputType = typeof INPUT_TYPES[keyof typeof INPUT_TYPES];
export type InputState = typeof INPUT_STATES[keyof typeof INPUT_STATES];
export type EyeState = typeof EYE_STATES[keyof typeof EYE_STATES];

export interface InputConfig {
  type?: InputType;
  state?: InputState;
  label?: string;
  placeholder?: string;
  value?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  message?: string;
  showEye?: boolean;
  eyeState?: EyeState;
  icon?: string | null;
  maxlength?: number | null;
  autocomplete?: string | null;
  onChange?: ((value: string) => void) | null;
  onFocus?: ((e: FocusEvent) => void) | null;
  onBlur?: ((e: FocusEvent) => void) | null;
  onEyeClick?: ((isVisible: boolean) => void) | null;
}

export interface InputAPI {
  element: HTMLElement;
  input: HTMLInputElement;
  setState: (newState: InputState) => void;
  setMessage: (text: string | null, newState?: InputState | null) => void;
  setValue: (newValue: string) => void;
  getValue: () => string;
  setEyeState: (newEyeState: EyeState) => void;
  togglePasswordVisibility: () => void;
  focus: () => void;
  blur: () => void;
  setError: (msg: string) => void;
  setWarning: (msg: string) => void;
  setCorrect: (msg: string) => void;
  setNormal: () => void;
  clearError: () => void;
}

/**
 * Рендерит поле ввода
 */
export async function renderInput(
  container: HTMLElement,
  config: InputConfig = {}
): Promise<InputAPI> {
  const {
    type = INPUT_TYPES.WITHOUTS,
    state = INPUT_STATES.NORMAL,
    label,
    placeholder = '',
    value = '',
    name = '',
    id = 'input-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11),
    disabled = false,
    readonly = false,
    required = false,
    message = '',
    showEye = type === INPUT_TYPES.PASSWORD,
    eyeState = EYE_STATES.NON_ACTIVE,
    icon = null,
    maxlength = null,
    autocomplete = null,
    onChange = null,
    onFocus = null,
    onBlur = null,
    onEyeClick = null
  } = config;

  const template = (window as any).Handlebars.templates['Input.hbs'];

  let inputType = 'text';
  if (type === INPUT_TYPES.PASSWORD) {
    inputType = 'password';
  }

  const isPasswordVisible = (type === INPUT_TYPES.PASSWORD && eyeState === EYE_STATES.ACTIVE);

  const html = template({
    type,
    state: disabled ? INPUT_STATES.DISABLED : state,
    label,
    placeholder,
    value,
    name,
    id,
    disabled,
    readonly,
    required,
    message,
    showEye,
    eyeState,
    icon,
    maxlength,
    autocomplete,
    inputType: isPasswordVisible ? 'text' : inputType,
    isPasswordVisible
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const field = wrapper.firstElementChild as HTMLElement;
  const input = field.querySelector('input') as HTMLInputElement;
  const eyeButton = field.querySelector('.input-field__eye') as HTMLElement | null;
  let messageEl = field.querySelector('.input-field__message') as HTMLElement | null;

  if (!messageEl) {
    messageEl = document.createElement('span');
    messageEl.className = 'input-field__message';
    field.appendChild(messageEl);
  }

  /**
   * Установить состояние поля
   */
  const setState = (newState: InputState): void => {
    field.classList.remove(
      `input-field--${INPUT_STATES.NORMAL}`,
      `input-field--${INPUT_STATES.ACTIVE}`,
      `input-field--${INPUT_STATES.ERROR}`,
      `input-field--${INPUT_STATES.WARNING}`,
      `input-field--${INPUT_STATES.CORRECT}`,
      `input-field--${INPUT_STATES.DISABLED}`
    );
    field.classList.add(`input-field--${newState}`);

    if (newState === INPUT_STATES.DISABLED) {
      input.disabled = true;
    } else {
      input.disabled = false;
    }
  };

  /**
   * Установить сообщение под полем
   */
  const setMessage = (text: string | null, newState: InputState | null = null): void => {
    if (!messageEl) {
      messageEl = document.createElement('span');
      messageEl.className = 'input-field__message';
      field.appendChild(messageEl);
    }

    messageEl.textContent = text || '';
    messageEl.style.display = 'block';
    messageEl.style.visibility = 'visible';

    if (newState) {
      setState(newState);
    } else {
      if (!text) {
        setState(INPUT_STATES.NORMAL);
      }
    }
  };

  /**
   * Установить значение поля
   */
  const setValue = (newValue: string): void => {
    input.value = newValue;
    onChange?.(newValue);
  };

  /**
   * Получить значение поля
   */
  const getValue = (): string => input.value;

  /**
   * Установить состояние глазка
   */
  const setEyeState = (newEyeState: EyeState): void => {
    if (!eyeButton) return;

    eyeButton.classList.remove('input-field__eye--active', 'input-field__eye--non-active');
    eyeButton.classList.add(`input-field__eye--${newEyeState}`);

    const isVisible = newEyeState === EYE_STATES.ACTIVE;
    eyeButton.setAttribute('aria-label', isVisible ? 'Скрыть пароль' : 'Показать пароль');

    if (type === INPUT_TYPES.PASSWORD) {
      input.type = isVisible ? 'text' : 'password';
    }

    if (isVisible) {
      eyeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" stroke-width="2"/>
      </svg>`;
    } else {
      eyeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke-width="2"/>
        <line x1="1" y1="1" x2="23" y2="23" stroke-width="2"/>
      </svg>`;
    }
  };

  /**
   * Переключить видимость пароля
   */
  const togglePasswordVisibility = (): void => {
    if (!eyeButton || type !== INPUT_TYPES.PASSWORD) return;

    const currentState = eyeButton.classList.contains('input-field__eye--active')
      ? EYE_STATES.ACTIVE
      : EYE_STATES.NON_ACTIVE;
    const newState = currentState === EYE_STATES.ACTIVE
      ? EYE_STATES.NON_ACTIVE
      : EYE_STATES.ACTIVE;

    setEyeState(newState);
    onEyeClick?.(newState === EYE_STATES.ACTIVE);
  };

  /**
   * Установить фокус на поле
   */
  const focus = (): void => {
    input.focus();
  };

  /**
   * Убрать фокус с поля
   */
  const blur = (): void => {
    input.blur();
  };

  /**
   * Обработчик ввода
   */
  input.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    onChange?.(target.value);
  });

  /**
   * Обработчик получения фокуса
   */
  input.addEventListener('focus', (e: FocusEvent) => {
    if (!disabled && state !== INPUT_STATES.DISABLED) {
      field.classList.add('input-field--active');
      onFocus?.(e);
    }
  });

  /**
   * Обработчик потери фокуса
   */
  input.addEventListener('blur', (e: FocusEvent) => {
    field.classList.remove('input-field--active');
    onBlur?.(e);
  });

  if (eyeButton) {
    /**
     * Обработчик клика по глазку
     */
    eyeButton.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      togglePasswordVisibility();
    });
  }

  container.appendChild(field);

  return {
    element: field,
    input,
    setState,
    setMessage,
    setValue,
    getValue,
    setEyeState,
    togglePasswordVisibility,
    focus,
    blur,
    setError: (msg: string) => setMessage(msg, INPUT_STATES.ERROR),
    setWarning: (msg: string) => setMessage(msg, INPUT_STATES.WARNING),
    setCorrect: (msg: string) => setMessage(msg, INPUT_STATES.CORRECT),
    setNormal: () => setMessage('', INPUT_STATES.NORMAL),
    clearError: () => setMessage('', INPUT_STATES.NORMAL)
  };
}
