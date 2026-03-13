/**
 * @fileoverview Базовый компонент кнопки
 * Поддерживает все состояния из UI Kit:
 * - Типы: primary-orange, secondary-blue, text-orange, text-blue
 * - Состояния: normal, hover, active, disabled
 * - Размеры: small (32px), medium (40px), large (48px)
 * - Модификатор: full-width
 * 
 * @module components/atoms/Button
 */

/**
 * @constant {Object} BUTTON_VARIANTS - Доступные варианты кнопок
 * @property {string} PRIMARY_ORANGE - Основная оранжевая кнопка
 * @property {string} SECONDARY_BLUE - Вторичная синяя кнопка
 * @property {string} TEXT_ORANGE - Текстовая оранжевая кнопка
 * @property {string} TEXT_BLUE - Текстовая синяя кнопка
 */
export const BUTTON_VARIANTS = {
  PRIMARY_ORANGE: 'primary-orange',
  SECONDARY_BLUE: 'secondary-blue',
  TEXT_ORANGE: 'text-orange',
  TEXT_BLUE: 'text-blue'
};

/**
 * @constant {Object} BUTTON_STATES - Состояния кнопки
 * @property {string} NORMAL - Обычное состояние
 * @property {string} HOVER - Состояние при наведении
 * @property {string} ACTIVE - Состояние при нажатии
 * @property {string} DISABLED - Отключенное состояние
 */
export const BUTTON_STATES = {
  NORMAL: 'normal',
  HOVER: 'hover',
  ACTIVE: 'active',
  DISABLED: 'disabled'
};

/**
 * @constant {Object} BUTTON_SIZES - Размеры кнопки
 * @property {string} SMALL - Маленькая кнопка (32px)
 * @property {string} MEDIUM - Средняя кнопка (40px)
 * @property {string} LARGE - Большая кнопка (48px)
 */
export const BUTTON_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
};

/**
 * Рендерит кнопку
 * @async
 * @param {HTMLElement} container - DOM элемент, в который будет вставлена кнопка
 * @param {Object} config - Конфигурация кнопки
 * @param {string} [config.text=''] - Текст кнопки
 * @param {string} [config.variant=BUTTON_VARIANTS.PRIMARY_ORANGE] - Вариант кнопки
 * @param {string} [config.state=BUTTON_STATES.NORMAL] - Начальное состояние
 * @param {string} [config.size=BUTTON_SIZES.MEDIUM] - Размер кнопки
 * @param {string} [config.type='button'] - HTML тип кнопки (button|submit|reset)
 * @param {boolean} [config.fullWidth=false] - Растягивать ли на всю ширину
 * @param {boolean} [config.disabled=false] - Отключена ли кнопка
 * @param {string} [config.icon=null] - HTML иконки (SVG)
 * @param {string} [config.ariaLabel=null] - ARIA метка для доступности
 * @param {Function} [config.onClick=null] - Обработчик клика
 * @param {Function} [config.onHover=null] - Обработчик наведения
 * @param {Function} [config.onLeave=null] - Обработчик ухода мыши
 * @returns {Promise<Object>} API для управления кнопкой
 */
export async function renderButton(container, config = {}) {
  const {
    text = '',
    variant = BUTTON_VARIANTS.PRIMARY_ORANGE,
    state = BUTTON_STATES.NORMAL,
    size = BUTTON_SIZES.MEDIUM,
    type = 'button',
    fullWidth = false,
    disabled = false,
    icon = null,
    ariaLabel = null,
    onClick = null,
    onHover = null,
    onLeave = null
  } = config;

  const template = Handlebars.templates['Button.hbs'];
    
  const html = template({ 
    text, 
    variant, 
    state: disabled ? BUTTON_STATES.DISABLED : state,
    size,
    type, 
    fullWidth, 
    disabled,
    icon,
    ariaLabel
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const button = wrapper.firstElementChild;

  /**
   * Установить состояние кнопки
   * @param {string} newState - Новое состояние из BUTTON_STATES
   */
  const setState = newState => {
    button.classList.remove(
      `button--${BUTTON_STATES.NORMAL}`,
      `button--${BUTTON_STATES.HOVER}`,
      `button--${BUTTON_STATES.ACTIVE}`,
      `button--${BUTTON_STATES.DISABLED}`
    );
    button.classList.add(`button--${newState}`);
        
    if (newState === BUTTON_STATES.DISABLED) {
      button.disabled = true;
    } else {
      button.disabled = false;
    }
  };

  /**
   * Включить или отключить кнопку
   * @param {boolean} isDisabled - true для отключения, false для включения
   */
  const setDisabled = isDisabled => {
    if (isDisabled) {
      button.disabled = true;
      setState(BUTTON_STATES.DISABLED);
    } else {
      button.disabled = false;
      setState(BUTTON_STATES.NORMAL);
    }
  };

  /**
   * Получить текущее состояние кнопки
   * @returns {string} Текущее состояние из BUTTON_STATES
   */
  const getState = () => {
    if (button.disabled) return BUTTON_STATES.DISABLED;
    if (button.classList.contains(`button--${BUTTON_STATES.HOVER}`)) return BUTTON_STATES.HOVER;
    if (button.classList.contains(`button--${BUTTON_STATES.ACTIVE}`)) return BUTTON_STATES.ACTIVE;
    return BUTTON_STATES.NORMAL;
  };

  /**
   * Изменить текст кнопки
   * @param {string} newText - Новый текст
   */
  const setText = newText => {
    const textSpan = button.querySelector('.button__text');
    if (textSpan) {
      textSpan.textContent = newText;
    }
  };

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
  if (!disabled) {
    /**
     * Обработчик наведения мыши
     * @param {MouseEvent} _event - Событие мыши (не используется)
     */
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.HOVER);
        onHover?.();
      }
    });

    /**
     * Обработчик ухода мыши
     * @param {MouseEvent} _event - Событие мыши (не используется)
     */
    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.NORMAL);
        onLeave?.();
      }
    });

    /**
     * Обработчик нажатия кнопки мыши
     * @param {MouseEvent} _event - Событие мыши (не используется)
     */
    button.addEventListener('mousedown', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.ACTIVE);
      }
    });

    /**
     * Обработчик отпускания кнопки мыши
     * @param {MouseEvent} _event - Событие мыши (не используется)
     */
    button.addEventListener('mouseup', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.HOVER);
      }
    });

    /**
     * Обработчик клика по кнопке
     * @param {MouseEvent} e - Событие клика
     */
    if (onClick) {
      button.addEventListener('click', e => {
        if (!button.disabled) {
          onClick(e);
        }
      });
    }
  }

  container.appendChild(button);

  return {
    element: button,
    setState,
    setDisabled,
    getState,
    setText
  };
}
