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

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterClientData {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
}

export interface TrainerSportInput {
  sport_type_id: number;
  experience_years: number;
  sports_rank?: string | null;
}

export interface TrainerDetailsInput {
  education_degree: string;
  career_since_date: string;
  sports: TrainerSportInput[];
}

export interface RegisterTrainerData extends RegisterClientData {
  trainer_details: TrainerDetailsInput;
}
