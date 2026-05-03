// src/components/molecules/ProfileHeader/ProfileHeader.ts

import type { ApiClient } from '../../../utils/api';
import { renderButton } from '../../atoms/Button/Button';
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
  onSubscribed?: (() => Promise<void>) | null; // ← нужен для обновления данных после подписки/отписки
}

export async function renderProfileHeader(
  container: HTMLElement,
  config: ProfileHeaderConfig
): Promise<HTMLElement> {
  const {
    name, role, avatar = null, isOwnProfile = false, api,
    viewedUserId, onEdit: _onEdit = null, showDonate = false, onDonate = null,
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

  // ========== ПОЖЕРТВОВАТЬ ==========
  if (!isOwnProfile && showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // ========== ПОДПИСКА / ИЗМЕНЕНИЕ ==========
  if (!isOwnProfile && showDonate && actionsContainer) {
    // Определяем начальный текст кнопки
    let initialButtonText = 'Подписаться';
    try {
      const subs = await api.getMySubscriptions();
      const hasSubscription = subs.subscriptions.some(s => s.trainer_id === viewedUserId);
      initialButtonText = hasSubscription ? 'Изменить подписку' : 'Подписаться';
    } catch {
      // оставляем по умолчанию
    }

    // Общая функция‑обработчик, которая всегда загружает свежие данные перед открытием модалки
    const handleSubscriptionClick = async () => {
      if (!viewedUserId) return;

      const currentUser = await api.getCurrentUser();
      const isClient = currentUser?.user && !currentUser.user.is_trainer;
      if (!isClient) {
        alert('Подписка доступна только для клиентов');
        return;
      }

      // Загружаем актуальную информацию о подписке на этого тренера
      let existingSubscription = null;
      try {
        const subs = await api.getMySubscriptions();
        existingSubscription = subs.subscriptions.find(s => s.trainer_id === viewedUserId) || null;
      } catch (e) {
        console.warn('Не удалось загрузить подписки', e);
      }

      const { openSubscriptionModal } = await import('../SubscriptionModal/SubscriptionModal');
      await openSubscriptionModal({
        api,
        trainerId: viewedUserId,
        existingSubscription,
        onSubscribed: async () => {
          // После успешной подписки/отписки/смены обновляем данные страницы
          if (onSubscribed) await onSubscribed();
          // Также можно обновить текст кнопки, перерисовав её (не обязательно, так как страница перезагрузит шапку)
        }
      });
    };

    await renderButton(actionsContainer, {
      text: initialButtonText,
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: handleSubscriptionClick
    });
  }

  // ========== РЕДАКТИРОВАТЬ ПРОФИЛЬ (только свой) ==========
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

  // ========== ОСТАЛЬНЫЕ КНОПКИ (статистика, подписки, смена аватара) ==========
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

  container.appendChild(element);
  return element;
}
