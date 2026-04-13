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
 * @constant {Object} AVATAR_SIZES - Доступные размеры аватара
 * @property {string} SMALL - Маленький размер (40x40)
 * @property {string} MEDIUM - Средний размер (60x60)
 * @property {string} LARGE - Большой размер (80x80)
 * @property {string} XLARGE - Очень большой размер (100x100)
 */
export const AVATAR_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  XLARGE: 'xlarge'
};

/**
 * Получить инициалы из имени
 * @param {string} name - Полное имя пользователя
 * @returns {string} Инициалы (макс 2 буквы) или '?' если имя пустое
 * 
 * @example
 * getInitials('Иван Петров') // 'ИП'
 * getInitials('Александр') // 'А'
 * getInitials('') // '?'
 */
function getInitials(name) {
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
 * @async
 * @param {HTMLElement} container - DOM элемент, в который будет вставлен аватар
 * @param {Object} config - Конфигурация аватара
 * @param {string} [config.src=null] - URL изображения (опционально)
 * @param {string} [config.name=''] - Имя пользователя (для инициалов)
 * @param {string} [config.alt=''] - Alt текст для изображения
 * @param {string} [config.size=AVATAR_SIZES.MEDIUM] - Размер аватара
 * @param {number} [config.userId=null] - ID пользователя (для data-атрибута)
 * @param {Function} [config.onClick=null] - Обработчик клика по аватару
 * @param {string} [config.ariaLabel=null] - ARIA метка для доступности
 * @returns {Promise<HTMLElement>} DOM элемент созданного аватара
 * @throws {Error} Если шаблон Avatar.hbs не найден
 * 
 * @example
 * // Аватар с инициалами
 * await renderAvatar(container, {
 *   name: 'Иван Петров',
 *   size: AVATAR_SIZES.LARGE,
 *   onClick: (user) => console.log('Clicked:', user)
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
export async function renderAvatar(container, config = {}) {
  const {
    src = null,
    name = '',
    alt = '',
    size = AVATAR_SIZES.MEDIUM,
    userId = null,
    onClick = null,
    ariaLabel = null
  } = config;

  const template = Handlebars.templates['Avatar.hbs'];
  const initials = getInitials(name);

  // ПРОВЕРКА ЗДЕСЬ: Если пришел "null" или null, принудительно ставим null для шаблона
  const validSrc = (src && src !== 'null') ? src : null;

  const html = template({ 
    src: validSrc, // Используем проверенную переменную
    alt, 
    size, 
    initials,
    userId,
    onClick: !!onClick,
    ariaLabel
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const avatar = wrapper.firstElementChild;

  /**
   * Обработчик клика по аватару
   * @param {Event} _e - Событие клика (не используется)
   */
  if (onClick) {
    avatar.addEventListener('click', _e => {
      onClick({ userId, name, src });
    });
  }

  container.appendChild(avatar);
  return avatar;
}
