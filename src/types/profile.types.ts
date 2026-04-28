import type { User } from './auth.types';

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

export interface Profile extends User {
  is_me: boolean;
  trainer_details?: TrainerDetails;
}

export interface UpdateProfilePayload {
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
