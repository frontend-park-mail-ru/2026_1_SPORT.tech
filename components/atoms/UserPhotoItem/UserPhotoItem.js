/**
 * @fileoverview Базовый компонент элемента пользователя
 * Используется для отображения пользователей в списках:
 * - Подписки в сайдбаре
 * - Список друзей
 * - Участники чата
 * 
 * @module components/atoms/UserPhotoItem
 */

/**
 * Рендерит элемент пользователя
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} config - Конфигурация элемента
 * @param {number} [config.id=null] - ID пользователя
 * @param {string} [config.name=''] - Имя пользователя
 * @param {string} [config.role=''] - Роль пользователя
 * @param {string} [config.avatar=null] - URL аватара
 * @param {boolean} [config.isEmpty=false] - Пустое состояние (нет пользователей)
 * @param {string} [config.emptyMessage='Нет пользователей'] - Сообщение для пустого состояния
 * @param {boolean} [config.compact=false] - Компактный режим отображения
 * @param {boolean} [config.clickable=true] - Кликабельность элемента
 * @param {Function} [config.onClick=null] - Обработчик клика
 * @param {string|number} [config.count=null] - Счётчик (для постов/подписок)
 * @returns {Promise<HTMLElement>} DOM элемент пользователя
 * 
 * @example
 * // Обычный пользователь
 * await renderUserPhotoItem(container, {
 *   id: 123,
 *   name: 'Иван Петров',
 *   role: 'Тренер',
 *   onClick: (user) => console.log('Selected:', user)
 * });
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
    
  /**
   * Получить инициалы из имени
   * @param {string} name - Имя для получения инициалов
   * @returns {string} Инициалы или '?'
   */
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

  if (compact) {
    element.classList.add('user-photo-item--compact');
  }

  /**
   * Обработчик клика по элементу
   * @param {MouseEvent} _event - Событие клика (не используется)
   */
  if (onClick && !isEmpty) {
    element.addEventListener('click', () => onClick({ id, name, role, avatar }));
  }

  container.appendChild(element);
  return element;
}

/**
 * Рендерит список пользователей с заголовком
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {string} title - Заголовок секции
 * @param {Array} users - Массив пользователей
 * @param {Object} options - Опции для списка
 * @param {boolean} [options.compact=false] - Компактный режим
 * @param {boolean} [options.clickable=true] - Кликабельность элементов
 * @param {string} [options.emptyMessage='Нет пользователей'] - Сообщение если список пуст
 * @returns {Promise<HTMLElement>} DOM элемент списка
 * 
 * @example
 * // Список подписок
 * await renderUserPhotoList(container, 'Подписки', users, {
 *   compact: true,
 *   clickable: true
 * });
 */
export async function renderUserPhotoList(container, title, users = [], options = {}) {
  /**
   * Создать заголовок секции
   * @type {HTMLElement}
   */
  const titleEl = document.createElement('h3');
  titleEl.className = 'user-photo-section-title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  /**
   * Контейнер для списка пользователей
   * @type {HTMLElement}
   */
  const listContainer = document.createElement('div');
  listContainer.className = 'user-photo-list';
  container.appendChild(listContainer);

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
