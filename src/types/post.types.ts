// src/types/post.types.ts

export interface ContentBlockForPost {
  type: 'text' | 'attachment';
  content?: string;
  file_url?: string;
  kind?: string;
}

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
  sport_type_id?: number | null;
  sport_type?: string;
  tier_name?: string;      // название уровня подписки
  tier_price?: number;      // цена уровня (0 = бесплатно)
  contentBlocks?: ContentBlockForPost[];
  attachments?: PostAttachmentCompat[];
  isOwner?: boolean;
}

export interface PostAttachmentCompat {
  post_attachment_id: number;
  kind: string;
  file_url: string;
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
