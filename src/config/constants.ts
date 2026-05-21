
/**
 * @fileoverview Константы приложения
 * Содержит глобальные настройки и конфигурацию
 *
 * @module src/config/constants
 */

/**
 * Базовый URL для API запросов.
 * На проде используем same-origin nginx proxy, чтобы CSRF/session cookies
 * выставлялись на домен фронта и отправлялись обратно с мутациями.
 */

export const API_BASE_URL = '/api';
