// src/utils/api.ts
import { API_BASE_URL } from '../config/constants';
import type {
  AuthResponse,
  Profile,
  Post,
  PostListItem,
  PostLikeResponse,
  TrainerListItem,
  TrainerDetails,
  SportType,
  DonationResponse,
  CSRFTokenResponse
} from '../types/api.types';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}

export class ApiClient {
  private baseURL: string;
  private csrfToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async fetchCsrfToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseURL}/v1/auth/csrf`, {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json() as CSRFTokenResponse;
        this.csrfToken = data.csrf_token;
        return this.csrfToken;
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
    return null;
  }

  async ensureCsrfToken(): Promise<string | null> {
    await this.fetchCsrfToken();
    return this.csrfToken;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (isMutating) {
      await this.ensureCsrfToken();
      if (this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });

    if (response.status === 204) {
      return null as T;
    }

    const data = await response.json() as T;

    if (!response.ok) {
      const errorData = data as { error?: { message?: string } };
      const error = new Error(
        errorData?.error?.message || `HTTP ${response.status}`
      );
      (error as Error & { data: T }).data = data;
      throw error;
    }

    return data;
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    return this.request<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async logout(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request('/v1/auth/logout', { method: 'POST' });
    this.csrfToken = null;
  }

  async getCurrentUser(): Promise<AuthResponse | null> {
    try {
      return await this.request<AuthResponse>('/v1/auth/me');
    } catch {
      return null;
    }
  }

  async registerClient(data: {
    username: string;
    email: string;
    password: string;
    password_repeat: string;
    first_name: string;
    last_name: string;
  }): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    return this.request<AuthResponse>('/v1/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async registerTrainer(data: {
    username: string;
    email: string;
    password: string;
    password_repeat: string;
    first_name: string;
    last_name: string;
    trainer_details: TrainerDetails;
  }): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    return this.request<AuthResponse>('/v1/auth/register/trainer', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Profile endpoints
  async getProfile(userId: number): Promise<Profile> {
    return this.request<Profile>(`/v1/profiles/${userId}`);
  }

  async updateMyProfile(data: {
    username?: string;
    first_name?: string;
    last_name?: string;
    bio?: string;
    trainer_details?: TrainerDetails;
  }): Promise<Profile> {
    await this.ensureCsrfToken();
    return this.request<Profile>('/v1/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async getTrainers(): Promise<{ trainers: TrainerListItem[] }> {
    return this.request<{ trainers: TrainerListItem[] }>('/v1/trainers');
  }

  async getUserPosts(userId: number): Promise<{ posts: PostListItem[]; user_id: number }> {
    return this.request<{ posts: PostListItem[]; user_id: number }>(
      `/v1/profiles/${userId}/posts`
    );
  }

  // Post endpoints
  async getPost(postId: number): Promise<Post> {
    return this.request<Post>(`/v1/posts/${postId}`);
  }

  async createPost(payload: {
  title: string;
  text_content?: string;
  content_blocks?: Array<{
    type: string;
    content: string;
    kind?: string;
  }>;
  sport_type_id?: number;
  min_tier_id?: number;
}): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>('/v1/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updatePost(postId: number, payload: {
  title?: string;
  text_content?: string;
  content_blocks?: Array<{
    type: string;
    content: string;
    kind?: string;
  }>;
  sport_type_id?: number;
  min_tier_id?: number;
}): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>(`/v1/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async deletePost(postId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/posts/${postId}`, { method: 'DELETE' });
  }

  async likePost(postId: number): Promise<PostLikeResponse> {
    await this.ensureCsrfToken();
    return this.request<PostLikeResponse>(`/v1/posts/${postId}/likes`, {
      method: 'POST'
    });
  }

  async unlikePost(postId: number): Promise<PostLikeResponse> {
    await this.ensureCsrfToken();
    return this.request<PostLikeResponse>(`/v1/posts/${postId}/likes`, {
      method: 'DELETE'
    });
  }

  // Sport types
  async getSportTypes(): Promise<{ sport_types: SportType[] }> {
    return this.request<{ sport_types: SportType[] }>('/v1/sport-types');
  }

  // Donation
  async createDonation(
    recipientUserId: number,
    amountValue: number,
    currency: string = 'RUB',
    message: string = 'Пожертвование'
  ): Promise<DonationResponse> {
    await this.ensureCsrfToken();
    return this.request<DonationResponse>(
      `/v1/profiles/${recipientUserId}/donations`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount_value: amountValue,
          currency,
          message
        })
      }
    );
  }

  // Avatar
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    await this.ensureCsrfToken();
    const formData = new FormData();
    formData.append('avatar', file);

    const headers: Record<string, string> = {};
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${this.baseURL}/v1/profiles/me/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as { error?: { message?: string } }));
      throw new Error(
        errorData?.error?.message || `HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async deleteAvatar(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request('/v1/profiles/me/avatar', { method: 'DELETE' });
  }
}
