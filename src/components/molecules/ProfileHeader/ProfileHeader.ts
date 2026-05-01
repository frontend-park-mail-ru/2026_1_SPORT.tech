/**
 * @fileoverview Компонент шапки профиля
 * Отображает обложку, аватар, имя и кнопки действий
 *
 * @module components/molecules/ProfileHeader
 */

import type { ApiClient } from '../../../utils/api';
import { renderButton } from '../../atoms/Button/Button';
import { openProfileEditModal } from '../ProfileEditModal/ProfileEditModal';

export interface ProfileHeaderConfig {
  name: string;
  role: string;
  avatar?: string | null;
  isOwnProfile?: boolean;
  api: ApiClient;
  onEdit?: (() => void) | null;
  showDonate?: boolean;
  onDonate?: (() => void) | null;
}

export async function renderProfileHeader(
  container: HTMLElement,
  config: ProfileHeaderConfig
): Promise<HTMLElement> {
  const {
    name,
    role,
    avatar = null,
    isOwnProfile = false,
    api,
    onEdit: _onEdit = null,
    showDonate = false,
    onDonate = null
  } = config;

  const template = (window as any).Handlebars.templates['ProfileHeader.hbs'];

  const initials = name
    .split(' ')
    .map((n: string) => n[0])
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
  const element = wrapper.firstElementChild as HTMLElement;
  const donateContainer = element.querySelector(`#profile-donate-${id}`) as HTMLElement | null;
  const actionsContainer = element.querySelector(`#profile-actions-${id}`) as HTMLElement | null;

  // Кнопка "Пожертвовать" — только на чужих профилях тренеров
  if (!isOwnProfile && showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // Кнопка "Подписаться" — только на чужих профилях тренеров
  if (!isOwnProfile && showDonate && actionsContainer) {
    await renderButton(actionsContainer, {
      text: 'Подписаться',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: async () => {
        // TODO: API запрос на подписку
        alert('Функция подписки будет доступна позже');
      }
    });
  }

  // Кнопка "Редактировать" — только в своём профиле
  if (isOwnProfile && actionsContainer) {
    await renderButton(actionsContainer, {
      text: 'Редактировать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: async () => {
        const currentUser = await api.getCurrentUser();
        let userData = currentUser?.user;

        if (userData?.is_trainer) {
          try {
            const fullProfile = await api.getProfile(userData.user_id);
            userData = { ...userData, ...fullProfile };
          } catch (error) {
            console.error('Failed to load full profile:', error);
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

  const statBtn = element.querySelector(`#stat-btn-${id}`) as HTMLElement | null;
  if (statBtn) {
    statBtn.addEventListener('click', () => {
      statBtn.classList.add('button--active');
      setTimeout(() => statBtn.classList.remove('button--active'), 100);
    });
  }

  const subsBtn = element.querySelector(`#subscriptions-btn-${id}`) as HTMLElement | null;
  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      subsBtn.classList.add('button--active');
      setTimeout(() => subsBtn.classList.remove('button--active'), 100);
    });
  }

  const cameraBtn = element.querySelector('.profile-header__camera-btn') as HTMLElement | null;
  if (cameraBtn) {
    cameraBtn.addEventListener('click', async () => {
      if (!api) return;

      const currentUser = await api.getCurrentUser();
      let userData = currentUser?.user;

      if (userData?.is_trainer) {
        try {
          const fullProfile = await api.getProfile(userData.user_id);
          userData = { ...userData, ...fullProfile };
        } catch (error) {
          console.error('Failed to load full profile:', error);
        }
      }

      const { openProfileEditModal } = await import('../ProfileEditModal/ProfileEditModal');
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
