// src/types/api.types.ts

// ===== БАЗОВЫЕ ТИПЫ =====

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

export interface TrainerSport {
  sport_type_id: number;
  experience_years: number;
  sports_rank?: string | null;
}

export interface TrainerDetails {
  education_degree: string | null;
  career_since_date: string;
  sports: TrainerSport[];
}

export interface Profile {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_trainer: boolean;
  is_me: boolean;
  trainer_details?: TrainerDetails;
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

export interface SportType {
  sport_type_id: number;
  name: string;
}

export interface TrainerListItem {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_trainer: boolean;
  trainer_details: TrainerDetails | null;
}

// ===== AUTH ТИПЫ =====

export interface AuthResponse {
  user: User;
}

export interface CsrfResponse {
  csrf_token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ClientRegisterRequest {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
}

export interface TrainerRegisterRequest {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
  trainer_details: {
    education_degree: string;
    career_since_date: string;
    sports: Array<{ sport_type_id: number; experience_years: number }>;
  };
}

// ===== PROFILE ТИПЫ =====

export interface UpdateProfileRequest {
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  trainer_details?: {
    education_degree?: string;
    career_since_date?: string;
    sports?: Array<{
      sport_type_id: number;
      experience_years: number;
      sports_rank?: string;
    }>;
  };
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

// ===== POSTS ТИПЫ =====

export interface CreatePostRequest {
  title: string;
  text_content: string;
  min_tier_id?: number | null;
  attachments?: Array<{ kind: string; file_url: string }>;
}

export interface UpdatePostRequest {
  title?: string;
  text_content?: string;
  attachments?: Array<{ kind: string; file_url: string }>;
}

export interface PostLikeResponse {
  is_liked: boolean;
  likes_count: number;
  post_id: number;
}

export interface ProfilePostsResponse {
  posts: PostListItem[];
  user_id: number;
}

// ===== DONATION ТИПЫ =====

export interface CreateDonationRequest {
  amount_value: number;
  currency: string;
  message: string | null;
}

export interface DonationResponse {
  amount_value: number;
  created_at: string;
  currency: string;
  donation_id: number;
  message: string;
  recipient_user_id: number;
  sender_user_id: number;
}

// ===== TRAINERS ТИПЫ =====

export interface GetTrainersResponse {
  trainers: TrainerListItem[];
}

// ===== SPORT TYPES ТИПЫ =====

export interface SportTypesResponse {
  sport_types: SportType[];
}

// ===== ERROR ТИПЫ =====

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Array<{ field: string; message: string }>;
  };
}
