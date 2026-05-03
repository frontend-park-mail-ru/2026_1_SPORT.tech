// src/components/molecules/ProfileHeader/ProfileHeader.ts

import type { ApiClient } from '../../../utils/api';
import { renderButton } from '../../atoms/Button/Button';
import type { ButtonAPI } from '../../atoms/Button/Button';
import { openProfileEditModal } from '../ProfileEditModal/ProfileEditModal';

export interface ProfileHeaderConfig {
  name: string;
  role: string;
  avatar?: string | null;
  isOwnProfile?: boolean;
  api: ApiClient;
  viewedUserId?: number;
  onEdit?: (() => void) | null;
  showDonate?: boolean;
  onDonate?: (() => void) | null;
  onSubscribed?: (() => Promise<void>) | null;
}

export async function renderProfileHeader(
  container: HTMLElement,
  config: ProfileHeaderConfig
): Promise<HTMLElement> {
  const {
    name, role, avatar = null, isOwnProfile = false, api,
    viewedUserId, showDonate = false, onDonate = null,
    onSubscribed = null
  } = config;

  const template = (window as any).Handlebars.templates['ProfileHeader.hbs'];
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const id = 'header-' + Date.now();

  const html = template({ name, role, avatar, initials, id, isOwnProfile });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;
  const donateContainer = element.querySelector(`#profile-donate-${id}`) as HTMLElement | null;
  const actionsContainer = element.querySelector(`#profile-actions-${id}`) as HTMLElement | null;

  // Пожертвовать
  if (!isOwnProfile && showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // Подписка / изменение подписки
  if (!isOwnProfile && showDonate && actionsContainer) {
    let subscriptionButton: ButtonAPI | null = null;

    // Функция обновления текста кнопки с учётом active === true
    const updateButtonText = async () => {
      if (!subscriptionButton) return;
      try {
        const subs = await api.getMySubscriptions();
        const hasActiveSubscription = subs.subscriptions.some(
          s => s.trainer_id === viewedUserId && s.active === true
        );
        subscriptionButton.setText(hasActiveSubscription ? 'Изменить подписку' : 'Подписаться');
      } catch {
        // игнорируем
      }
    };

    const handleClick = async () => {
      if (!viewedUserId) return;

      const currentUser = await api.getCurrentUser();
      const isClient = currentUser?.user && !currentUser.user.is_trainer;
      if (!isClient) return;

      // Свежая активная подписка перед открытием
      let existingSubscription = null;
      try {
        const subs = await api.getMySubscriptions();
        existingSubscription = subs.subscriptions.find(
          s => s.trainer_id === viewedUserId && s.active === true
        ) || null;
      } catch {}

      const { openSubscriptionModal } = await import('../SubscriptionModal/SubscriptionModal');
      await openSubscriptionModal({
        api,
        trainerId: viewedUserId,
        existingSubscription,
        onSubscribed: async () => {
          // Обновить текст кнопки и остальную часть страницы
          await updateButtonText();
          if (onSubscribed) await onSubscribed();
        }
      });
    };

    // Создаём кнопку один раз
    subscriptionButton = await renderButton(actionsContainer, {
      text: 'Подписаться',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: handleClick
    });
    await updateButtonText();
  }

  // Редактировать профиль (только свой)
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
          } catch {}
        }
        openProfileEditModal({
          api,
          currentUser: { user: userData },
          onUpdated: () => window.router.navigateTo('/profile')
        });
      }
    });
  }

  // Остальные кнопки – без изменений
  const statBtn = element.querySelector(`#stat-btn-${id}`) as HTMLElement | null;
  if (statBtn) statBtn.addEventListener('click', () => {
    statBtn.classList.add('button--active');
    setTimeout(() => statBtn.classList.remove('button--active'), 100);
  });

  const subsBtn = element.querySelector(`#subscriptions-btn-${id}`) as HTMLElement | null;
  if (subsBtn) subsBtn.addEventListener('click', () => {
    subsBtn.classList.add('button--active');
    setTimeout(() => subsBtn.classList.remove('button--active'), 100);
  });

  const cameraBtn = element.querySelector('.profile-header__camera-btn') as HTMLElement | null;
  if (cameraBtn) cameraBtn.addEventListener('click', async () => {
    if (!api) return;
    const currentUser = await api.getCurrentUser();
    let userData = currentUser?.user;
    if (userData?.is_trainer) {
      try {
        const fullProfile = await api.getProfile(userData.user_id);
        userData = { ...userData, ...fullProfile };
      } catch {}
    }
    const { openProfileEditModal } = await import('../ProfileEditModal/ProfileEditModal');
    openProfileEditModal({
      api,
      currentUser: { user: userData },
      onUpdated: () => window.router.navigateTo('/profile')
    });
  });

  container.appendChild(element);
  return element;
}
