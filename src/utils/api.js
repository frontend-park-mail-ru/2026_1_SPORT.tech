import { API_BASE_URL } from '../config/constants';

export class ApiClient {
    constructor(baseURL = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, {
                ...options,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            // Для 204 No Content
            if (response.status === 204) {
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ API Error:', data);
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            console.log('✅ API Response:', data);
            return data;
        } catch (error) {
            console.error(`❌ API Request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // ===== AUTH =====
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async registerClient(userData) {
        return this.request('/auth/register/client', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async registerTrainer(userData) {
        return this.request('/auth/register/trainer', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getCurrentUser() {
        try {
            return await this.request('/auth/me');
        } catch (error) {
            if (error.message === 'Не авторизован') {
                console.log('User not logged in (expected for first load)');
                return null; // Возвращаем null вместо ошибки
            }
            throw error;
        }
    }

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    }

    // ===== PROFILE =====
    async getProfile(userId) {
        return this.request(`/profiles/${userId}`);
    }

    async getUserPosts(userId) {
        return this.request(`/profiles/${userId}/posts`);
    }

    // ===== POSTS =====
    async getPost(postId) {
        return this.request(`/posts/${postId}`);
    }

    // ===== SPORT TYPES =====
    async getSportTypes() {
        return this.request('/sport-types');
    }
}
