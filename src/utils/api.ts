// src/utils/api.ts

import { API_BASE_URL } from '../config/constants';
import type {
  AuthResponse,
  Profile,
  Post,
  PostListItem,
  PostBlockInput,
  PostLikeResponse,
  TrainerListItem,
  TrainerDetails,
  SportType,
  DonationResponse,
  CSRFTokenResponse,
  Tier,
  Subscription
} from '../types/api.types';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}

export function translateErrorMessage(message: string): string {
  if (!message) return 'Неизвестная ошибка';
  const lower = message.toLowerCase();
  if (lower.includes('internal error')) return 'Внутренняя ошибка сервера';
  if (lower.includes('only client can perform this action')) return 'Только клиенты могут выполнить это действие';
  if (lower.includes('tier not found')) return 'Уровень подписки не найден';
  if (lower.includes('already subscribed')) return 'Вы уже подписаны на этого тренера';
  if (lower.includes('subscription not found')) return 'Подписка не найдена';
  if (lower.includes('invalid tier id')) return 'Некорректный ID уровня подписки';
  if (lower.includes('forbidden')) return 'Доступ запрещён';
  if (lower.includes('not found')) return 'Ресурс не найден';
  if (lower.includes('unauthorized')) return 'Необходима авторизация';
  if (lower.includes('email already exists') || lower.includes('email already taken')) {
    return 'Пользователь с таким email уже существует';
  }
  if (lower.includes('email already exists')) return 'Пользователь с таким email уже существует';
  if (lower.includes('username already exists') || lower.includes('username already taken')) {
    return 'Имя пользователя уже занято';
  }
  if (lower.includes('invalid credentials')) return 'Неверный email или пароль';
  if (lower.includes('password')) return 'Неверный пароль';
  return message;
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
    } catch {
      // игнорируем
    }
    return null;
  }

  async ensureCsrfToken(): Promise<string | null> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    return this.fetchCsrfToken();
  }

  async refreshCsrfToken(): Promise<string | null> {
    this.csrfToken = null;
    return this.fetchCsrfToken();
  }

  /**
   * Проверяет, является ли ошибка проблемой с CSRF-токеном
   */
  private isCsrfError(data: unknown): boolean {
    const errorData = data as { error?: { code?: string; message?: string } };
    const code = errorData?.error?.code;
    const message = errorData?.error?.message || '';
    return code === 'forbidden' && message.toLowerCase().includes('csrf');
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retryOnCsrf = true): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const headers: Record<string, string> = {};

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    Object.assign(headers, options.headers as Record<string, string>);

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

    let data: T;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json() as T;
    } else {
      const text = await response.text();
      throw new Error(`Сервер вернул не JSON (${response.status}): ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      // При ошибке CSRF пробуем обновить токен и повторить запрос один раз
      if (retryOnCsrf && isMutating && this.isCsrfError(data)) {
        await this.refreshCsrfToken();
        // Повторяем запрос, но без дальнейших повторных попыток, чтобы избежать бесконечного цикла
        return this.request<T>(endpoint, options, false);
      }

      const errorData = data as { error?: { message?: string; code?: string } };
      let errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
      errorMessage = translateErrorMessage(errorMessage);
      const error = new Error(errorMessage);
      (error as Error & { data: T }).data = data;
      throw error;
    }

    return data;
  }

  // ========== AUTH ENDPOINTS ==========

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

  // ========== PROFILE ENDPOINTS ==========

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

  async getTrainers(params?: {
    query?: string;
    sport_type_ids?: number[];
    limit?: number;
    offset?: number;
    min_experience_years?: number;
    max_experience_years?: number;
    only_with_rank?: boolean;
  }): Promise<{ trainers: TrainerListItem[] }> {
    const searchParams = new URLSearchParams();

    if (params) {
      if (params.query) searchParams.set('query', params.query);
      if (params.sport_type_ids?.length) {
        params.sport_type_ids.forEach(id => searchParams.append('sport_type_ids', String(id)));
      }
      if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
      if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
      if (params.min_experience_years !== undefined) searchParams.set('min_experience_years', String(params.min_experience_years));
      if (params.max_experience_years !== undefined) searchParams.set('max_experience_years', String(params.max_experience_years));
      if (params.only_with_rank !== undefined) searchParams.set('only_with_rank', String(params.only_with_rank));
    }

    const query = searchParams.toString();
    return this.request<{ trainers: TrainerListItem[] }>(
      `/v1/trainers${query ? `?${query}` : ''}`
    );
  }

  async searchTrainers(params: {
    query?: string;
    sport_type_ids?: number[];
    limit?: number;
    offset?: number;
    min_experience_years?: number;
    max_experience_years?: number;
    only_with_rank?: boolean;
  }): Promise<{ trainers: TrainerListItem[] }> {
    await this.ensureCsrfToken();
    return this.request<{ trainers: TrainerListItem[] }>('/v1/trainers:search', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async getUserPosts(userId: number): Promise<{ posts: PostListItem[]; user_id: number }> {
    return this.request<{ posts: PostListItem[]; user_id: number }>(
      `/v1/profiles/${userId}/posts`
    );
  }

  // ========== POST ENDPOINTS ==========

  async getPost(postId: number): Promise<Post> {
    return this.request<Post>(`/v1/posts/${postId}`);
  }

  async createPost(payload: {
    title: string;
    blocks: PostBlockInput[];
    min_tier_id?: number;
    sport_type_id?: number;
  }): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>('/v1/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updatePost(postId: number, payload: {
    title?: string;
    blocks?: PostBlockInput[];
    min_tier_id?: number;
    sport_type_id?: number;
    clear_min_tier_id?: boolean;
    clear_sport_type_id?: boolean;
    replace_blocks?: boolean;
  }): Promise<Post> {
    await this.ensureCsrfToken();
    return this.request<Post>(`/v1/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async uploadPostMedia(file: File): Promise<{ file_url: string; content_type: string; kind: string; size_bytes: number }> {
    // Будем повторять при ошибке CSRF максимум один раз
    let attempt = 0;
    while (true) {
      await this.ensureCsrfToken();

      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
      headers['Accept'] = 'application/json';

      const response = await fetch(`${this.baseURL}/v1/posts/media`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          // не JSON
        }

        if (attempt === 0 && this.isCsrfError(errorData)) {
          // CSRF ошибка, обновляем токен и пробуем ещё раз
          await this.refreshCsrfToken();
          attempt++;
          continue;
        }

        const errorMessage = errorData?.error?.message || errorData?.message || `HTTP ${response.status}`;
        throw new Error(translateErrorMessage(errorMessage));
      }

      return response.json();
    }
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

  async searchPosts(params: {
    query?: string;
    trainer_ids?: number[];
    sport_type_ids?: number[];
    min_tier_id?: number;
    max_tier_id?: number;
    block_kinds?: string[];
    only_available?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ posts: PostListItem[] }> {
    await this.ensureCsrfToken();
    return this.request<{ posts: PostListItem[] }>('/v1/posts:search', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  // ========== TIER ENDPOINTS ==========

  async getTiers(): Promise<{ tiers: Tier[] }> {
    return this.request<{ tiers: Tier[] }>('/v1/tiers');
  }

  async createTier(data: {
    name: string;
    price: number;
    description?: string;
  }): Promise<Tier> {
    await this.ensureCsrfToken();
    return this.request<Tier>('/v1/tiers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTier(tierId: number, data: {
    name?: string;
    price?: number;
    description?: string;
    clear_description?: boolean;
  }): Promise<Tier> {
    await this.ensureCsrfToken();
    return this.request<Tier>(`/v1/tiers/${tierId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteTier(tierId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/tiers/${tierId}`, { method: 'DELETE' });
  }

  // ========== SPORT TYPES ==========

  async getSportTypes(): Promise<{ sport_types: SportType[] }> {
    return this.request<{ sport_types: SportType[] }>('/v1/sport-types');
  }

  // ========== DONATION ==========

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

  // ========== AVATAR ==========

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    let attempt = 0;
    while (true) {
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
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {}

        if (attempt === 0 && this.isCsrfError(errorData)) {
          await this.refreshCsrfToken();
          attempt++;
          continue;
        }

        const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
        throw new Error(translateErrorMessage(errorMessage));
      }

      return response.json();
    }
  }

  async deleteAvatar(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request('/v1/profiles/me/avatar', { method: 'DELETE' });
  }

  // ========== SUBSCRIPTION ENDPOINTS ==========

  async getTrainerTiers(trainerId: number): Promise<{ tiers: Tier[] }> {
    return this.request<{ tiers: Tier[] }>(`/v1/trainers/${trainerId}/tiers`);
  }

  async subscribeToTrainer(trainerId: number, tierId: number): Promise<Subscription> {
    await this.ensureCsrfToken();
    return this.request<Subscription>(`/v1/trainers/${trainerId}/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ tier_id: tierId })
    });
  }

  async updateSubscription(subscriptionId: number, tierId: number): Promise<Subscription> {
    await this.ensureCsrfToken();
    return this.request<Subscription>(`/v1/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ tier_id: tierId })
    });
  }

  async getMySubscriptions(): Promise<{ subscriptions: Subscription[] }> {
    return this.request<{ subscriptions: Subscription[] }>('/v1/subscriptions/me');
  }

  async cancelSubscription(subscriptionId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }
}
