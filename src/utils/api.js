/**
 * @fileoverview API клиент для взаимодействия с бэкендом
 * Предоставляет методы для всех эндпоинтов API
 *
 * @module src/utils/api
 */

import { API_BASE_URL } from '../config/constants.js';

/**
 * Класс API клиента
 * @class
 */
export class ApiClient {
  /**
   * Создает экземпляр API клиента
   * @param {string} baseURL - Базовый URL API (по умолчанию из constants.js)
   */
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Базовый метод для выполнения HTTP запросов
   * @async
   * @param {string} endpoint - Эндпоинт API (напр. '/auth/login')
   * @param {Object} [options={}] - Опции fetch запроса
   * @returns {Promise<Object|null>} Ответ от API или null для 204
   * @throws {Error} Ошибка запроса
   * @private
   */

// src/utils/api.js

async request(endpoint, options = {}) {
  const url = `${this.baseURL}${endpoint}`;

  console.log('🌐 [API] request - Outgoing:', {
    url: url,
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body ? JSON.parse(options.body) : undefined
  });

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    console.log('🌐 [API] request - Response:', {
      url: url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (response.status === 204) {
      console.log('🌐 [API] request - 204 No Content');
      return null;
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('🌐 [API] request - Response data:', data);
    } else {
      const text = await response.text();
      console.error('❌ [API] request - Non-JSON response:', text);
      data = { error: { message: text || `HTTP ${response.status}` } };
    }

    if (!response.ok) {
      const error = new Error(data.error?.message || `HTTP ${response.status}`);
      error.data = data;
      error.status = response.status;
      console.error('❌ [API] request - Error details:', {
        status: response.status,
        data: data,
        error: error
      });
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ [API] request - Network/Parse error:', {
      endpoint: endpoint,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
  // ===== AUTH METHODS =====

  /**
   * Вход пользователя
   * @async
   * @param {string} email - Email пользователя
   * @param {string} password - Пароль
   * @returns {Promise<Object>} Данные пользователя
   */
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  /**
   * Регистрация клиента
   * @async
   * @param {Object} userData - Данные пользователя
   * @returns {Promise<Object>} Данные зарегистрированного пользователя
   */
  async registerClient(userData) {
    return this.request('/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  /**
   * Регистрация тренера
   * @async
   * @param {Object} userData - Данные тренера
   * @returns {Promise<Object>} Данные зарегистрированного тренера
   */
  async registerTrainer(userData) {
    console.log('📤 registerTrainer payload:', JSON.stringify(userData, null, 2));
    return this.request('/auth/register/trainer', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  /**
   * Получение информации о текущем пользователе
   * @async
   * @returns {Promise<Object|null>} Данные пользователя или null если не авторизован
   */
  async getCurrentUser() {
    try {
      return await this.request('/auth/me');
    } catch (error) {
      if (error.message === 'Не авторизован') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Выход пользователя
   * @async
   * @returns {Promise<null>}
   */
  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // ===== PROFILE METHODS =====

  /**
   * Получение профиля пользователя
   * @async
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Данные профиля
   */
  async getProfile(userId) {
    return this.request(`/profiles/${userId}`);
  }

  /**
   * Получение постов пользователя
   * @async
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Список постов
   */
  async getUserPosts(userId) {
    return this.request(`/profiles/${userId}/posts`);
  }

  // ===== POSTS METHODS =====

  /**
   * Получение полного поста
   * @async
   * @param {number} postId - ID поста
   * @returns {Promise<Object>} Данные поста
   */
  async getPost(postId) {
    return this.request(`/posts/${postId}`);
  }

  /**
   * Создание поста
   *
   * **Эндпоинт:** `POST /posts`
   *
   * Тело запроса (JSON): `{ title, text_content, min_tier_id? }`
   *
   * @async
   * @param {Object} payload - Поля поста
   * @param {string} payload.title - Заголовок
   * @param {string} payload.text_content - Текст
   * @param {number|null} [payload.min_tier_id] - Минимальный tier для просмотра
   * @returns {Promise<Object>} Созданный пост
   */
  async createPost(payload) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Обновление поста
   *
   * **Эндпоинт:** `PATCH /posts/{postId}`
   *
   * @async
   * @param {number} postId - ID поста
   * @param {Object} payload - Поля для обновления
   * @returns {Promise<Object>} Обновлённый пост
   */
  async updatePost(postId, payload) {
    return this.request(`/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Удаление поста
   *
   * **Эндпоинт:** `DELETE /posts/{postId}`
   *
   * @async
   * @param {number} postId - ID поста
   * @returns {Promise<null>}
   */
  async deletePost(postId) {
    return this.request(`/posts/${postId}`, { method: 'DELETE' });
  }

  /**
   * Лайк поста
   *
   * **Эндпоинт:** `POST /posts/{postId}/like`
   *
   * @async
   * @param {number} postId - ID поста
   * @returns {Promise<Object| null>}
   */
  async likePost(postId) {
    return this.request(`/posts/${postId}/likes`, { method: 'POST' });
  }

  /**
   * Снять лайк с поста
   *
   * **Эндпоинт:** `DELETE /posts/{postId}/like`
   *
   * @async
   * @param {number} postId - ID поста
   * @returns {Promise<null>}
   */
  async unlikePost(postId) {
    return this.request(`/posts/${postId}/likes`, { method: 'DELETE' });
  }

  /**
   * Пожертвование тренеру (если реализовано на бэкенде)
   *
   * **Эндпоинт:** `POST /donations`
   *
   * Тело (пример): `{ amount_rub, email, recipient_user_id }`
   *
   * @async
   * @param {Object} payload - Данные платежа
   * @returns {Promise<Object>}
   */
// src/utils/api.js

async createDonation(userId, amountValue, currency = 'RUB', message = null) {
  const payload = {
    amount_value: amountValue,
    currency: currency,
    message: message || null  // ← null вместо пустой строки
  };

  console.log('📤 [API] createDonation - Request details:', {
    endpoint: `/profiles/${userId}/donations`,
    method: 'POST',
    userId: userId,
    payload: payload,
    fullURL: `${this.baseURL}/profiles/${userId}/donations`
  });

  return this.request(`/profiles/${userId}/donations`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

  // ===== SPORT TYPES METHODS =====

  /**
   * Получение списка видов спорта
   * @async
   * @returns {Promise<Object>} Список видов спорта
   */
  async getSportTypes() {
    return this.request('/sport-types');
  }

  async likePost(postId) {
  console.log(`[API] Лайк поста ${postId}`);
  return this.request(`/posts/${postId}/likes`, { method: 'POST' });
}

async unlikePost(postId) {
  console.log(`[API] Снятие лайка с поста ${postId}`);
  return this.request(`/posts/${postId}/likes`, { method: 'DELETE' });
}

async deleteAvatar() {
  return this.request('/profiles/me/avatar', {
    method: 'DELETE'
  });
}

}
