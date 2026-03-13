/**
 * БАЗОВЫЙ КОМПОНЕНТ ЭЛЕМЕНТА ПОЛЬЗОВАТЕЛЯ
 */

/**
 * Рендерит элемент пользователя
 * @param {HTMLElement} container - Контейнер для вставки
 * @param {Object} config - Конфигурация
 * @param {number} config.id - ID пользователя
 * @param {string} config.name - Имя
 * @param {string} config.role - Роль
 * @param {string} config.avatar - URL аватара
 * @param {boolean} config.isEmpty - Пустое состояние
 * @param {string} config.emptyMessage - Сообщение для пустого состояния
 * @param {boolean} config.compact - Компактный режим
 * @param {boolean} config.clickable - Кликабельность
 * @param {Function} config.onClick - Обработчик клика
 * @param {string|number} config.count - Счётчик (для постов)
 * @returns {Promise<HTMLElement>}
 */
export async function renderUserPhotoItem(container, config = {}) {
  const {
    id = null,
    name = '',
    role = '',
    avatar = null,
    isEmpty = false,
    emptyMessage = 'Нет пользователей',
    compact = false,
    clickable = true,
    onClick = null,
    count = null
  } = config;

  const template = Handlebars.templates['UserPhotoItem.hbs'];
    
  // Получаем инициалы
  const initials = name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
    
  const html = template({ 
    id, 
    name, 
    role, 
    avatar, 
    initials,
    isEmpty,
    emptyMessage,
    clickable: clickable && !isEmpty,
    count
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;

  // Добавляем компактный класс
  if (compact) {
    element.classList.add('user-photo-item--compact');
  }

  // Обработчик клика
  if (onClick && !isEmpty) {
    element.addEventListener('click', () => onClick({ id, name, role, avatar }));
  }

  container.appendChild(element);
  return element;
}

/**
 * Рендерит список пользователей с заголовком
 * @param {HTMLElement} container
 * @param {string} title - Заголовок секции
 * @param {Array} users - Массив пользователей
 * @param {Object} options - Опции
 */
export async function renderUserPhotoList(container, title, users = [], options = {}) {
  // Заголовок
  const titleEl = document.createElement('h3');
  titleEl.className = 'user-photo-section-title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  // Контейнер для списка
  const listContainer = document.createElement('div');
  listContainer.className = 'user-photo-list';
  container.appendChild(listContainer);

  // Рендерим пользователей
  if (users.length === 0) {
    await renderUserPhotoItem(listContainer, {
      isEmpty: true,
      emptyMessage: options.emptyMessage || 'Нет пользователей'
    });
  } else {
    for (const user of users) {
      await renderUserPhotoItem(listContainer, {
        ...user,
        compact: options.compact,
        clickable: options.clickable
      });
    }
  }

  return listContainer;
}
