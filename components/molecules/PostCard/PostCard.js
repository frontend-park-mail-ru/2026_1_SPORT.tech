/**
 * @fileoverview Компонент карточки публикации
 * Отображает пост в ленте или на странице профиля
 * 
 * @module components/molecules/PostCard
 */

/**
 * Рендерит карточку публикации
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} post - Данные поста
 * @param {string} post.title - Заголовок поста
 * @param {string} post.content - HTML-содержимое поста
 * @param {string} post.authorName - Имя автора
 * @param {string} post.authorRole - Роль автора
 * @param {number} [post.likes=0] - Количество лайков
 * @param {number} [post.comments=0] - Количество комментариев
 * @param {Object} [post.api] - API клиент (для будущих функций)
 * @param {number} [post.postId=null] - ID поста
 * @returns {Promise<HTMLElement>} DOM элемент карточки
 * 
 * @example
 * await renderPostCard(container, {
 *   title: 'Топ упражнений',
 *   content: '<p>Текст поста</p>',
 *   authorName: 'Иван Петров',
 *   authorRole: 'Тренер',
 *   likes: 42,
 *   comments: 15
 * });
 */
export async function renderPostCard(container, {
  title,
  content,
  authorName,
  authorRole,
  likes = 0,
  comments = 0,
  api,
  postId = null
}) {
  const template = Handlebars.templates['PostCard.hbs'];

  /**
   * Получить инициалы автора
   * @param {string} name - Имя автора
   * @returns {string} Инициалы (первые буквы слов)
   */
  const initials = authorName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const html = template({
    title,
    content,
    authorName,
    authorRole,
    authorInitials: initials,
    likes,
    comments
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;

  /**
   * Добавить обработчики для действий с постом (лайки, комментарии)
   * @param {Element} action - DOM элемент действия
   */
  element.querySelectorAll('.post-card__action').forEach(action => {
    action.addEventListener('click', () => {
      // Будущая функциональность
    });
  });

  container.appendChild(element);
  return element;
}
