/**
 * @fileoverview Базовый компонент аватара
 * Умеет:
 * - Рендерить аватар с фото или инициалами
 * - Обрабатывать длинные имена (берёт первые буквы)
 * - Поддерживать разные размеры
 * - Обрабатывать клики
 *
 * @module components/atoms/Avatar
 */

/**
 * Доступные размеры аватара
 */
export const AVATAR_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  XLARGE: 'xlarge'
} as const;

export type AvatarSize = typeof AVATAR_SIZES[keyof typeof AVATAR_SIZES];

export interface AvatarConfig {
  src?: string | null;
  name?: string;
  alt?: string;
  size?: AvatarSize;
  userId?: number | null;
  onClick?: ((data: { userId: number | null; name: string; src: string | null }) => void) | null;
  ariaLabel?: string | null;
}

export interface AvatarClickData {
  userId: number | null;
  name: string;
  src: string | null;
}

/**
 * Получить инициалы из имени
 * @param name - Полное имя пользователя
 * @returns Инициалы (макс 2 буквы) или '?' если имя пустое
 *
 * @example
 * getInitials('Иван Петров') // 'ИП'
 * getInitials('Александр') // 'А'
 * getInitials('') // '?'
 */
function getInitials(name: string): string {
  if (!name) return '?';

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    // Если одно слово, берём первую букву
    return words[0].charAt(0).toUpperCase();
  }

  // Берём первую букву первого и последнего слова
  const first = words[0].charAt(0);
  const last = words[words.length - 1].charAt(0);

  return (first + last).toUpperCase();
}

/**
 * Рендерит аватар
 * @param container - DOM элемент, в который будет вставлен аватар
 * @param config - Конфигурация аватара
 * @returns DOM элемент созданного аватара
 *
 * @example
 * // Аватар с инициалами
 * await renderAvatar(container, {
 *   name: 'Иван Петров',
 *   size: AVATAR_SIZES.LARGE,
 *   onClick: user => handleAvatarClick(user)
 * });
 *
 * @example
 * // Аватар с фото
 * await renderAvatar(container, {
 *   src: '/images/avatar.jpg',
 *   name: 'Иван Петров',
 *   size: AVATAR_SIZES.MEDIUM
 * });
 */
export async function renderAvatar(
  container: HTMLElement,
  config: AvatarConfig = {}
): Promise<HTMLElement> {
  const {
    src = null,
    name = '',
    alt = '',
    size = AVATAR_SIZES.MEDIUM,
    userId = null,
    onClick = null,
    ariaLabel = null
  } = config;

  const template = (window as any).Handlebars.templates['Avatar.hbs'];

  const initials = getInitials(name);

  const html = template({
    src,
    alt,
    size,
    initials,
    userId,
    onClick: !!onClick,
    ariaLabel
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const avatar = wrapper.firstElementChild as HTMLElement;

  /**
   * Обработчик клика по аватару
   */
  if (onClick) {
    avatar.addEventListener('click', (): void => {
      onClick({ userId, name, src });
    });
  }

  container.appendChild(avatar);
  return avatar;
}
