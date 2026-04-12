/**
 * @fileoverview Модуль валидации данных
 * Содержит правила и методы для проверки пользовательского ввода
 * 
 * @module src/utils/validator
 */

/**
 * @constant {Object} rules - Правила валидации для полей
 * @property {Object} username - Правила для имени пользователя
 * @property {Object} email - Правила для email
 * @property {Object} password - Правила для пароля
 * @property {Object} first_name - Правила для имени
 * @property {Object} last_name - Правила для фамилии
 * @property {Object} bio - Правила для био
 * @property {Object} education_degree - Правила для образования
 * @property {Object} sports_rank - Правила для спортивного разряда
 */
const rules = {
  username: {
    required: true,
    min: 3,
    max: 30,
    pattern: /^[A-Za-z0-9_]{3,30}$/,
    messages: {
      required: 'Имя пользователя обязательно',
      min: 'Минимум 3 символа',
      max: 'Максимум 30 символов',
      pattern: 'Только латинские буквы, цифры и _'
    }
  },

  email: {
    required: true,
    max: 254,
    pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    messages: { required: 'Email обязателен', pattern: 'Неверный формат email (пример: example@smail.ru)' }
  },

  password: {
    required: true,
    min: 8,
    pattern: /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
    messages: {
      required: 'Пароль обязателен',
      min: 'Минимум 8 символов',
      pattern: 'Пароль может содержать только латинские буквы, цифры и спецсимволы'
    }
  },

  first_name: {
    required: true,
    min: 1,
    max: 100,
    messages: {
      required: 'Имя обязательно',
      min: 'Имя не может быть пустым',
      max: 'Максимум 100 символов'
    }
  },

  last_name: {
    required: true,
    min: 1,
    max: 100,
    messages: {
      required: 'Фамилия обязательна',
      min: 'Фамилия не может быть пустой',
      max: 'Максимум 100 символов'
    }
  },

  bio: { required: false, max: 1000, messages: { max: 'Максимум 1000 символов' } },

  education_degree: { required: false, max: 255, messages: { max: 'Максимум 255 символов' } },

  sports_rank: { required: false, max: 100, messages: { max: 'Максимум 100 символов' } },

  post_title: {
    required: true,
    min: 1,
    max: 200,
    messages: {
      required: 'Заголовок обязателен',
      min: 'Заголовок не может быть пустым',
      max: 'Максимум 200 символов'
    }
  },

  post_body: {
    required: true,
    min: 1,
    max: 10000,
    messages: {
      required: 'Текст публикации обязателен',
      min: 'Текст не может быть пустым',
      max: 'Максимум 10000 символов'
    }
  },

  receipt_email: {
    required: true,
    max: 254,
    pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    messages: {
      required: 'Укажите почту для чека',
      pattern: 'Неверный формат email'
    }
  }
};

/**
 * @constant {Object} checks - Функции проверки
 */
const checks = {
  /**
   * Проверка на обязательное поле
   * @param {*} value - Значение для проверки
   * @returns {boolean}
   */
  required: value => value !== undefined && value !== null && value !== '',

  /**
   * Проверка минимальной длины
   * @param {string} value - Значение для проверки
   * @param {number} min - Минимальная длина
   * @returns {boolean}
   */
  minLength: (value, min) => !value || value.length >= min,

  /**
   * Проверка максимальной длины
   * @param {string} value - Значение для проверки
   * @param {number} max - Максимальная длина
   * @returns {boolean}
   */
  maxLength: (value, max) => !value || value.length <= max,

  /**
   * Проверка по регулярному выражению
   * @param {string} value - Значение для проверки
   * @param {RegExp} regex - Регулярное выражение
   * @returns {boolean}
   */
  pattern: (value, regex) => !value || regex.test(value),

  /**
   * Проверка email
   * @param {string} value - Email для проверки
   * @returns {boolean}
   */
  email: value => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),

  /**
   * Проверка username
   * @param {string} value - Username для проверки
   * @returns {boolean}
   */
  username: value => !value || /^[A-Za-z0-9_]{3,30}$/.test(value),

  /**
   * Проверка формата даты
   * @param {string} value - Дата для проверки
   * @returns {boolean}
   */
  dateFormat: value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),

  /**
   * Проверка совпадения паролей
   * @param {string} password - Пароль
   * @param {string} repeat - Подтверждение пароля
   * @returns {boolean}
   */
  passwordsMatch: (password, repeat) => password === repeat,

  /**
   * Проверка неотрицательного числа
   * @param {*} value - Значение для проверки
   * @returns {boolean}
   */
  nonNegative: value => typeof value === 'number' && value >= 0
};

/**
 * Класс валидатора
 * @class
 */
