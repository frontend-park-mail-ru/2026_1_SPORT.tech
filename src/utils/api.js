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
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (response.status === 204) {
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ API Error:', data);
        console.error('❌ Full error details:', JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ API Request failed: ${endpoint}`, error);
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
  async createDonation(payload) {
    return this.request('/donations', {
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
}
