/**
 * @fileoverview API клиент для взаимодействия с бэкендом
 * Поддерживает CSRF-токены для защищённых эндпоинтов
 *
 * @module src/utils/api
 */

import { API_BASE_URL } from '../config/constants';

// Импорты типов
import type {
  AuthResponse,
  ClientRegisterRequest,
  TrainerRegisterRequest,
  Profile,
  TrainerListItem,
  PostListItem,
  Post,
  CreatePostRequest,
  UpdatePostRequest,
  PostLikeResponse,
  SportType,
  AvatarUploadResponse,
  UpdateProfileRequest,
  CsrfResponse,
  GetTrainersResponse,
  ProfilePostsResponse,
  SportTypesResponse,
  CreateDonationRequest,
  DonationResponse
} from '../types/api.types';

export class ApiClient {
  private baseURL: string;
  private csrfToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Получение CSRF-токена с бэкенда
   * @returns {Promise<string|null>}
   */
  async fetchCsrfToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseURL}/v1/auth/csrf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as CsrfResponse;
        this.csrfToken = data.csrf_token;
        console.log('CSRF Token fetched:', this.csrfToken ? '✅' : '❌');
        return this.csrfToken;
      } else {
        console.error('CSRF fetch failed:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
    return null;
  }

  /**
   * Убедиться, что CSRF-токен получен
   * @returns {Promise<string|null>}
   */
  async ensureCsrfToken(): Promise<string | null> {
    await this.fetchCsrfToken();
    return this.csrfToken;
  }

  /**
   * Парсинг ответа от сервера
   */
  private async parseResponse<T>(response: Response): Promise<T | { error: { message: string } }> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json() as T;
    }
    const text = await response.text();
    return { error: { message: text || `HTTP ${response.status}` } };
  }

  /**
   * Базовый метод для выполнения HTTP запросов
   */
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

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers
      });

      if (response.status === 403 && isMutating) {
        await this.fetchCsrfToken();
        if (this.csrfToken) {
          headers['X-CSRF-Token'] = this.csrfToken;
          const retryResponse = await fetch(url, {
            ...options,
            credentials: 'include',
            headers
          });

          if (retryResponse.status === 204) {
            return null as T;
          }

          const retryData = await this.parseResponse<T>(retryResponse);
          if (!retryResponse.ok) {
            const error = new Error((retryData as any)?.error?.message || `HTTP ${retryResponse.status}`);
            (error as any).data = retryData;
            (error as any).status = retryResponse.status;
            throw error;
          }
          return retryData as T;
        }
      }

      if (response.status === 204) {
        return null as T;
      }

      const data = await this.parseResponse<T>(response);

      if (!response.ok) {
        const error = new Error((data as any)?.error?.message || `HTTP ${response.status}`);
        (error as any).data = data;
        (error as any).status = response.status;
        throw error;
      }

      return data as T;
    } catch (error) {
      throw error;
    }
  }

  // ===== AUTH METHODS =====

  async login(email: string, password: string): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    const response = await this.request<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (response?.user) {
      await this.fetchCsrfToken();
    }
    return response;
  }

  async registerClient(userData: ClientRegisterRequest): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    const response = await this.request<AuthResponse>('/v1/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (response?.user) {
      await this.fetchCsrfToken();
    }
    return response;
  }

  async registerTrainer(userData: TrainerRegisterRequest): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    const response = await this.request<AuthResponse>('/v1/auth/register/trainer', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (response?.user) {
      await this.fetchCsrfToken();
    }
    return response;
  }

  async getCurrentUser(): Promise<AuthResponse | null> {
    try {
      return await this.request<AuthResponse>('/v1/auth/me');
    } catch (error) {
      const err = error as Error & { status?: number };
      if (err.message === 'Не авторизован' || err.status === 401) {
        return null;
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request<void>('/v1/auth/logout', { method: 'POST' });
    this.csrfToken = null;
  }

  // ===== PROFILE METHODS =====

  async getProfile(userId: number): Promise<Profile> {
    return this.request<Profile>(`/v1/profiles/${userId}`);
  }

  async getTrainers(): Promise<GetTrainersResponse> {
    return this.request<GetTrainersResponse>('/v1/trainers');
  }

  async getUserPosts(userId: number): Promise<ProfilePostsResponse> {
    return this.request<ProfilePostsResponse>(`/v1/profiles/${userId}/posts`);
  }

  async updateMyProfile(payload: UpdateProfileRequest): Promise<Profile> {
    await this.ensureCsrfToken();
    return this.request<Profile>('/v1/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  // ===== POSTS METHODS =====

  async getPost(postId: number): Promise<Post> {
    return this.request<Post>(`/v1/posts/${postId}`);
  }

  async createPost(payload: CreatePostRequest): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>('/v1/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updatePost(postId: number, payload: UpdatePostRequest): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>(`/v1/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async deletePost(postId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request<void>(`/v1/posts/${postId}`, { method: 'DELETE' });
  }

  async likePost(postId: number): Promise<PostLikeResponse> {
    await this.ensureCsrfToken();
    return this.request<PostLikeResponse>(`/v1/posts/${postId}/likes`, { method: 'POST' });
  }

  async unlikePost(postId: number): Promise<PostLikeResponse> {
    await this.ensureCsrfToken();
    return this.request<PostLikeResponse>(`/v1/posts/${postId}/likes`, { method: 'DELETE' });
  }

  // ===== DONATIONS =====

  async createDonation(
    userId: number,
    amountValue: number,
    currency: string = 'RUB',
    message: string | null = null
  ): Promise<DonationResponse> {
    await this.ensureCsrfToken();
    const payload: CreateDonationRequest = {
      amount_value: amountValue,
      currency: currency,
      message: message || null
    };
    return this.request<DonationResponse>(`/v1/profiles/${userId}/donations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ===== SPORT TYPES =====

  async getSportTypes(): Promise<SportTypesResponse> {
    return this.request<SportTypesResponse>('/v1/sport-types');
  }

  // ===== AVATAR =====

  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
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
      const error = new Error(`HTTP ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    return await response.json() as AvatarUploadResponse;
  }

  async deleteAvatar(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request<void>('/v1/profiles/me/avatar', { method: 'DELETE' });
  }
}
