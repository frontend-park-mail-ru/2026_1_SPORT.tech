import { renderButton } from '../../atoms/Button/Button.js';

/**
 * Рендерит шапку профиля
 * @param {HTMLElement} container
 * @param {Object} profile
 * @param {string} profile.name 
 * @param {string} profile.role
 * @param {string} profile.avatar 
 * @param {boolean} profile.isOwnProfile 
 * @param {Function} profile.onSubscribe 
 * @param {Function} profile.onEdit 
 */
export async function renderProfileHeader(container, {
  name,
  role,
  avatar = null,
  isOwnProfile = false,
  onSubscribe = null,
  onEdit = null
}) {
  const template = Handlebars.templates['ProfileHeader.hbs'];
  
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const id = 'header-' + Date.now();
  
  const html = template({
    name,
    role,
    avatar,
    initials,
    id
  });
  
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;
  const actionsContainer = element.querySelector(`#profile-actions-${id}`);
  
  if (isOwnProfile) {
    await renderButton(actionsContainer, {
      text: 'Редактировать',
      variant: 'secondary',
      state: 'normal',
      onClick: onEdit
    });
  } else {
    await renderButton(actionsContainer, {
      text: 'Подписаться',
      variant: 'default',
      state: 'normal',
      onClick: onSubscribe
    });
  }
  
  container.appendChild(element);
  return element;
}