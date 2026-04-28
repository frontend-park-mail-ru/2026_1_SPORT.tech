export interface User {
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
}

export interface PostAttachment {
  post_attachment_id: number;
  kind: string;
  file_url: string;
}

export interface Post {
  post_id: number;
  title: string;
  text_content: string;
  trainer_id: number;
  created_at: string;
  updated_at: string;
  min_tier_id: number | null;
  is_liked: boolean;
  likes_count: number;
  attachments?: PostAttachment[];
}

export interface PostListItem {
  post_id: number;
  title: string;
  trainer_id: number;
  created_at: string;
  min_tier_id: number | null;
  is_liked: boolean;
  likes_count: number;
  can_view: boolean;
}

export interface AuthResponse {
  user: User;
}

export interface Profile extends User {
  is_me: boolean;
  trainer_details?: {
    education_degree: string | null;
    career_since_date: string;
    sports: Array<{
      sport_type_id: number;
      experience_years: number;
      sports_rank: string | null;
    }>;
  };
}