export class Validator {
  constructor() {
    /** @type {Array} Массив ошибок */
    this.errors = [];
    /** @type {Object} Правила валидации */
    this.rules = rules;
  }

  /**
   * Сброс ошибок
   */
  reset() {
    this.errors = [];
  }

  /**
   * Получить все ошибки
   * @returns {Array} Массив ошибок
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Проверить наличие ошибок
   * @returns {boolean}
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Добавить ошибку
   * @param {string} field - Имя поля
   * @param {string} message - Сообщение об ошибке
   */
  addError(field, message) {
    this.errors.push({ field, message });
  }

  /**
   * Валидация поля с учетом nullable
   * @param {*} value - Значение поля
   * @param {string} fieldName - Имя поля
   * @param {Object} fieldRules - Правила для поля
   * @param {boolean} [nullable=false] - Может ли быть null
   * @returns {boolean}
   */
  validateField(value, fieldName, fieldRules, nullable = false) {
    const { required, min, max, pattern, messages = {} } = fieldRules;

    if (nullable && value === null) {
      return true;
    }

    if (required && !checks.required(value)) {
      this.addError(fieldName, messages.required || `Поле ${fieldName} обязательно`);
      return false;
    }

    if (!value && !required) return true;

    if (min !== undefined && typeof value === 'string' && !checks.minLength(value, min)) {
      this.addError(fieldName, messages.min || `Минимум ${min} символов`);
    }

    if (max !== undefined && typeof value === 'string' && !checks.maxLength(value, max)) {
      this.addError(fieldName, messages.max || `Максимум ${max} символов`);
    }

    if (pattern && typeof value === 'string' && !checks.pattern(value, pattern)) {
      this.addError(fieldName, messages.pattern || `Недопустимый формат`);
    }

    return !this.hasErrors();
  }

