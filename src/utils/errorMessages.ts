import { MAX_DONATION_AMOUNT_RUB, MIN_DONATION_AMOUNT_RUB } from './validator';

const ERROR_MESSAGE_MAP: Array<[RegExp, string]> = [
  [
    /amount_too_small|invalid donation amount/i,
    `Сумма должна быть от ${MIN_DONATION_AMOUNT_RUB} ₽ до ${MAX_DONATION_AMOUNT_RUB.toLocaleString('ru-RU')} ₽.`
  ],
  [/^(offline|failed to fetch|networkerror|load failed)$/i, 'Нет соединения. Попробуйте повторить, когда сеть появится.'],
  [/network|fetch|connection|internet/i, 'Нет соединения. Проверьте сеть и попробуйте ещё раз.'],
  [/csrf/i, 'Сессия устарела. Обновите страницу и попробуйте ещё раз.'],
  [/invalid credentials|invalid credential|wrong password/i, 'Неверная почта или пароль.'],
  [/user not found/i, 'Пользователь не найден.'],
  [/email already (exists|taken)/i, 'Эта почта уже занята.'],
  [/username already (exists|taken)/i, 'Это имя пользователя уже занято.'],
  [/user already exists/i, 'Пользователь с такой почтой или именем уже существует.'],
  [/unauthorized|http 401/i, 'Сессия истекла. Войдите снова.'],
  [/forbidden|permissiondenied|http 403/i, 'У вас нет доступа к этому действию.'],
  [/not found|http 404/i, 'Не нашли нужные данные. Обновите страницу или вернитесь назад.'],
  [/alreadyexists|already exists|conflict|http 409/i, 'Такие данные уже есть. Проверьте форму и попробуйте ещё раз.'],
  [/invalidargument|bad request|validation|http 400|http 422/i, 'Проверьте введённые данные и попробуйте ещё раз.'],
  [/too many requests|rate limit|http 429/i, 'Слишком много попыток. Подождите немного и попробуйте снова.'],
  [/body size|payload too large|file too large|http 413/i, 'Файл слишком большой. Выберите файл меньшего размера.'],
  [/server returned non-json|сервер вернул не json|html/i, 'Сервер временно недоступен. Попробуйте позже.'],
  [/internal|service unavailable|bad gateway|gateway timeout|http 5\d\d/i, 'На сервере временная ошибка. Попробуйте позже.']
];

export function getFriendlyErrorMessage(error: unknown, fallback = 'Произошла ошибка. Попробуйте ещё раз.'): string {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : String(error || '');

  const trimmed = message.trim();
  if (!trimmed) return fallback;

  for (const [pattern, friendly] of ERROR_MESSAGE_MAP) {
    if (pattern.test(trimmed)) return friendly;
  }

  if (/^[a-z0-9_. -]+$/i.test(trimmed) && !/[а-яё]/i.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
