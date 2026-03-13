/**
 * БАЗОВЫЙ КОМПОНЕНТ ПОЛЯ ВВОДА
 * Умеет:
 * - Рендерить себя в любой контейнер
 * - Управлять состояниями (normal, active, error, warning, correct, disabled)
 * - Управлять глазком (open/close)
 * - Показывать сообщения под полем
 * - Принимать конфиг через пропсы
 * - Обрабатывать изменения
 */

export const INPUT_TYPES = {
  MAIL: 'mail',
  PASSWORD: 'password',
  NAME: 'name',
  WITHOUTS: 'without'
};

export const INPUT_STATES = {
  NORMAL: 'normal',
  ACTIVE: 'active',
  ERROR: 'error',
  WARNING: 'warning',
  CORRECT: 'correct',
  DISABLED: 'disabled'
};

export const EYE_STATES = {
  ACTIVE: 'active',
  NON_ACTIVE: 'non-active'
};

/**
 * Рендерит поле ввода
 * @param {HTMLElement} container - Контейнер для вставки
 * @param {Object} config - Конфигурация поля
 * @param {string} config.type - mail | password | name | without
 * @param {string} config.state - normal | active | error | warning | correct |
 *     disabled
 * @param {string} config.label - Подпись над полем
 * @param {string} config.placeholder - Подсказка
 * @param {string} config.value - Значение
 * @param {string} config.id - Уникальный ID
 * @param {boolean} config.disabled - Отключено
 * @param {boolean} config.readonly - Только чтение
 * @param {boolean} config.required - Обязательное
 * @param {string} config.message - Сообщение под полем
 * @param {boolean} config.showEye - Показывать глазок
 * @param {string} config.eyeState - active | non-active (начальное состояние)
 * @param {string} config.icon - HTML иконки слева
 * @param {number} config.maxlength - Макс. длина
 * @param {string} config.autocomplete - autocomplete атрибут
 * @param {Function} config.onChange - Обработчик изменения
 * @param {Function} config.onFocus - Обработчик фокуса
 * @param {Function} config.onBlur - Обработчик потери фокуса
 * @param {Function} config.onEyeClick - Обработчик клика по глазку
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

  // ЗАМЕНИТЕ НА:
  let inputType = 'text';
  if (type === INPUT_TYPES.PASSWORD) {
    inputType = 'password';
  }
  // Для email используем text, чтобы отключить браузерную валидацию
  // Браузер не будет показывать свои сообщения
  // Если глазок активен и это пароль, показываем текст
  const isPasswordVisible =
      (type === INPUT_TYPES.PASSWORD && eyeState === EYE_STATES.ACTIVE);

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
  // Используем let вместо const
  let messageEl = field.querySelector('.input-field__message');

  if (!messageEl) {
    console.warn('Message element not found, creating dynamically');
    messageEl = document.createElement('span');
    messageEl.className = 'input-field__message';
    field.appendChild(messageEl);
  }

  // ===== API ДЛЯ УПРАВЛЕНИЯ =====

  /**
   * Установить состояние поля
   */
  const setState = newState => {
    // Удаляем все классы состояний
    field.classList.remove(
        `input-field--${INPUT_STATES.NORMAL}`,
        `input-field--${INPUT_STATES.ACTIVE}`,
        `input-field--${INPUT_STATES.ERROR}`,
        `input-field--${INPUT_STATES.WARNING}`,
        `input-field--${INPUT_STATES.CORRECT}`,
        `input-field--${INPUT_STATES.DISABLED}`);
    // Добавляем новое состояние
    field.classList.add(`input-field--${newState}`);

    // Обновляем disabled атрибут
    if (newState === INPUT_STATES.DISABLED) {
      input.disabled = true;
    } else {
      input.disabled = false;
    }
  };

  /**
   * Установить сообщение под полем
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
   */
  const setValue = newValue => {
    input.value = newValue;
    onChange?.(newValue);
  };

  /**
   * Получить значение поля
   */
  const getValue = () => input.value;

  /**
   * Установить состояние глазка
   */
  const setEyeState = newEyeState => {
    if (!eyeButton) return;

    // Обновляем класс глазка
    eyeButton.classList.remove(
      'input-field__eye--active', 'input-field__eye--non-active');
    eyeButton.classList.add(`input-field__eye--${newEyeState}`);

    // Обновляем aria-label
    const isVisible = newEyeState === EYE_STATES.ACTIVE;
    eyeButton.setAttribute(
      'aria-label', isVisible ? 'Скрыть пароль' : 'Показать пароль');

    // Меняем тип input для пароля
    if (type === INPUT_TYPES.PASSWORD) {
      input.type = isVisible ? 'text' : 'password';
    }

    // Обновляем HTML иконки (переключаем SVG)
    if (isVisible) {
      eyeButton.innerHTML =
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke-width="2"/>
            </svg>`;
    } else {
      eyeButton.innerHTML =
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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

    const currentState =
        eyeButton.classList.contains('input-field__eye--active') ?
          EYE_STATES.ACTIVE :
          EYE_STATES.NON_ACTIVE;
    const newState = currentState === EYE_STATES.ACTIVE ?
      EYE_STATES.NON_ACTIVE :
      EYE_STATES.ACTIVE;

    setEyeState(newState);

    // Вызываем колбэк если есть
    onEyeClick?.(newState === EYE_STATES.ACTIVE);
  };

  /**
   * Установить фокус на поле
   */
  const focus = () => {
    input.focus();
  };

  /**
   * Убрать фокус
   */
  const blur = () => {
    input.blur();
  };

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ =====

  input.addEventListener('input', e => {
    onChange?.(e.target.value);
  });

  input.addEventListener('focus', e => {
    if (!disabled && state !== INPUT_STATES.DISABLED) {
      field.classList.add('input-field--active');
      onFocus?.(e);
    }
  });

  input.addEventListener('blur', e => {
    field.classList.remove('input-field--active');
    onBlur?.(e);
  });

  // ВАЖНО: обработчик для глазка
  if (eyeButton) {
    eyeButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();  // Предотвращаем всплытие
      togglePasswordVisibility();
    });
  }

  container.appendChild(field);

  // Возвращаем API
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
    // Хелперы для конкретных состояний
    setError: msg => setMessage(msg, INPUT_STATES.ERROR),
    setWarning: msg => setMessage(msg, INPUT_STATES.WARNING),
    setCorrect: msg => setMessage(msg, INPUT_STATES.CORRECT),
    setNormal: () => {
      setMessage('', INPUT_STATES.NORMAL);  // Очищаем сообщение и ставим normal
    },
    // Новый метод для явной очистки ошибки
    clearError: () => {
      setMessage('', INPUT_STATES.NORMAL);
    }
  };
}
