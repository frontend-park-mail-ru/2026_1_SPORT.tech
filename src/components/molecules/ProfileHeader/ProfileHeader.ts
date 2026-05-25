// src/components/molecules/ProfileHeader/ProfileHeader.ts

import type { ApiClient } from '../../../utils/api';
import { renderButton } from '../../atoms/Button/Button';
import type { ButtonAPI } from '../../atoms/Button/Button';
import { emitSubscriptionsChanged } from '../../organisms/Sidebar/Sidebar';
import { openProfileEditModal } from '../ProfileEditModal/ProfileEditModal';

export interface ProfileHeaderConfig {
  name: string;
  role: string;
  avatar?: string | null;
  isOwnProfile?: boolean;
  isTrainer?: boolean;
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
    name, role, avatar = null, isOwnProfile = false, isTrainer = false, api,
    viewedUserId, showDonate = false, onDonate = null,
    onSubscribed = null
  } = config;

  const template = (window as any).Handlebars.templates['ProfileHeader.hbs'];
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const id = 'header-' + Date.now();

  const showStats = isOwnProfile && isTrainer;
  const html = template({ name, role, avatar, initials, id, isOwnProfile, showStats });
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

  // Подписка / изменение подписки + кнопка чата
  if (!isOwnProfile && showDonate && actionsContainer) {
    let subscriptionButton: ButtonAPI | null = null;
    // Контейнер для дополнительных действий по активной подписке.
    const subscriptionActionsContainer = document.createElement('div');
    subscriptionActionsContainer.className = 'profile-header__subscription-actions';
    actionsContainer.after(subscriptionActionsContainer);

    // Проверяет активную подписку и наличие чата в тире; обновляет кнопки
    const updateSubscriptionUI = async () => {
      if (!subscriptionButton) return;
      try {
        const subs = await api.getMySubscriptions();
        const activeSub = subs.subscriptions.find(
          s => s.trainer_id === viewedUserId && s.active === true
        );
        subscriptionButton.setText(activeSub ? 'Изменить подписку' : 'Подписаться');

        // Показываем дополнительные действия, доступные в активном тире.
        subscriptionActionsContainer.innerHTML = '';
        if (activeSub && viewedUserId) {
          try {
            const tiersResp = await api.getTrainerTiers(viewedUserId);
            const tier = (tiersResp?.tiers || []).find(t => t.tier_id === activeSub.tier_id);
            if (tier?.chat_enabled) {
              const btn = document.createElement('button');
              btn.className = 'button button--medium profile-header__subscription-action';
              btn.textContent = '💬 Написать';
              btn.addEventListener('click', () => {
                window.router.navigateTo(`/chat/${viewedUserId}`);
              });
              subscriptionActionsContainer.appendChild(btn);
            }
            if (tier?.calendar_enabled) {
              const bookBtn = document.createElement('button');
              bookBtn.className = 'button button--medium profile-header__subscription-action';
              bookBtn.textContent = '📅 Записаться';
              bookBtn.addEventListener('click', () => {
                window.router.navigateTo(`/meetings/${viewedUserId}`);
              });
              subscriptionActionsContainer.appendChild(bookBtn);
            }
          } catch { /* игнорируем */ }
        }
      } catch {
        // игнорируем
      }
    };

    const handleClick = async () => {
      if (!viewedUserId) return;

      // Подписываться может любой авторизованный пользователь (клиент или тренер),
      // кроме как на самого себя.
      const currentUser = await api.getCurrentUser();
      if (!currentUser?.user || currentUser.user.user_id === viewedUserId) return;

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
          // Обновить текст кнопки, кнопку чата и остальную часть страницы
          emitSubscriptionsChanged();
          await updateSubscriptionUI();
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
    await updateSubscriptionUI();
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
          onUpdated: () => { void window.router.reload(); }
        });
      }
    });
  }

  // Статистика тренера (модалка)
  const statBtn = element.querySelector(`#stat-btn-${id}`) as HTMLElement | null;
  if (statBtn) statBtn.addEventListener('click', async () => {
    const { openStatisticsModal } = await import('../StatisticsModal/StatisticsModal');
    await openStatisticsModal({ api });
  });

  // Подписчики тренера (модалка)
  const subscribersBtn = element.querySelector(`#subscribers-btn-${id}`) as HTMLElement | null;
  if (subscribersBtn) subscribersBtn.addEventListener('click', async () => {
    const { openSubscribersModal } = await import('../SubscribersModal/SubscribersModal');
    await openSubscribersModal({ api });
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
      onUpdated: () => { void window.router.reload(); }
    });
  });

  container.appendChild(element);
  return element;
}
