// src/types/components.types.ts

import type { ApiClient } from '../utils/api';
import type { User } from './api.types';
export interface ButtonConfig {
  text: string;
  variant?: 'primary-orange' | 'secondary-blue' | 'text-orange' | 'text-blue';
  state?: 'normal' | 'hover' | 'active' | 'disabled';
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: string | null;
  ariaLabel?: string | null;
  onClick?: (e: MouseEvent) => void | Promise<void>;
  onHover?: () => void;
  onLeave?: () => void;
}

export interface InputConfig {
  type?: 'mail' | 'password' | 'name' | 'without';
  label?: string;
  placeholder?: string;
  value?: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  maxlength?: number;
  autocomplete?: string;
  onChange?: (value: string) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  showEye?: boolean;
}

export interface AvatarConfig {
  src: string | null;
  name: string;
  alt?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  userId?: number | null;
  onClick?: (user: { userId: number | null; name: string; src: string | null }) => void;
  ariaLabel?: string;
}

export interface PostCardProps {
  post_id: number;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  likes: number;
  liked: boolean;
  comments: number;
  can_view: boolean;
  raw_text: string;
  isOwner: boolean;
  api: ApiClient;
  onPostsUpdated?: () => Promise<void>;
}

export interface ProfileHeaderProps {
  name: string;
  role: string;
  avatar: string | null;
  isOwnProfile: boolean;
  api: ApiClient;
  showDonate: boolean;
  onDonate: () => void;
}

export interface SidebarUser {
  id: number;
  name: string;
  role: string;
  avatar: string | null;
}

export interface SidebarProps {
  activePage: 'home' | 'profile' | 'feed' | 'workouts' | 'messenger' | 'notifications' | 'settings';
  currentUser: SidebarUser | null;
  users: SidebarUser[];
  api: ApiClient;
  onLogout: (() => Promise<void>) | null;
}

export interface SportTypeFieldOption {
  sport_type_id: number;
  name: string;
}

export interface SportTypeFieldConfig {
  label: string;
  placeholder: string;
  required: boolean;
  options: SportTypeFieldOption[];
  onChange: (values: number[]) => void;
}

export interface SportTypeFieldApi {
  element: HTMLElement;
  input: HTMLElement;
  setValue: (values: number[]) => void;
  getValue: () => number[];
  focus: () => void;
  blur: () => void;
  setError: (text: string) => void;
  setNormal: () => void;
  clearError: () => void;
}

export interface AuthFormConfig {
  mode: 'login' | 'register-client' | 'register-trainer';
  api: ApiClient;
  onSubmit: (data: Record<string, unknown>, mode: string) => Promise<void>;
  onSwitchMode: (mode: string) => void;
}

export interface PostFormModalOptions {
  api: ApiClient;
  mode: 'create' | 'edit';
  postId?: number;
  initial?: {
    title?: string;
    text_content?: string;
    raw_text?: string;
  };
  onSaved?: () => void;
}

export interface DonationModalOptions {
  api: ApiClient;
  recipientUserId: number;
}

export interface ProfileEditModalOptions {
  api: ApiClient;
  currentUser: { user: User } | unknown;
  onUpdated?: () => void;
}
