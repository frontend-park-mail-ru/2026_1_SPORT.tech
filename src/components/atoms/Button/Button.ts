import ButtonTemplate from './Button.hbs';

export const BUTTON_VARIANTS = {
  PRIMARY_ORANGE: 'primary-orange',
  SECONDARY_BLUE: 'secondary-blue',
  TEXT_ORANGE: 'text-orange',
  TEXT_BLUE: 'text-blue'
} as const;

export const BUTTON_STATES = {
  NORMAL: 'normal',
  HOVER: 'hover',
  ACTIVE: 'active',
  DISABLED: 'disabled'
} as const;

export const BUTTON_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
} as const;

export type ButtonVariant = typeof BUTTON_VARIANTS[keyof typeof BUTTON_VARIANTS];
export type ButtonState = typeof BUTTON_STATES[keyof typeof BUTTON_STATES];
export type ButtonSize = typeof BUTTON_SIZES[keyof typeof BUTTON_SIZES];

export interface ButtonConfig {
  text: string;
  variant?: ButtonVariant;
  state?: ButtonState;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: string | null;
  ariaLabel?: string | null;
  onClick?: ((e: MouseEvent) => void | Promise<void>) | null;
  onHover?: (() => void) | null;
  onLeave?: (() => void) | null;
}

export interface ButtonAPI {
  element: HTMLButtonElement;
  setState: (state: ButtonState) => void;
  setDisabled: (disabled: boolean) => void;
  getState: () => ButtonState;
  setText: (text: string) => void;
}

export async function renderButton(
  container: HTMLElement,
  config: ButtonConfig
): Promise<ButtonAPI> {
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

  const HandlebarsGlobal = (window as unknown as {
    Handlebars: {
      compile: (source: string) => (context: Record<string, unknown>) => string
    }
  }).Handlebars;

  const template = HandlebarsGlobal.compile(ButtonTemplate);

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
  const button = wrapper.firstElementChild as HTMLButtonElement;

  if (onClick) {
    button.addEventListener('click', (e: MouseEvent) => {
      void onClick(e);
    });
  }

  if (onHover) {
    button.addEventListener('mouseenter', () => {
      onHover();
    });
  }

  if (onLeave) {
    button.addEventListener('mouseleave', () => {
      onLeave();
    });
  }

  container.appendChild(button);

  return {
    element: button,
    setState: (newState: ButtonState): void => {
      Object.values(BUTTON_STATES).forEach(s => {
        button.classList.remove(`button--${s}`);
      });
      button.classList.add(`button--${newState}`);
    },
    setDisabled: (isDisabled: boolean): void => {
      button.disabled = isDisabled;
      if (isDisabled) {
        button.classList.add(`button--${BUTTON_STATES.DISABLED}`);
      } else {
        button.classList.remove(`button--${BUTTON_STATES.DISABLED}`);
      }
    },
    getState: (): ButtonState => {
      for (const s of Object.values(BUTTON_STATES)) {
        if (button.classList.contains(`button--${s}`)) {
          return s;
        }
      }
      return BUTTON_STATES.NORMAL;
    },
    setText: (newText: string): void => {
      const textSpan = button.querySelector('.button__text');
      if (textSpan) {
        textSpan.textContent = newText;
      } else {
        button.textContent = newText;
      }
    }
  };
}
