import type { PostAttachment } from './api.types';

export interface PostWithAuthor {
  post_id: number;
  title: string;
  content: string;
  raw_text: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  likes: number;
  liked: boolean;
  comments: number;
  can_view: boolean;
  created_at: string;
  min_tier_id: number | null;
  attachments: PostAttachment[];
  isOwner?: boolean;
}

export interface ProfilePageData {
  profile: {
    name: string;
    role: string;
    avatar: string | null;
    isOwnProfile: boolean;
    isTrainer: boolean;
  };
  currentUser: {
    id: number;
    name: string;
    role: string;
    avatar: string | null;
  } | null;
  posts: PostWithAuthor[];
  subscriptions: never[];
  popularPosts: never[];
  viewedUserId: number;
}

export interface PostEngagement {
  likes: number;
  liked: boolean;
  comments: number;
}
