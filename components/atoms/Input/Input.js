/**
 * @fileoverview Базовый компонент поля ввода
 * Поддерживает все состояния из UI Kit:
 * - Типы: mail, password, name, withouts
 * - Состояния: normal, active, error, warning, correct, disabled
 * - Глазок: open/close, active/non-active
 * - Сообщения под полем
 * - Обработка длинного текста
 * 
 * @module components/atoms/Input
 */

/**
 * @constant {Object} INPUT_TYPES - Доступные типы полей ввода
 * @property {string} MAIL - Поле для email
 * @property {string} PASSWORD - Поле для пароля (с глазком)
 * @property {string} NAME - Поле для имени
 * @property {string} WITHOUTS - Обычное текстовое поле
 */
export const INPUT_TYPES = {
  MAIL: 'mail',
  PASSWORD: 'password',
  NAME: 'name',
  WITHOUTS: 'without'
};

/**
 * @constant {Object} INPUT_STATES - Состояния поля ввода
 * @property {string} NORMAL - Обычное состояние
 * @property {string} ACTIVE - В фокусе
 * @property {string} ERROR - Ошибка
 * @property {string} WARNING - Предупреждение
 * @property {string} CORRECT - Правильно заполнено
 * @property {string} DISABLED - Отключено
 */
export const INPUT_STATES = {
  NORMAL: 'normal',
  ACTIVE: 'active',
  ERROR: 'error',
  WARNING: 'warning',
  CORRECT: 'correct',
  DISABLED: 'disabled'
};

/**
 * @constant {Object} EYE_STATES - Состояния глазка для пароля
 * @property {string} ACTIVE - Глазок открыт (пароль виден)
 * @property {string} NON_ACTIVE - Глазок закрыт (пароль скрыт)
 */
export const EYE_STATES = {
  ACTIVE: 'active',
  NON_ACTIVE: 'non-active'
};

/**
 * Рендерит поле ввода
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} config - Конфигурация поля
 * @param {string} [config.type=INPUT_TYPES.WITHOUTS] - Тип поля
 * @param {string} [config.state=INPUT_STATES.NORMAL] - Состояние поля
 * @param {string} [config.label] - Подпись над полем
 * @param {string} [config.placeholder=''] - Подсказка внутри поля
 * @param {string} [config.value=''] - Значение по умолчанию
 * @param {string} [config.id] - Уникальный ID (автогенерация если не указан)
 * @param {boolean} [config.disabled=false] - Отключено ли поле
 * @param {boolean} [config.readonly=false] - Только для чтения
 * @param {boolean} [config.required=false] - Обязательное поле
 * @param {string} [config.message=''] - Сообщение под полем
 * @param {boolean} [config.showEye] - Показывать глазок (авто для password)
 * @param {string} [config.eyeState=EYE_STATES.NON_ACTIVE] - Состояние глазка
 * @param {string} [config.icon=null] - HTML иконки слева
 * @param {number} [config.maxlength=null] - Максимальная длина
 * @param {string} [config.autocomplete=null] - autocomplete атрибут
 * @param {Function} [config.onChange=null] - Обработчик изменения
 * @param {Function} [config.onFocus=null] - Обработчик фокуса
 * @param {Function} [config.onBlur=null] - Обработчик потери фокуса
 * @param {Function} [config.onEyeClick=null] - Обработчик клика по глазку
 * @returns {Promise<Object>} API для управления полем
 */
export async function renderInput(container, config = {}) {
  const {
    type = INPUT_TYPES.WITHOUTS,
    state = INPUT_STATES.NORMAL,
    label,
    placeholder = '',
    value = '',
    id = 'input-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
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

  const template = Handlebars.templates['Input.hbs'];

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
  const field = wrapper.firstElementChild;
  const input = field.querySelector('input');
  const eyeButton = field.querySelector('.input-field__eye');
  let messageEl = field.querySelector('.input-field__message');

  if (!messageEl) {
    console.warn('Message element not found, creating dynamically');
    messageEl = document.createElement('span');
    messageEl.className = 'input-field__message';
    field.appendChild(messageEl);
  }

  /**
   * Установить состояние поля
   * @param {string} newState - Новое состояние из INPUT_STATES
   */
  const setState = newState => {
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
   * @param {string} text - Текст сообщения
   * @param {string|null} newState - Новое состояние (опционально)
   */
  const setMessage = (text, newState = null) => {
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
   * @param {string} newValue - Новое значение
   */
  const setValue = newValue => {
    input.value = newValue;
    onChange?.(newValue);
  };

  /**
   * Получить значение поля
   * @returns {string} Текущее значение
   */
  const getValue = () => input.value;

  /**
   * Установить состояние глазка
   * @param {string} newEyeState - Новое состояние из EYE_STATES
   */
  const setEyeState = newEyeState => {
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
  const togglePasswordVisibility = () => {
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
  const focus = () => {
    input.focus();
  };

  /**
   * Убрать фокус с поля
   */
  const blur = () => {
    input.blur();
  };

  /**
   * Обработчик ввода
   * @param {InputEvent} e - Событие ввода
   */
  input.addEventListener('input', e => {
    onChange?.(e.target.value);
  });

  /**
   * Обработчик получения фокуса
   * @param {FocusEvent} e - Событие фокуса
   */
  input.addEventListener('focus', e => {
    if (!disabled && state !== INPUT_STATES.DISABLED) {
      field.classList.add('input-field--active');
      onFocus?.(e);
    }
  });

  /**
   * Обработчик потери фокуса
   * @param {FocusEvent} e - Событие потери фокуса
   */
  input.addEventListener('blur', e => {
    field.classList.remove('input-field--active');
    onBlur?.(e);
  });

  if (eyeButton) {
    /**
     * Обработчик клика по глазку
     * @param {MouseEvent} e - Событие клика
     */
    eyeButton.addEventListener('click', e => {
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
    /** Установить состояние ошибки с сообщением */
    setError: msg => setMessage(msg, INPUT_STATES.ERROR),
    /** Установить состояние предупреждения с сообщением */
    setWarning: msg => setMessage(msg, INPUT_STATES.WARNING),
    /** Установить состояние корректности с сообщением */
    setCorrect: msg => setMessage(msg, INPUT_STATES.CORRECT),
    /** Сбросить состояние в обычное */
    setNormal: () => setMessage('', INPUT_STATES.NORMAL),
    /** Очистить ошибку */
    clearError: () => setMessage('', INPUT_STATES.NORMAL)
  };
}
