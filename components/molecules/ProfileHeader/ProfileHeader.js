import { renderButton } from '../../atoms/Button/Button.js';

/**
 * Рендерит шапку профиля
 * @param {HTMLElement} container
 * @param {Object} profile
 * @param {string} profile.name
 * @param {string} profile.role
 * @param {string} profile.avatar
 * @param {boolean} profile.isOwnProfile
 * @param {Function} profile.onEdit
 */
export async function renderProfileHeader(container, {
  name,
  role,
  avatar = null,
  isOwnProfile = false,
  api,
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
    id,
    isOwnProfile
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild;
  const actionsContainer = element.querySelector(`#profile-actions-${id}`);

  // Кнопка редактирования для своего профиля
  if (isOwnProfile && actionsContainer) {
    await renderButton(actionsContainer, {
      text: 'Редактировать',
      variant: 'primary-orange', // Оранжевая кнопка
      state: 'normal',
      size: 'medium', // Средний размер
      onClick: onEdit
    });
  }

  // Обработчики для статистики и подписок
  const statBtn = element.querySelector(`#stat-btn-${id}`);
  if (statBtn) {
    statBtn.addEventListener('click', () => {
      console.log('📊 Statistics clicked');
      statBtn.classList.add('button--active');
      setTimeout(() => statBtn.classList.remove('button--active'), 100);
    });
  }

  const subsBtn = element.querySelector(`#subscriptions-btn-${id}`);
  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      console.log('👥 Subscriptions clicked');
      subsBtn.classList.add('button--active');
      setTimeout(() => subsBtn.classList.remove('button--active'), 100);
    });
  }

  container.appendChild(element);
  return element;
}
