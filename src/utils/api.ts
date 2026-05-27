// src/utils/api.ts

import { API_BASE_URL } from '../config/constants';
import { getFriendlyErrorMessage } from './errorMessages';
import type {
  AuthResponse,
  Profile,
  Post,
  PostListItem,
  PostBlockInput,
  PostLikeResponse,
  PostLike,
  TrainerListItem,
  TrainerDetails,
  SportType,
  DonationResponse,
  CSRFTokenResponse,
  Tier,
  Subscription,
  Comment,
  StatisticsResponse,
  BalanceResponse,
  Notification,
  PaymentResponse,
  Subscriber,
  Measurement,
  ListDonationsResponse,
  ChatMessage,
  ChatConversation,
  MeetingAvailabilityRule,
  MeetingSlot,
  MeetingAvailabilitySlot,
  MeetingBooking
} from '../types/api.types';

const OFFLINE_API_CACHE_PREFIX = 'sporteon_api_cache:v1:';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}

export class ApiClient {
  private baseURL: string;
  private csrfToken: string | null = null;
  private csrfTokenRequest: Promise<string | null> | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private serializeRequestBody(body: BodyInit | null | undefined): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    return '';
  }

  private getOfflineCacheKey(method: string, endpoint: string, body: BodyInit | null | undefined): string {
    return `${OFFLINE_API_CACHE_PREFIX}${method}:${this.baseURL}${endpoint}:${this.serializeRequestBody(body)}`;
  }

  private isOfflineCacheableRequest(method: string, endpoint: string): boolean {
    if (endpoint.startsWith('/v1/auth/')) return false;
    if (method === 'GET') return true;
    return method === 'POST' && (
      endpoint === '/v1/posts:search' ||
      endpoint === '/v1/trainers:search'
    );
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) return true;
    if (!(error instanceof Error)) return false;
    return /Failed to fetch|NetworkError|Load failed/i.test(error.message);
  }

  private isBrowserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private normalizeStorageUrl(value: string): string {
    if (value.startsWith('/avatars/') || value.startsWith('/post-media/')) {
      return value;
    }

    try {
      const url = new URL(value);
      const isStoragePath = url.pathname.startsWith('/avatars/') || url.pathname.startsWith('/post-media/');
      const isKnownStorageHost = ['localhost', '127.0.0.1', 'minio', 'sporteon.ru', 'www.sporteon.ru'].includes(url.hostname);
      if (isStoragePath && isKnownStorageHost) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Не URL — оставляем строку как есть.
    }

    return value;
  }

  private normalizeStorageUrls<T>(value: T): T {
    if (typeof value === 'string') {
      return this.normalizeStorageUrl(value) as T;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.normalizeStorageUrls(item)) as T;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      Object.keys(record).forEach(key => {
        record[key] = this.normalizeStorageUrls(record[key]);
      });
    }

    return value;
  }

  private readOfflineCache<T>(cacheKey: string): T | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw) as { data?: T };
      return Object.prototype.hasOwnProperty.call(cached, 'data') ? this.normalizeStorageUrls(cached.data as T) : null;
    } catch {
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  private readCachedUser(): AuthResponse | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) as AuthResponse : null;
    } catch {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('cached_user');
      return null;
    }
  }

  private writeCachedUser(response: AuthResponse): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('cached_user', JSON.stringify(this.normalizeStorageUrls(response)));
  }

  private getCachedOwnProfile(userId: number): Profile | null {
    const cached = this.readCachedUser();
    if (!cached?.user || cached.user.user_id !== userId) return null;

    return this.normalizeStorageUrls({
      ...cached.user,
      is_me: true
    } as Profile);
  }

  private updateCachedUserFromProfile(profile: Profile): void {
    const cached = this.readCachedUser();
    if (!cached?.user || cached.user.user_id !== profile.user_id) return;

    this.writeCachedUser({
      user: {
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        is_trainer: profile.is_trainer,
        is_admin: profile.is_admin,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    });
  }

  private writeOfflineCache<T>(cacheKey: string, data: T): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        saved_at: new Date().toISOString(),
        data
      }));
    } catch (error) {
      console.warn('[API] Failed to write offline cache:', error);
    }
  }

  private clearOfflineCache(): void {
    if (typeof localStorage === 'undefined') return;

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(OFFLINE_API_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(prefix));

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }

  async fetchCsrfToken(): Promise<string | null> {
    if (this.csrfTokenRequest) {
      return this.csrfTokenRequest;
    }

    this.csrfTokenRequest = (async () => {
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
      } finally {
        this.csrfTokenRequest = null;
      }
      return null;
    })();

    return this.csrfTokenRequest;
  }

  async ensureCsrfToken(): Promise<string | null> {
    const cookieToken = this.getCookie('csrf_token');
    if (cookieToken) {
      this.csrfToken = cookieToken;
      return this.csrfToken;
    }

    if (this.csrfToken) {
      return this.csrfToken;
    }

    return this.fetchCsrfToken();
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isOfflineCacheable = this.isOfflineCacheableRequest(method, endpoint);
    const offlineCacheKey = isOfflineCacheable
      ? this.getOfflineCacheKey(method, endpoint, options.body)
      : null;

    if (offlineCacheKey && this.isBrowserOffline()) {
      const cached = this.readOfflineCache<T>(offlineCacheKey);
      if (cached !== null) {
        return cached;
      }
      throw new TypeError('Нет соединения. Попробуйте повторить, когда сеть появится.');
    }

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

    try {
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
        data = this.normalizeStorageUrls(data);
      } else {
        const text = await response.text();
        console.error('[API] Non-JSON response:', text.substring(0, 500));
        throw new Error(getFriendlyErrorMessage(
          `Сервер вернул не JSON (${response.status}): ${text.substring(0, 200)}`,
          'Сервер временно недоступен. Попробуйте позже.'
        ));
      }

      if (!response.ok) {
        const errorData = data as { error?: { message?: string; code?: string } };
        const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
        console.error('[API] Error:', errorData);
        const error = new Error(getFriendlyErrorMessage(errorMessage, 'Не удалось выполнить запрос. Попробуйте ещё раз.'));
        (error as Error & { data: T; rawMessage: string; status: number }).data = data;
        (error as Error & { rawMessage: string }).rawMessage = errorMessage;
        (error as Error & { status: number }).status = response.status;
        throw error;
      }

      if (offlineCacheKey) {
        this.writeOfflineCache(offlineCacheKey, data);
      }

      return data;
    } catch (error) {
      if (offlineCacheKey && this.isNetworkError(error)) {
        const cached = this.readOfflineCache<T>(offlineCacheKey);
        if (cached !== null) {
          return cached;
        }
      }
      if (this.isNetworkError(error)) {
        throw new TypeError(getFriendlyErrorMessage(error, 'Нет соединения. Попробуйте повторить, когда сеть появится.'));
      }
      throw error;
    }
  }

  // ========== AUTH ENDPOINTS ==========

  async login(email: string, password: string): Promise<AuthResponse> {
    await this.ensureCsrfToken();
    const response = await this.request<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    // Кэшируем после успешного входа
    if (response) {
      this.clearOfflineCache();
      this.writeCachedUser(response);
    }
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.ensureCsrfToken();
      await this.request('/v1/auth/logout', { method: 'POST' });
    } finally {
      this.csrfToken = null;
      if (typeof localStorage !== 'undefined') localStorage.removeItem('cached_user');
      this.clearOfflineCache();
    }
  }

  async getCurrentUser(): Promise<AuthResponse | null> {
    if (this.isBrowserOffline()) {
      return this.readCachedUser();
    }

    try {
      const user = await this.request<AuthResponse>('/v1/auth/me');
      // Кэшируем данные пользователя для работы в офлайн-режиме
      if (user) {
        this.writeCachedUser(user);
      }
      return user;
    } catch (err) {
      if (err instanceof TypeError) {
        // Сетевая ошибка (офлайн) — возвращаем закэшированного пользователя
        const cached = this.readCachedUser();
        if (cached) return cached;
      } else {
        // HTTP-ошибка (401, 403 и т.д.) — сессия истекла, чистим кэш
        if (typeof localStorage !== 'undefined') localStorage.removeItem('cached_user');
      }
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
    const response = await this.request<AuthResponse>('/v1/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (response) {
      this.clearOfflineCache();
      this.writeCachedUser(response);
    }
    return response;
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
    const response = await this.request<AuthResponse>('/v1/auth/register/trainer', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (response) {
      this.clearOfflineCache();
      this.writeCachedUser(response);
    }
    return response;
  }

  // ========== PROFILE ENDPOINTS ==========

  async getProfile(userId: number): Promise<Profile> {
    try {
      const profile = await this.request<Profile>(`/v1/profiles/${userId}`);
      if (profile.is_me) {
        this.updateCachedUserFromProfile(profile);
      }
      return profile;
    } catch (error) {
      if (this.isNetworkError(error)) {
        const cachedProfile = this.getCachedOwnProfile(userId);
        if (cachedProfile) return cachedProfile;
      }
      throw error;
    }
  }

  async getProfileByUsername(username: string): Promise<Profile> {
    const profile = await this.request<Profile>(`/v1/profiles/by-username/${encodeURIComponent(username)}`);
    if (profile.is_me) {
      this.updateCachedUserFromProfile(profile);
    }
    return profile;
  }

  async updateMyProfile(data: {
    username?: string;
    first_name?: string;
    last_name?: string;
    bio?: string;
    trainer_details?: TrainerDetails;
  }): Promise<Profile> {
    await this.ensureCsrfToken();
    const profile = await this.request<Profile>('/v1/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    this.updateCachedUserFromProfile(profile);
    return profile;
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
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error?.message || errorData?.message || errorMessage;
      } catch {
        // Если не JSON — используем статус
      }
      throw new Error(getFriendlyErrorMessage(errorMessage, 'Не удалось загрузить файл. Попробуйте ещё раз.'));
    }

    return response.json();
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

  async listPostLikes(postId: number): Promise<{ likes: PostLike[] }> {
    return this.request<{ likes: PostLike[] }>(`/v1/posts/${postId}/likes`);
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
    sort?: string;
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
    chat_enabled?: boolean;
    calendar_enabled?: boolean;
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
    chat_enabled?: boolean;
    calendar_enabled?: boolean;
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
    message: string = ''
  ): Promise<DonationResponse> {
    await this.ensureCsrfToken();
    const body: { amount_value: number; currency: string; message?: string } = {
      amount_value: amountValue,
      currency
    };
    const trimmed = message.trim();
    if (trimmed) body.message = trimmed;
    return this.request<DonationResponse>(
      `/v1/profiles/${recipientUserId}/donations`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );
  }

  // ========== AVATAR ==========

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
      throw new Error(getFriendlyErrorMessage(errorData?.error?.message || `HTTP ${response.status}`, 'Не удалось загрузить фото. Попробуйте ещё раз.'));
    }

    return response.json();
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

  async getMySubscribers(params?: { limit?: number; offset?: number }): Promise<{ subscribers: Subscriber[] }> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ subscribers: Subscriber[] }>(`/v1/subscribers/me${qs ? `?${qs}` : ''}`);
  }

  async cancelSubscription(subscriptionId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  // ========== COMMENTS ==========

  async getComments(postId: number): Promise<{ comments: Comment[] }> {
    return this.request<{ comments: Comment[] }>(`/v1/posts/${postId}/comments`);
  }

  async createComment(postId: number, body: string): Promise<{ comment: Comment }> {
    await this.ensureCsrfToken();
    return this.request<{ comment: Comment }>(`/v1/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  // ========== STATISTICS ==========

  async getMyReceivedDonations(params?: { limit?: number; offset?: number }): Promise<ListDonationsResponse> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<ListDonationsResponse>(`/v1/donations/received${qs ? `?${qs}` : ''}`);
  }

  async getMyStatistics(): Promise<StatisticsResponse> {
    return this.request<StatisticsResponse>('/v1/statistics/me');
  }

  async getMyBalance(): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('/v1/balance');
  }

  // ========== NOTIFICATIONS ==========

  async getNotifications(params?: { limit?: number; offset?: number }): Promise<{ notifications: Notification[] }> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ notifications: Notification[] }>(`/v1/notifications${qs ? `?${qs}` : ''}`);
  }

  async markNotificationRead(notificationId: number): Promise<{ notification: Notification }> {
    await this.ensureCsrfToken();
    return this.request<{ notification: Notification }>(`/v1/notifications/${notificationId}/read`, {
      method: 'PATCH'
    });
  }

  // ========== MEASUREMENTS ==========

  async createMeasurement(data: {
    measured_at: string; // "YYYY-MM-DD"
    weight_kg?: number | null;
    body_fat_pct?: number | null;
    chest_cm?: number | null;
    waist_cm?: number | null;
    hips_cm?: number | null;
    notes?: string | null;
  }): Promise<{ measurement: Measurement }> {
    await this.ensureCsrfToken();
    return this.request('/v1/measurements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMeasurements(userId: number, params?: { limit?: number; offset?: number }): Promise<{ measurements: Measurement[] }> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request(`/v1/profiles/${userId}/measurements${qs ? `?${qs}` : ''}`);
  }

  async deleteMeasurement(measurementId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/measurements/${measurementId}`, { method: 'DELETE' });
  }

  async getMeasurementSharing(): Promise<{ trainer_user_ids: number[] }> {
    return this.request<{ trainer_user_ids: number[] }>('/v1/measurements/sharing');
  }

  async setMeasurementSharing(trainerUserIds: number[]): Promise<void> {
    await this.request('/v1/measurements/sharing', {
      method: 'PUT',
      body: JSON.stringify({ trainer_user_ids: trainerUserIds }),
    });
  }

  // ========== PAYMENTS ==========

  async createDonationPayment(data: {
    user_id: number;
    amount_value: number;
    currency: string;
    message: string;
    return_url: string;
    cancel_url: string;
  }): Promise<PaymentResponse> {
    await this.ensureCsrfToken();
    const { message, ...rest } = data;
    const trimmed = message.trim();
    const payload = trimmed ? { ...rest, message: trimmed } : rest;
    return this.request<PaymentResponse>('/v1/payments/donations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async createSubscriptionPayment(data: {
    trainer_id: number;
    tier_id: number;
    return_url: string;
    cancel_url: string;
  }): Promise<PaymentResponse> {
    await this.ensureCsrfToken();
    return this.request<PaymentResponse>('/v1/payments/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async confirmPayment(paymentId: number, confirmationToken: string): Promise<PaymentResponse> {
    await this.ensureCsrfToken();
    return this.request<PaymentResponse>(`/v1/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmation_token: confirmationToken })
    });
  }

  // ========== CHAT ==========

  async sendChatMessage(receiverUserId: number, body: string): Promise<ChatMessage> {
    await this.ensureCsrfToken();
    return this.request<ChatMessage>('/v1/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ receiver_user_id: receiverUserId, body })
    });
  }

  async listChatMessages(otherUserId: number, params?: { limit?: number; offset?: number }): Promise<{ messages: ChatMessage[] }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ messages: ChatMessage[] }>(`/v1/chat/messages/${otherUserId}${qs}`);
  }

  async listChatConversations(): Promise<{ conversations: ChatConversation[] }> {
    return this.request<{ conversations: ChatConversation[] }>('/v1/chat/conversations');
  }

  async markChatMessageRead(messageId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/chat/messages/${messageId}/read`, { method: 'PATCH', body: '{}' });
  }

  // ========== MEETINGS ==========

  async listMyAvailabilityRules(): Promise<{ rules: MeetingAvailabilityRule[] }> {
    return this.request<{ rules: MeetingAvailabilityRule[] }>('/v1/meetings/availability/rules');
  }

  async createAvailabilityRule(weekday: number, startHour: number): Promise<MeetingAvailabilityRule> {
    await this.ensureCsrfToken();
    return this.request<MeetingAvailabilityRule>('/v1/meetings/availability/rules', {
      method: 'POST',
      body: JSON.stringify({ weekday, start_hour: startHour })
    });
  }

  async deleteAvailabilityRule(ruleId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/meetings/availability/rules/${ruleId}`, { method: 'DELETE' });
  }

  async listMyAvailabilitySlots(): Promise<{ slots: MeetingSlot[] }> {
    return this.request<{ slots: MeetingSlot[] }>('/v1/meetings/availability/slots');
  }

  async createAvailabilitySlot(startsAt: string): Promise<MeetingSlot> {
    await this.ensureCsrfToken();
    return this.request<MeetingSlot>('/v1/meetings/availability/slots', {
      method: 'POST',
      body: JSON.stringify({ starts_at: startsAt })
    });
  }

  async deleteAvailabilitySlot(slotId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/meetings/availability/slots/${slotId}`, { method: 'DELETE' });
  }

  async getTrainerAvailability(trainerId: number, params?: { from?: string; to?: string }): Promise<{ slots: MeetingAvailabilitySlot[] }> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ slots: MeetingAvailabilitySlot[] }>(`/v1/trainers/${trainerId}/meetings/availability${qs}`);
  }

  async bookMeeting(trainerId: number, startsAt: string): Promise<MeetingBooking> {
    await this.ensureCsrfToken();
    return this.request<MeetingBooking>(`/v1/trainers/${trainerId}/meetings/book`, {
      method: 'POST',
      body: JSON.stringify({ starts_at: startsAt })
    });
  }

  async assignMeeting(data: { client_user_id: number; starts_at: string; duration_hours: number; note?: string }): Promise<MeetingBooking> {
    await this.ensureCsrfToken();
    return this.request<MeetingBooking>('/v1/meetings/assign', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async listMyMeetings(): Promise<{ bookings: MeetingBooking[] }> {
    return this.request<{ bookings: MeetingBooking[] }>('/v1/meetings/me');
  }

  async cancelMeeting(bookingId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/meetings/${bookingId}`, { method: 'DELETE' });
  }
}
