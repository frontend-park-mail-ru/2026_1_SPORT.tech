import Handlebars from 'handlebars';
import ButtonTemplate from './Button.hbs';

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

export async function renderButton(
  container: HTMLElement,
  config: {
    text: string;
    variant?: string;
    state?: string;
    size?: string;
    type?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    icon?: string | null;
    ariaLabel?: string | null;
    onClick?: (e: MouseEvent) => void | Promise<void>;
    onHover?: () => void;
    onLeave?: () => void;
  }
) {
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

  const template = Handlebars.compile(ButtonTemplate);
  
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

  // ... остальной код
  container.appendChild(button);
  return { element: button, setState: () => {}, setDisabled: () => {}, getState: () => 'normal', setText: () => {} };
}
