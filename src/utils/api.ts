import { API_BASE_URL } from '../config/constants';

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
        const data = await response.json() as { csrf_token: string };
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
      const error = new Error((data as { error?: { message: string } })?.error?.message || `HTTP ${response.status}`);
      (error as any).data = data;
      throw error;
    }

    return data;
  }

  async login(email: string, password: string): Promise<{ user: { user_id: number; username: string; email: string; first_name: string; last_name: string; avatar_url: string | null; bio: string | null; is_trainer: boolean } }> {
    await this.ensureCsrfToken();
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async logout(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request('/v1/auth/logout', { method: 'POST' });
    this.csrfToken = null;
  }

  async getCurrentUser(): Promise<{ user: { user_id: number; username: string; email: string; first_name: string; last_name: string; avatar_url: string | null; bio: string | null; is_trainer: boolean } } | null> {
    try {
      return await this.request('/v1/auth/me');
    } catch {
      return null;
    }
  }

  async getProfile(userId: number): Promise<any> {
    return this.request(`/v1/profiles/${userId}`);
  }

  async getTrainers(): Promise<{ trainers: any[] }> {
    return this.request('/v1/trainers');
  }

  async getUserPosts(userId: number): Promise<{ posts: any[]; user_id: number }> {
    return this.request(`/v1/profiles/${userId}/posts`);
  }

  async getPost(postId: number): Promise<any> {
    return this.request(`/v1/posts/${postId}`);
  }

  async createPost(payload: { title: string; text_content: string }): Promise<any> {
    await this.ensureCsrfToken();
    return this.request('/v1/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updatePost(postId: number, payload: { title?: string; text_content?: string }): Promise<any> {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async deletePost(postId: number): Promise<void> {
    await this.ensureCsrfToken();
    await this.request(`/v1/posts/${postId}`, { method: 'DELETE' });
  }

  async likePost(postId: number): Promise<{ is_liked: boolean; likes_count: number }> {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}/likes`, { method: 'POST' });
  }

  async unlikePost(postId: number): Promise<{ is_liked: boolean; likes_count: number }> {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}/likes`, { method: 'DELETE' });
  }

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
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async deleteAvatar(): Promise<void> {
    await this.ensureCsrfToken();
    await this.request('/v1/profiles/me/avatar', { method: 'DELETE' });
  }
}
