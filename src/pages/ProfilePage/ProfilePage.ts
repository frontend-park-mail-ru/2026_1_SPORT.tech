// src/pages/ProfilePage/ProfilePage.ts

import type { ApiClient } from '../../utils/api';
import type { PostWithAuthor, ProfilePageData } from '../../types/post.types';
import { openDonationModal } from '../../components/molecules/DonationModal/DonationModal';
import { renderProfileHeader } from '../../components/molecules/ProfileHeader/ProfileHeader';
import { fillProfilePostsSection, renderProfileContent } from '../../components/organisms/ProfileContent/ProfileContent';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';
import { loadProfilePageData } from '../../utils/profilePageData';

interface ProfilePageParams {
  viewedUserId: number;
  profile?: { name: string; role: string; avatar: string | null; isOwnProfile: boolean; isTrainer: boolean };
  currentUser?: { id: number; name: string; role: string; avatar: string | null } | null;
  subscriptions?: Array<{ id: number; name: string; role: string }>;
  posts?: PostWithAuthor[];
  popularPosts?: PostWithAuthor[];
  activeTab?: string;
  onLogout?: (() => Promise<void>) | null;
}

export async function renderProfilePage(
  api: ApiClient, container: HTMLElement, params: ProfilePageParams = {} as ProfilePageParams
): Promise<HTMLElement> {
  const {
    viewedUserId,
    profile = { name: 'Абдурахман Гасанов', role: 'Фитнес-тренер', avatar: null, isOwnProfile: false, isTrainer: false },
    currentUser = { id: 0, name: 'Абдурахман Гасанов', role: 'Фитнес-тренер', avatar: null },
    subscriptions = [], posts = [], popularPosts = [], activeTab = 'publications', onLogout = null
  } = params;

  const HandlebarsGlobal = (window as any).Handlebars;
  const template = HandlebarsGlobal.templates['ProfilePage.hbs'];
  const html = template({});
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild as HTMLElement;

  container.innerHTML = '';
  container.appendChild(page);
  const sidebarContainer = page.querySelector('#sidebar-container') as HTMLElement;
  const profileContainer = page.querySelector('#profile-container') as HTMLElement;
  const headerContainer = document.createElement('div'); headerContainer.className = 'profile-page__header'; profileContainer.appendChild(headerContainer);
  const contentContainer = document.createElement('div'); contentContainer.className = 'profile-page__content'; profileContainer.appendChild(contentContainer);

  async function reloadAllData(): Promise<void> {
    const data: ProfilePageData = await loadProfilePageData(api, viewedUserId);
    const postsContainer = contentContainer.querySelector('#posts-container') as HTMLElement;
    if (postsContainer) {
      const activeTabElement = contentContainer.querySelector('.profile-content__tab--active') as HTMLElement;
      const currentTab = activeTabElement?.dataset?.tab || 'publications';
      await fillProfilePostsSection(postsContainer, {
        activeTab: currentTab,
        posts: data.posts,
        api,
        canManagePosts: profile.isOwnProfile,
        onPostsUpdated: reloadAllData
      });
    }
  }

  await Promise.all([
    renderSidebar(sidebarContainer, { activePage: 'profile', currentUser, users: subscriptions, api, onLogout }),
    renderProfileHeader(headerContainer, {
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar,
      isOwnProfile: profile.isOwnProfile,
      showDonate: profile.isTrainer,
      api,
      viewedUserId,
      onDonate: () => openDonationModal({ api, recipientUserId: viewedUserId }),
      onSubscribed: reloadAllData
    }),
    renderProfileContent(contentContainer, {
      activeTab,
      posts,
      popularPosts,
      api,
      canAddPost: profile.isOwnProfile && profile.isTrainer,
      canManagePosts: profile.isOwnProfile && profile.isTrainer,
      onPostsUpdated: reloadAllData,
      viewedUserId,
      isTrainer: profile.isTrainer,
      isOwnProfile: profile.isOwnProfile   // передаём флаг
    })
  ]);

  return page;
}
