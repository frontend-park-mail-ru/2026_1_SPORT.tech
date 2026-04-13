/**
 * @fileoverview Константы приложения
 * Содержит глобальные настройки и конфигурацию
 * 
 * @module src/config/constants
 */

/**
 * Базовый URL для API запросов
 * @constant {string}
 * @default 'http://212.233.98.238:8080'
 */
export const API_BASE_URL = 'http://212.233.98.238:8080';

/**
 * Режим просмотра вёрстки без бэкенда (см. `applyDevMockApiOverrides`).
 * - `?mock=1` или `?mock=full` — «залогиненный» профиль и посты
 * - `?mock=auth` — экран входа (сессии нет; формы отправки ведут на мок-ответ)
 * - `?mock=0` — выключить и сбросить флаг в sessionStorage
 *
 * @returns {null|'full'|'auth'}
 */
export function getDevMockMode() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const q = new URLSearchParams(window.location.search).get('mock');
    if (q === '0' || q === 'off') {
      sessionStorage.removeItem('SPORT_DEV_MOCK');
      return null;
    }
    if (q === 'auth') {
      sessionStorage.setItem('SPORT_DEV_MOCK', 'auth');
      return 'auth';
    }
    if (q === '1' || q === 'full' || q === 'profile') {
      sessionStorage.setItem('SPORT_DEV_MOCK', 'full');
      return 'full';
    }
    const stored = sessionStorage.getItem('SPORT_DEV_MOCK');
    if (stored === 'auth' || stored === 'full') {
      return stored;
    }
  } catch (_) {
    /* sessionStorage может быть недоступен */
  }
  return null;
}
