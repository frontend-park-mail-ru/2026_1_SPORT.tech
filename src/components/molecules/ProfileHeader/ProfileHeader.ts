// src/components/molecules/ProfileHeader/ProfileHeader.ts

import type { ApiClient } from '../../../utils/api';
import { renderButton } from '../../atoms/Button/Button';
import type { ButtonAPI } from '../../atoms/Button/Button';
import { openProfileEditModal } from '../ProfileEditModal/ProfileEditModal';
import { openStatisticsModal } from '../StatisticsModal/StatisticsModal';

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
  isTrainer?: boolean;
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
    viewedUserId,
    showDonate = false,
    onDonate = null,
    onSubscribed = null,
    isTrainer = false
  } = config;

  const template = (window as any).Handlebars.templates['ProfileHeader.hbs'];
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const id = 'header-' + Date.now();

  // Передаём isOwnProfile в шаблон, чтобы он мог скрыть кнопку статистики для чужих профилей
  const html = template({ name, role, avatar, initials, id, isOwnProfile });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;

  const donateContainer = element.querySelector(`#profile-donate-${id}`) as HTMLElement | null;
  const actionsContainer = element.querySelector(`#profile-actions-${id}`) as HTMLElement | null;

  // Кнопка "Пожертвовать" (только для чужого профиля тренера)
  if (!isOwnProfile && showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // Кнопка "Подписаться" / "Изменить подписку" (только для чужого профиля тренера)
  if (!isOwnProfile && showDonate && actionsContainer) {
    let subscriptionButton: ButtonAPI | null = null;

    const updateButtonText = async () => {
      if (!subscriptionButton) return;
      try {
        const subs = await api.getMySubscriptions();
        const hasActiveSubscription = subs.subscriptions.some(
          s => s.trainer_id === viewedUserId && s.active === true
        );
        subscriptionButton.setText(hasActiveSubscription ? 'Изменить подписку' : 'Подписаться');
      } catch {}
    };

    const handleClick = async () => {
      if (!viewedUserId) return;
      let existingSubscription = null;
      try {
        const subs = await api.getMySubscriptions();
        existingSubscription =
          subs.subscriptions.find(
            s => s.trainer_id === viewedUserId && s.active === true
          ) || null;
      } catch {}
      const { openSubscriptionModal } = await import('../SubscriptionModal/SubscriptionModal');
      await openSubscriptionModal({
        api,
        trainerId: viewedUserId,
        existingSubscription,
        onSubscribed: async () => {
          await updateButtonText();
          if (onSubscribed) await onSubscribed();
        }
      });
    };

    subscriptionButton = await renderButton(actionsContainer, {
      text: 'Подписаться',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: handleClick
    });
    await updateButtonText();
  }

  // Кнопка "Редактировать" (только для своего профиля)
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

  // Обработчик кнопки «Статистика» (отображается только для своего профиля, так как в шаблоне условие)
  const statBtn = element.querySelector(`#stat-btn-${id}`) as HTMLElement | null;
  if (statBtn && isOwnProfile) {
    statBtn.addEventListener('click', async () => {
      // Для собственного профиля получаем id текущего пользователя (если viewedUserId не задан)
      let userId = viewedUserId;
      if (!userId) {
        try {
          const me = await api.getCurrentUser();
          userId = me?.user?.user_id;
        } catch {}
      }
      if (userId) {
        void openStatisticsModal(api, userId, isTrainer, isOwnProfile);
      }
    });
  }

  // Обработчик кнопки «Подписки» (пока просто анимация)
  const subsBtn = element.querySelector(`#subscriptions-btn-${id}`) as HTMLElement | null;
  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      subsBtn.classList.add('button--active');
      setTimeout(() => subsBtn.classList.remove('button--active'), 100);
    });
  }

  // Кнопка камеры (смена аватара) только для своего профиля
  const cameraBtn = element.querySelector('.profile-header__camera-btn') as HTMLElement | null;
  if (cameraBtn && isOwnProfile) {
    cameraBtn.addEventListener('click', async () => {
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
  }

  container.appendChild(element);
  return element;
}
