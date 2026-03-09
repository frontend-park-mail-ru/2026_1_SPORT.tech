/**
 * БАЗОВЫЙ КОМПОНЕНТ АВАТАРА
 * Умеет:
 * - Рендерить аватар с фото или инициалами
 * - Обрабатывать длинные имена (берёт первые буквы)
 * - Поддерживать разные размеры
 * - Обрабатывать клики
 */

export const AVATAR_SIZES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    XLARGE: 'xlarge'
};

/**
 * Получить инициалы из имени
 * @param {string} name - Полное имя
 * @returns {string} - Инициалы (макс 2 буквы)
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
 * @param {HTMLElement} container - Контейнер для вставки
 * @param {Object} config - Конфигурация аватара
 * @param {string} config.src - URL фото (опционально)
 * @param {string} config.name - Имя пользователя (для инициалов)
 * @param {string} config.alt - Alt текст
 * @param {string} config.size - small | medium | large | xlarge
 * @param {number} config.userId - ID пользователя (для data-атрибута)
 * @param {Function} config.onClick - Обработчик клика
 * @param {string} config.ariaLabel - Для доступности
 * @returns {Promise<HTMLElement>} DOM элемент аватара
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
    const avatar = wrapper.firstElementChild;

    if (onClick) {
        avatar.addEventListener('click', (e) => {
            onClick({ userId, name, src });
        });
    }

    container.appendChild(avatar);
    return avatar;
}
