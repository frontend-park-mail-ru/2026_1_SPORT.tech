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
  username?: string;
  bio?: string | null;
  careerSinceDate?: string | null;
  onEdit?: (() => void) | null;
  showDonate?: boolean;
  onDonate?: (() => void) | null;
  onSubscribed?: (() => Promise<void>) | null;
}

// Русская плюрализация: выбирает форму слова в зависимости от числа.
function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function getExperienceYears(careerSinceDate: string): number {
  const careerDate = new Date(careerSinceDate);
  if (Number.isNaN(careerDate.getTime())) return 0;
  const today = new Date();
  let years = today.getFullYear() - careerDate.getFullYear();
  const monthDiff = today.getMonth() - careerDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < careerDate.getDate())) {
    years--;
  }
  return years < 0 ? 0 : years;
}

interface MetaItem {
  text: string;
  onClick?: () => void;
}

export async function renderProfileHeader(
  container: HTMLElement,
  config: ProfileHeaderConfig
): Promise<HTMLElement> {
  const {
    name, role, avatar = null, isOwnProfile = false, isTrainer = false, api,
    viewedUserId, username = '', bio = null, careerSinceDate = null,
    showDonate = false, onDonate = null, onSubscribed = null
  } = config;

  const template = (window as any).Handlebars.templates['ProfileHeader.hbs'];
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const id = 'header-' + Date.now();

  const html = template({ name, role, avatar, initials, id, isOwnProfile, bio });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;

  const subscribeContainer = element.querySelector(`#profile-subscribe-${id}`) as HTMLElement | null;
  const donateContainer = element.querySelector(`#profile-donate-${id}`) as HTMLElement | null;
  const editContainer = element.querySelector(`#profile-edit-${id}`) as HTMLElement | null;
  const secondaryContainer = element.querySelector(`#profile-secondary-${id}`) as HTMLElement | null;
  const metaContainer = element.querySelector(`#profile-meta-${id}`) as HTMLElement | null;
  const actionsRow = element.querySelector('.profile-header__actions') as HTMLElement | null;

  // ---- Строка метаданных (@handle · публикации · стаж · подписчики) ----
  const metaParts: { handle?: MetaItem; posts?: MetaItem; experience?: MetaItem; subscribers?: MetaItem } = {};

  const renderMeta = (): void => {
    if (!metaContainer) return;
    metaContainer.innerHTML = '';
    const items: MetaItem[] = [
      metaParts.handle, metaParts.posts, metaParts.experience, metaParts.subscribers
    ].filter((item): item is MetaItem => Boolean(item));

    items.forEach((item, index) => {
      if (index > 0) {
        const dot = document.createElement('span');
        dot.className = 'profile-header__meta-dot';
        dot.textContent = '·';
        metaContainer.appendChild(dot);
      }
      if (item.onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'profile-header__meta-item profile-header__meta-item--btn';
        button.textContent = item.text;
        button.addEventListener('click', item.onClick);
        metaContainer.appendChild(button);
      } else {
        const span = document.createElement('span');
        span.className = 'profile-header__meta-item';
        span.textContent = item.text;
        metaContainer.appendChild(span);
      }
    });
  };

  if (username) metaParts.handle = { text: `@${username}` };

  if (isTrainer && careerSinceDate) {
    const years = getExperienceYears(careerSinceDate);
    if (years > 0) {
      metaParts.experience = { text: `${years} ${pluralize(years, 'год', 'года', 'лет')} стажа` };
    }
  }

  renderMeta();

  // Количество публикаций — у тренеров (клиенты не публикуют посты).
  if (isTrainer && viewedUserId) {
    void api.getUserPosts(viewedUserId)
      .then(resp => {
        const count = Array.isArray(resp?.posts) ? resp.posts.length : 0;
        metaParts.posts = { text: `${count} ${pluralize(count, 'публикация', 'публикации', 'публикаций')}` };
        renderMeta();
      })
      .catch(() => { /* счётчик необязателен */ });
  }

  // Подписчики — только в собственном профиле тренера; клик открывает модалку.
  if (isOwnProfile && isTrainer) {
    void api.getMySubscribers()
      .then(resp => {
        const count = Array.isArray(resp?.subscribers) ? resp.subscribers.length : 0;
        metaParts.subscribers = {
          text: `${count} ${pluralize(count, 'подписчик', 'подписчика', 'подписчиков')}`,
          onClick: async () => {
            const { openSubscribersModal } = await import('../SubscribersModal/SubscribersModal');
            await openSubscribersModal({ api });
          }
        };
        renderMeta();
      })
      .catch(() => { /* счётчик необязателен */ });
  }

  // ---- Описание (bio) со сворачиванием ----
  const bioText = element.querySelector(`#profile-bio-text-${id}`) as HTMLElement | null;
  const bioToggle = element.querySelector(`#profile-bio-toggle-${id}`) as HTMLButtonElement | null;
  const setupBioToggle = (): void => {
    if (!bioText || !bioToggle) return;
    // Кнопка «ещё» нужна только если текст реально не помещается в свёрнутом виде.
    if (bioText.scrollHeight - bioText.clientHeight > 2) {
      bioToggle.hidden = false;
      bioToggle.addEventListener('click', () => {
        const expanded = bioText.classList.toggle('profile-header__bio-text--expanded');
        bioToggle.textContent = expanded ? 'свернуть' : 'ещё';
      });
    }
  };

  // ---- Пожертвовать ----
  if (!isOwnProfile && showDonate && donateContainer && onDonate) {
    await renderButton(donateContainer, {
      text: 'Пожертвовать',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: onDonate
    });
  }

  // ---- Подписка / изменение подписки + кнопки чата и записи ----
  if (!isOwnProfile && showDonate && subscribeContainer) {
    let subscriptionButton: ButtonAPI | null = null;
    const subscriptionActionsContainer = document.createElement('div');
    subscriptionActionsContainer.className = 'profile-header__subscription-actions';
    if (actionsRow) actionsRow.appendChild(subscriptionActionsContainer);

    const updateSubscriptionUI = async (): Promise<void> => {
      if (!subscriptionButton) return;
      try {
        const subs = await api.getMySubscriptions();
        const activeSub = subs.subscriptions.find(
          s => s.trainer_id === viewedUserId && s.active === true
        );
        subscriptionButton.setText(activeSub ? 'Изменить подписку' : 'Подписаться');

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

    const handleClick = async (): Promise<void> => {
      if (!viewedUserId) return;

      const currentUser = await api.getCurrentUser();
      if (!currentUser?.user || currentUser.user.user_id === viewedUserId) return;

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
          emitSubscriptionsChanged();
          await updateSubscriptionUI();
          if (onSubscribed) await onSubscribed();
        }
      });
    };

    subscriptionButton = await renderButton(subscribeContainer, {
      text: 'Подписаться',
      variant: 'primary-orange',
      state: 'normal',
      size: 'medium',
      onClick: handleClick
    });
    await updateSubscriptionUI();
  }

  // ---- Редактировать профиль (только свой) ----
  if (isOwnProfile && editContainer) {
    await renderButton(editContainer, {
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

  // ---- Статистика (только собственный профиль тренера) ----
  if (isOwnProfile && isTrainer && secondaryContainer) {
    await renderButton(secondaryContainer, {
      text: 'Статистика',
      variant: 'secondary-blue',
      state: 'normal',
      size: 'medium',
      onClick: async () => {
        const { openStatisticsModal } = await import('../StatisticsModal/StatisticsModal');
        await openStatisticsModal({ api });
      }
    });
  }

  // ---- Смена фото (только свой) ----
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
  window.requestAnimationFrame(setupBioToggle);
  return element;
}
