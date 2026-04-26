/**
 * @fileoverview Компонент шапки профиля
 * Отображает обложку, аватар, имя и кнопки действий
 *
 * @module components/molecules/ProfileHeader
 */

import { renderButton } from '../../atoms/Button/Button.ts';
import { openProfileEditModal } from '../ProfileEditModal/ProfileEditModal.ts';

/**
 * Рендерит шапку профиля
 * @async
 * @param {HTMLElement} container - DOM элемент для вставки
 * @param {Object} profile - Данные профиля
 * @param {string} profile.name - Имя пользователя
 * @param {string} profile.role - Роль пользователя
 * @param {string} [profile.avatar=null] - URL аватара
 * @param {boolean} [profile.isOwnProfile=false] - Свой ли это профиль
 * @param {Object} [profile.api] - API клиент
 * @param {Function} [profile.onEdit=null] - Обработчик редактирования профиля
 * @param {boolean} [profile.showDonate=false] - Показать кнопку пожертвования
 * @param {Function} [profile.onDonate=null] - Обработчик пожертвования
 * @returns {Promise<HTMLElement>} DOM элемент шапки
 *
 * @example
 * // Чужой профиль
 * await renderProfileHeader(container, {
 *   name: 'Иван Петров',
 *   role: 'Тренер',
 *   isOwnProfile: false
 * });
 */
export async function renderProfileHeader(container, {
  name,
  role,
  avatar = null,
  isOwnProfile = false,
  api,
  onEdit = null,
  showDonate = false,
  onDonate = null
}) {
  const template = Handlebars.templates['ProfileHeader.hbs'];

  /**
   * Получить инициалы пользователя
   * @param {string} fullName - Полное имя
   * @returns {string} Инициалы
   */
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  /**
   * Уникальный ID для элементов шапки
   * @type {string}
   */
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
  const donateContainer = element.querySelector(`#profile-donate-${id}`);
  const actionsContainer = element.querySelector(`#profile-actions-${id}`);

  if (showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // Кнопка редактирования для своего профиля
  if (isOwnProfile && actionsContainer) {
    await renderButton(actionsContainer, {
      text: 'Редактировать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: async () => {
        // Получаем базовые данные текущего пользователя
        const currentUser = await api.getCurrentUser();
        let userData = currentUser?.user;

        // Если пользователь тренер, запрашиваем полный профиль с trainer_details
        if (userData?.is_trainer) {
          try {

            const fullProfile = await api.getProfile(userData.user_id);
            userData = { ...userData, ...fullProfile };

          } catch (error) {
          }
        }

        openProfileEditModal({
          api,
          currentUser: { user: userData },
          onUpdated: () => window.router.navigateTo('/profile')
        });
      }
    });
  }

  /**
   * Обработчик клика по кнопке статистики
   * @param {MouseEvent} _event - Событие клика (не используется)
   */
  const statBtn = element.querySelector(`#stat-btn-${id}`);
  if (statBtn) {
    statBtn.addEventListener('click', () => {
      statBtn.classList.add('button--active');
      setTimeout(() => statBtn.classList.remove('button--active'), 100);
    });
  }

  /**
   * Обработчик клика по кнопке подписок
   * @param {MouseEvent} _event - Событие клика (не используется)
   */
  const subsBtn = element.querySelector(`#subscriptions-btn-${id}`);
  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      subsBtn.classList.add('button--active');
      setTimeout(() => subsBtn.classList.remove('button--active'), 100);
    });
  }

  // Кнопка камеры для смены аватара
  const cameraBtn = element.querySelector('.profile-header__camera-btn');
  if (cameraBtn) {
    cameraBtn.addEventListener('click', async () => {
      if (!api) {
        return;
      }
      const currentUser = await api.getCurrentUser();
      let userData = currentUser?.user;

      // Если тренер - запрашиваем полный профиль
      if (userData?.is_trainer) {
        try {
          const fullProfile = await api.getProfile(userData.user_id);
          userData = { ...userData, ...fullProfile };
        } catch (error) {
        }
      }

      const { openProfileEditModal } = await import('../ProfileEditModal/ProfileEditModal.ts');
      openProfileEditModal({
        api,
        currentUser: { user: userData },
        onUpdated: () => window.router.navigateTo('/profile')
      });
    });
  }

  container.appendChild(element);
  return element;
}
