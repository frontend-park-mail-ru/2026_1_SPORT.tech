/**
 * Модуль для работы с API
 * @module utils/api
 */

const API_CONFIG = {
  baseURL: 'http://212.233.99.79:8080',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  credentials: 'include',
  mode: 'cors',
  timeout: 30000
};

const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

/**
 * Класс для работы с API
 */
class ApiClient {
  constructor(config = {}) {
    this.config = { ...API_CONFIG, ...config };
    this.defaultHeaders = { ...this.config.headers };

    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  /**
   * Добавление интерсептора запроса
   */
  addRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter(i => i !== fn);
    };
  }

  /**
   * Добавление интерсептора ответа
   */
  addResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter(i => i !== fn);
    };
  }

  /**
   * Добавление интерсептора ошибки
   */
  addErrorInterceptor(fn) {
    this.errorInterceptors.push(fn);
    return () => {
      this.errorInterceptors = this.errorInterceptors.filter(i => i !== fn);
    };
  }

  /**
   * Формирование полного URL
   */
  buildUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const base = this.config.baseURL.replace(/\/$/, '');
    const path = url.replace(/^\//, '');
    return `${base}/${path}`;
  }

  /**
   * Обработка ответа сервера
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let data;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = new Error(data?.error?.message || response.statusText);
      error.status = response.status;
      error.statusText = response.statusText;
      error.data = data;

      if (data?.error?.fields) {
        error.validationErrors = data.error.fields;
      }

      if (data?.error?.code) {
        error.code = data.error.code;
      }

      throw error;
    }

    return data;
  }

  /**
   * Основной метод для выполнения запросов
   */
  async request(endpoint, options = {}) {
    const {
      method = HTTP_METHODS.GET,
      headers = {},
      body,
      params = {},
      timeout = this.config.timeout,
      ...customOptions
    } = options;

    let modifiedOptions = { method, headers, body, params, ...customOptions };
    for (const interceptor of this.requestInterceptors) {
      const result = interceptor({ url: endpoint, options: modifiedOptions });
      if (result) modifiedOptions = result.options || modifiedOptions;
    }

    let url = this.buildUrl(endpoint);
    if (Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestHeaders = {
      ...this.defaultHeaders,
      ...modifiedOptions.headers
    };

    let requestBody = modifiedOptions.body;
    if (requestBody && typeof requestBody === 'object' && !(requestBody instanceof FormData)) {
      requestBody = JSON.stringify(requestBody);
    }
    if (requestBody instanceof FormData) {
      delete requestHeaders['Content-Type'];
    }

    try {
      const response = await fetch(url, {
        method: modifiedOptions.method,
        headers: requestHeaders,
        body: requestBody,
        credentials: this.config.credentials,
        mode: this.config.mode,
        signal: controller.signal,
        ...customOptions
      });

      clearTimeout(timeoutId);
      const data = await this.handleResponse(response);

      let result = data;
      for (const interceptor of this.responseInterceptors) {
        const intercepted = interceptor(result);
        if (intercepted !== undefined) result = intercepted;
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        error.code = 'timeout';
        error.message = `Запрос превысил время ожидания (${timeout}мс)`;
      }

      for (const interceptor of this.errorInterceptors) {
        try {
          const result = interceptor(error);
          if (result && !(result instanceof Error)) {
            return result;
          }
          if (result instanceof Error) {
            error = result;
          }
        } catch (e) {
        }
      }

      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: HTTP_METHODS.GET, ...options });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { method: HTTP_METHODS.POST, body, ...options });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { method: HTTP_METHODS.PUT, body, ...options });
  }

  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { method: HTTP_METHODS.PATCH, body, ...options });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: HTTP_METHODS.DELETE, ...options });
  }
}

const api = new ApiClient();

export const setApiConfig = (config) => api.setConfig(config);
export const setApiHeaders = (headers) => api.setHeaders(headers);
export const addRequestInterceptor = (fn) => api.addRequestInterceptor(fn);
export const addResponseInterceptor = (fn) => api.addResponseInterceptor(fn);
export const addErrorInterceptor = (fn) => api.addErrorInterceptor(fn);

export const get = (endpoint, options) => api.get(endpoint, options);
export const post = (endpoint, body, options) => api.post(endpoint, body, options);
export const put = (endpoint, body, options) => api.put(endpoint, body, options);
export const patch = (endpoint, body, options) => api.patch(endpoint, body, options);
export const del = (endpoint, options) => api.delete(endpoint, options);

export default api;
