// src/types/api.types.ts

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

export interface AuthResponse {
  user: User;
}

export interface CSRFTokenResponse {
  csrf_token: string;
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

export interface PostLikeResponse {
  post_id: number;
  is_liked: boolean;
  likes_count: number;
}

export interface TrainerSport {
  sport_type_id: number;
  experience_years: number;
  sports_rank?: string;
}

export interface TrainerDetails {
  education_degree?: string;
  career_since_date: string;
  sports: TrainerSport[];
}

export interface TrainerListItem extends User {
  is_trainer: boolean;
  trainer_details?: TrainerDetails;
}

export interface Profile extends User {
  is_me: boolean;
  trainer_details?: TrainerDetails;
}

export interface SportType {
  sport_type_id: number;
  name: string;
}

export interface DonationResponse {
  donation_id: number;
  sender_user_id: number;
  recipient_user_id: number;
  amount_value: number;
  currency: string;
  message: string;
  created_at: string;
}

export interface UpdateProfilePayload {
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  trainer_details?: TrainerDetails;
}

export interface PostContentBlock {
  type: 'text' | 'attachment';
  content: string;      // текст или URL аттача
  attachment_id?: number;
  file_url?: string;
  kind?: 'image' | 'video';
}
