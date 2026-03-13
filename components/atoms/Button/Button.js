/**
 * БАЗОВЫЙ КОМПОНЕНТ КНОПКИ
 * Умеет:
 * - Рендерить себя в любой контейнер
 * - Управлять состояниями (normal, hover, active, disabled)
 * - Принимать конфиг через пропсы
 * - Обрабатывать клики и наведения
 */

export const BUTTON_VARIANTS = {
  PRIMARY_ORANGE: 'primary-orange',
  SECONDARY_BLUE: 'secondary-blue',
  TEXT_ORANGE: 'text-orange',
  TEXT_BLUE: 'text-blue'
};

export const BUTTON_STATES = {
  NORMAL: 'normal',
  HOVER: 'hover',
  ACTIVE: 'active',
  DISABLED: 'disabled'
};

export const BUTTON_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
};

/**
 * Рендерит кнопку
 * @param {HTMLElement} container - Контейнер для вставки
 * @param {Object} config - Конфигурация кнопки
 * @param {string} config.text - Текст кнопки
 * @param {string} config.variant - primary-orange | secondary-blue | text-orange | text-blue
 * @param {string} config.state - normal | hover | active | disabled
 * @param {string} config.size - small | medium | large
 * @param {string} config.type - button | submit | reset
 * @param {boolean} config.fullWidth - Растягивать ли на всю ширину
 * @param {boolean} config.disabled - Отключена ли кнопка
 * @param {string} config.icon - HTML иконки
 * @param {string} config.ariaLabel - Для доступности
 * @param {Function} config.onClick - Обработчик клика
 * @param {Function} config.onHover - Обработчик наведения
 * @param {Function} config.onLeave - Обработчик ухода мыши
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

  // ===== API ДЛЯ УПРАВЛЕНИЯ =====
    
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

  const setDisabled = isDisabled => {
    if (isDisabled) {
      button.disabled = true;
      setState(BUTTON_STATES.DISABLED);
    } else {
      button.disabled = false;
      setState(BUTTON_STATES.NORMAL);
    }
  };

  const getState = () => {
    if (button.disabled) return BUTTON_STATES.DISABLED;
    if (button.classList.contains(`button--${BUTTON_STATES.HOVER}`)) return BUTTON_STATES.HOVER;
    if (button.classList.contains(`button--${BUTTON_STATES.ACTIVE}`)) return BUTTON_STATES.ACTIVE;
    return BUTTON_STATES.NORMAL;
  };

  const setText = newText => {
    const textSpan = button.querySelector('.button__text');
    if (textSpan) {
      textSpan.textContent = newText;
    }
  };

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
  if (!disabled) {
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.HOVER);
        onHover?.();
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.NORMAL);
        onLeave?.();
      }
    });

    button.addEventListener('mousedown', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.ACTIVE);
      }
    });

    button.addEventListener('mouseup', () => {
      if (!button.disabled) {
        setState(BUTTON_STATES.HOVER);
      }
    });

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