  /**
   * Валидация username
   * @param {string} username - Имя пользователя
   * @returns {Object} Результат валидации
   */
  validateUsername(username) {
    this.reset();
    this.validateField(username, 'username', this.rules.username);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация email
   * @param {string} email - Email
   * @returns {Object} Результат валидации
   */
  validateEmail(email) {
    this.reset();
    this.validateField(email, 'email', this.rules.email);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация пароля (без подтверждения)
   * @param {string} password - Пароль
   * @returns {Object} Результат валидации
   */
  validatePassword(password) {
    this.reset();
    this.validateField(password, 'password', this.rules.password);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация пароля с подтверждением
   * @param {string} password - Пароль
   * @param {string} passwordRepeat - Подтверждение пароля
   * @returns {Object} Результат валидации
   */
  validatePasswordWithConfirmation(password, passwordRepeat) {
    this.reset();

    this.validateField(password, 'password', this.rules.password);

    if (!checks.required(passwordRepeat)) {
      this.addError('password_repeat', 'Подтверждение пароля обязательно');
    } else if (!checks.passwordsMatch(password, passwordRepeat)) {
      this.addError('password_repeat', 'Пароли не совпадают');
    }

    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация имени
   * @param {string} firstName - Имя
   * @returns {Object} Результат валидации
   */
  validateFirstName(firstName) {
    this.reset();
    this.validateField(firstName, 'first_name', this.rules.first_name);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация фамилии
   * @param {string} lastName - Фамилия
   * @returns {Object} Результат валидации
   */
  validateLastName(lastName) {
    this.reset();
    this.validateField(lastName, 'last_name', this.rules.last_name);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация био
   * @param {string} bio - Биография
   * @returns {Object} Результат валидации
   */
  validateBio(bio) {
    this.reset();
    if (bio) {
      this.validateField(bio, 'bio', this.rules.bio);
    }
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Валидация регистрации клиента
   * @param {Object} data - Данные клиента
   * @returns {Object} Результат валидации
   */
  validateClientRegister(data) {
    this.reset();

    const { username, email, password, password_repeat, first_name, last_name } = data;

    this.validateField(username, 'username', this.rules.username);
    this.validateField(email, 'email', this.rules.email);
    this.validateField(first_name, 'first_name', this.rules.first_name);
    this.validateField(last_name, 'last_name', this.rules.last_name);

    const passwordResult = this.validatePasswordWithConfirmation(password, password_repeat);

    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(err => this.addError(err.field, err.message));
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      apiFormat: this.formatErrorsForAPI()
    };
  }

  /**
   * Валидация спорта тренера
   * @param {Object} sport - Данные о спорте
   * @param {number} index - Индекс в массиве
   * @returns {Array} Массив ошибок
   */
  validateTrainerSport(sport, index) {
    const errors = [];

    if (!sport.sport_type_id) {
      errors.push({
        field: `sports[${index}].sport_type_id`,
        message: 'ID вида спорта обязателен'
      });
    }

    if (sport.experience_years === undefined || sport.experience_years === null) {
      errors.push({
        field: `sports[${index}].experience_years`,
        message: 'Опыт работы обязателен'
      });
    } else if (typeof sport.experience_years !== 'number' || sport.experience_years < 0) {
      errors.push({
        field: `sports[${index}].experience_years`,
        message: 'Опыт работы должен быть неотрицательным числом'
      });
    }

    if (sport.sports_rank && sport.sports_rank.length > 100) {
      errors.push({
        field: `sports[${index}].sports_rank`,
        message: 'Максимум 100 символов'
      });
    }

    return errors;
  }

  /**
   * Валидация деталей тренера
   * @param {Object} details - Детали тренера
   * @returns {Array} Массив ошибок
   */
  validateTrainerDetails(details) {
    const errors = [];

    if (!details.career_since_date) {
      errors.push({
        field: 'career_since_date',
        message: 'Дата начала карьеры обязательна'
      });
    } else if (!checks.dateFormat(details.career_since_date)) {
      errors.push({
        field: 'career_since_date',
        message: 'Дата должна быть в формате ГГГГ-ММ-ДД'
      });
    }

    if (details.education_degree && details.education_degree.length > 255) {
      errors.push({ field: 'education_degree', message: 'Максимум 255 символов' });
    }

    if (!details.sports || !Array.isArray(details.sports) || details.sports.length === 0) {
      errors.push({
        field: 'sports',
        message: 'Должен быть указан хотя бы один вид спорта'
      });
    } else {
      details.sports.forEach((sport, index) => {
        errors.push(...this.validateTrainerSport(sport, index));
      });
    }

    return errors;
  }

  /**
   * Валидация регистрации тренера
   * @param {Object} data - Данные тренера
   * @returns {Object} Результат валидации
   */
  validateTrainerRegister(data) {
    this.reset();

    const {
      username,
      email,
      password,
      password_repeat,
      first_name,
      last_name,
      trainer_details
    } = data;

    this.validateField(username, 'username', this.rules.username);
    this.validateField(email, 'email', this.rules.email);
    this.validateField(first_name, 'first_name', this.rules.first_name);
    this.validateField(last_name, 'last_name', this.rules.last_name);

    const passwordResult = this.validatePasswordWithConfirmation(password, password_repeat);
    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(err => this.addError(err.field, err.message));
    }

    if (!trainer_details) {
      this.addError('trainer_details', 'Данные тренера обязательны');
    } else {
      const trainerErrors = this.validateTrainerDetails(trainer_details);
      trainerErrors.forEach(err => this.addError(err.field, err.message));
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      apiFormat: this.formatErrorsForAPI()
    };
  }

  /**
   * Форматирование ошибок в формате API
   * @returns {Object|null} Ошибки в формате API
   */
  formatErrorsForAPI() {
    if (!this.hasErrors()) return null;

    return {
      error: {
        code: 'validation_error',
        message: 'Некорректные данные',
        fields: this.getErrors()
      }
    };
  }

  /**
   * Валидация формы создания/редактирования поста
   * @param {Object} data - Данные
   * @param {string} data.title - Заголовок
   * @param {string} data.text_content - Текст
   * @returns {{ isValid: boolean, errors: Array<{field: string, message: string}> }}
   */
  validatePostEditor(data) {
    this.reset();
    const title = data?.title ?? '';
    const textContent = data?.text_content ?? '';
    this.validateField(title, 'title', this.rules.post_title);
    this.validateField(textContent, 'text_content', this.rules.post_body);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  /**
   * Парсинг суммы пожертвования (поддержка запятой)
   * @param {string} raw - Строка из поля ввода
   * @returns {number|null} Число или null
   */
  static parseDonationAmount(raw) {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Валидация формы пожертвования
   * @param {Object} data - Данные
   * @param {string} data.amount - Сумма (строка)
   * @param {string} data.email - Email для чека
   * @returns {{ isValid: boolean, errors: Array<{field: string, message: string}>, amountNumber: number|null }}
   */
  validateDonationForm(data) {
    this.reset();
    const amountNum = Validator.parseDonationAmount(data?.amount);
    const email = data?.email ?? '';

    if (amountNum === null) {
      this.addError('amount', 'Введите корректную сумму');
    } else if (amountNum <= 0) {
      this.addError('amount', 'Сумма должна быть больше нуля');
    } else if (amountNum > 1_000_000_000) {
      this.addError('amount', 'Сумма слишком велика');
    }

    this.validateField(email, 'email', this.rules.receipt_email);

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      amountNumber: amountNum
    };
  }
}
