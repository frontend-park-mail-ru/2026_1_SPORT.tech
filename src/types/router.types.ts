import type { AuthResponse } from './auth.types';

export interface Router {
  handleRouting: () => Promise<void>;
  navigateTo: (path: string) => void;
  setCurrentUser: (user: AuthResponse | null) => void;
  getCurrentUser: (options?: { force: boolean }) => Promise<AuthResponse | null>;
}

export interface CurrentUser {
  user: {
    user_id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    bio: string | null;
    is_trainer: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
  };
}
