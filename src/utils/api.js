/**
 * @fileoverview API клиент для взаимодействия с бэкендом
 * Поддерживает CSRF-токены для защищённых эндпоинтов
 *
 * @module src/utils/api
 */

import { API_BASE_URL } from '../config/constants.js';

export class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.csrfToken = null;
  }

  /**
   * Получение CSRF-токена с бэкенда
   * Токен приходит в cookie и в теле ответа
   * @returns {Promise<string|null>}
   */
  async fetchCsrfToken() {
    try {
      const response = await fetch(`${this.baseURL}/v1/auth/csrf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrf_token;

        // Для отладки — убедимся, что токен сохранился
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
  async ensureCsrfToken() {
    // Всегда получаем свежий токен перед мутирующим запросом
    await this.fetchCsrfToken();
    return this.csrfToken;
  }

  /**
   * Парсинг ответа от сервера
   * @param {Response} response
   * @returns {Promise<any>}
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    const text = await response.text();
    return { error: { message: text || `HTTP ${response.status}` } };
  }

  /**
   * Базовый метод для выполнения HTTP запросов
   * @param {string} endpoint - Эндпоинт API
   * @param {Object} options - Опции fetch запроса
   * @returns {Promise<Object|null>}
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Для мутирующих запросов всегда получаем свежий CSRF-токен
    if (isMutating) {
      await this.ensureCsrfToken();
      if (this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
        console.log(`Sending CSRF token for ${method} ${endpoint}:`, this.csrfToken.substring(0, 10) + '...');
      } else {
        console.warn(`No CSRF token available for ${method} ${endpoint}`);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers
      });

      // Если CSRF ошибка, пробуем обновить токен и повторить 1 раз
      if (response.status === 403 && isMutating) {
        console.warn('CSRF error, retrying with fresh token...');
        await this.fetchCsrfToken();
        if (this.csrfToken) {
          headers['X-CSRF-Token'] = this.csrfToken;
          const retryResponse = await fetch(url, {
            ...options,
            credentials: 'include',
            headers
          });

          if (retryResponse.status === 204) {
            return null;
          }

          const retryData = await this.parseResponse(retryResponse);
          if (!retryResponse.ok) {
            const error = new Error(retryData.error?.message || `HTTP ${retryResponse.status}`);
            error.data = retryData;
            error.status = retryResponse.status;
            throw error;
          }
          return retryData;
        }
      }

      if (response.status === 204) {
        return null;
      }

      const data = await this.parseResponse(response);

      if (!response.ok) {
        const error = new Error(data.error?.message || `HTTP ${response.status}`);
        error.data = data;
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // ===== AUTH METHODS =====

  async login(email, password) {
    // Перед логином получаем CSRF-токен
    await this.ensureCsrfToken();

    const response = await this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    // После успешного логина обновляем CSRF-токен
    if (response?.user) {
      await this.fetchCsrfToken();
    }

    return response;
  }

  async registerClient(userData) {
    await this.ensureCsrfToken();
    const response = await this.request('/v1/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (response?.user) {
      await this.fetchCsrfToken();
    }

    return response;
  }

  async registerTrainer(userData) {
    await this.ensureCsrfToken();
    const response = await this.request('/v1/auth/register/trainer', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (response?.user) {
      await this.fetchCsrfToken();
    }

    return response;
  }

  async getCurrentUser() {
    try {
      return await this.request('/v1/auth/me');
    } catch (error) {
      if (error.message === 'Не авторизован' || error.status === 401) {
        return null;
      }
      throw error;
    }
  }

  async logout() {
    await this.ensureCsrfToken();
    const response = await this.request('/v1/auth/logout', { method: 'POST' });
    // После выхода очищаем токен
    this.csrfToken = null;
    return response;
  }

  // ===== PROFILE METHODS =====

  async getProfile(userId) {
    return this.request(`/v1/profiles/${userId}`);
  }

  async getTrainers() {
    return this.request('/v1/trainers');
  }

  async getUserPosts(userId) {
    return this.request(`/v1/profiles/${userId}/posts`);
  }

  async updateMyProfile(payload) {
    await this.ensureCsrfToken();
    return this.request('/v1/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  // ===== POSTS METHODS =====

  async getPost(postId) {
    return this.request(`/v1/posts/${postId}`);
  }

  async createPost(payload) {
    await this.ensureCsrfToken();
    return this.request('/v1/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updatePost(postId, payload) {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async deletePost(postId) {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}`, { method: 'DELETE' });
  }

  async likePost(postId) {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}/likes`, { method: 'POST' });
  }

  async unlikePost(postId) {
    await this.ensureCsrfToken();
    return this.request(`/v1/posts/${postId}/likes`, { method: 'DELETE' });
  }

  // ===== DONATIONS =====

  async createDonation(userId, amountValue, currency = 'RUB', message = null) {
    await this.ensureCsrfToken();
    const payload = {
      amount_value: amountValue,
      currency: currency,
      message: message || null
    };
    return this.request(`/v1/profiles/${userId}/donations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ===== SPORT TYPES =====

  async getSportTypes() {
    return this.request('/v1/sport-types');
  }

  // ===== AVATAR =====

  async uploadAvatar(file) {
    await this.ensureCsrfToken();

    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseURL}/v1/profiles/me/avatar`;

    const headers = {};
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    console.log('Uploading avatar with CSRF token:', this.csrfToken ? '✅' : '❌');

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async deleteAvatar() {  
    await this.ensureCsrfToken();
    return this.request('/v1/profiles/me/avatar', {
      method: 'DELETE'
    });
  }
} 
