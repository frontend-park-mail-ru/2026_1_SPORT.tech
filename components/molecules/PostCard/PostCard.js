/**
 * Рендерит карточку публикации
 * @param {HTMLElement} container
 * @param {Object} post
 * @param {string} post.title
 * @param {string} post.content
 * @param {string} post.authorName
 * @param {string} post.authorRole
 * @param {number} post.likes
 * @param {number} post.comments
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
  element.querySelectorAll('.post-card__action').forEach(action => {
    action.addEventListener('click', () => {
      console.log('Action clicked');
    });
  });

  container.appendChild(element);
  return element;
}
