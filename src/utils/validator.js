/**
 * Модуль валидации данных
 * @module utils/validator
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
    messages: {required: 'Email обязателен', pattern: 'Неверный формат email (пример: example@smail.ru)'}
  },

  password: {
    required: true,
    min: 8,
    pattern:
        /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/,
    messages: {
      required: 'Пароль обязателен',
      min: 'Минимум 8 символов',
      pattern:
          'Пароль может содержать только латинские буквы, цифры и спецсимволы'
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

  bio: {required: false, max: 1000, messages: {max: 'Максимум 1000 символов'}},

  education_degree:
      {required: false, max: 255, messages: {max: 'Максимум 255 символов'}},

  sports_rank:
      {required: false, max: 100, messages: {max: 'Максимум 100 символов'}}
};

const checks = {
  required: (value) => value !== undefined && value !== null && value !== '',

  minLength: (value, min) => !value || value.length >= min,

  maxLength: (value, max) => !value || value.length <= max,

  pattern: (value, regex) => !value || regex.test(value),

  email: (value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),

  username: (value) => !value || /^[A-Za-z0-9_]{3,30}$/.test(value),

  dateFormat: (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),

  passwordsMatch: (password, repeat) => password === repeat,

  nonNegative: (value) => typeof value === 'number' && value >= 0
};

class Validator {
  constructor() {
    this.errors = [];
    this.rules = rules;
  }

  reset() {
    this.errors = [];
  }

  getErrors() {
    return this.errors;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  addError(field, message) {
    this.errors.push({field, message});
  }

  /**
   * Валидация поля с учетом nullable
   */
  validateField(value, fieldName, fieldRules, nullable = false) {
    const {required, min, max, pattern, messages = {}} = fieldRules;

    if (nullable && value === null) {
      return true;
    }

    if (required && !checks.required(value)) {
      this.addError(
          fieldName, messages.required || `Поле ${fieldName} обязательно`);
      return false;
    }

    if (!value && !required) return true;

    if (min !== undefined && typeof value === 'string' &&
        !checks.minLength(value, min)) {
      this.addError(fieldName, messages.min || `Минимум ${min} символов`);
    }

    if (max !== undefined && typeof value === 'string' &&
        !checks.maxLength(value, max)) {
      this.addError(fieldName, messages.max || `Максимум ${max} символов`);
    }

    if (pattern && typeof value === 'string' &&
        !checks.pattern(value, pattern)) {
      this.addError(fieldName, messages.pattern || `Недопустимый формат`);
    }

    return !this.hasErrors();
  }

  /**
   * Валидация username
   */
  validateUsername(username) {
    this.reset();
    this.validateField(username, 'username', this.rules.username);
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация email
   */
  validateEmail(email) {
    this.reset();
    this.validateField(email, 'email', this.rules.email);
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация пароля (без подтверждения)
   */

  validatePassword(password) {
    this.reset();
    this.validateField(password, 'password', this.rules.password);
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }
  /**
   * Валидация пароля с подтверждением
   */
  validatePasswordWithConfirmation(password, passwordRepeat) {
    this.reset();

    this.validateField(password, 'password', this.rules.password);

    if (!checks.required(passwordRepeat)) {
      this.addError('password_repeat', 'Подтверждение пароля обязательно');
    } else if (!checks.passwordsMatch(password, passwordRepeat)) {
      this.addError('password_repeat', 'Пароли не совпадают');
    }

    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация имени
   */
  validateFirstName(firstName) {
    this.reset();
    this.validateField(firstName, 'first_name', this.rules.first_name);
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация фамилии
   */
  validateLastName(lastName) {
    this.reset();
    this.validateField(lastName, 'last_name', this.rules.last_name);
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация био
   */
  validateBio(bio) {
    this.reset();
    if (bio) {
      this.validateField(bio, 'bio', this.rules.bio);
    }
    return {isValid: !this.hasErrors(), errors: this.getErrors()};
  }

  /**
   * Валидация регистрации клиента
   */
  validateClientRegister(data) {
    this.reset();

    const {username, email, password, password_repeat, first_name, last_name} =
        data;

    this.validateField(username, 'username', this.rules.username);
    this.validateField(email, 'email', this.rules.email);
    this.validateField(first_name, 'first_name', this.rules.first_name);
    this.validateField(last_name, 'last_name', this.rules.last_name);

    const passwordResult =
        this.validatePasswordWithConfirmation(password, password_repeat);

    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(
          err => this.addError(err.field, err.message));
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      apiFormat: this.formatErrorsForAPI()
    };
  }

  /**
   * Валидация спорта тренера
   */
  validateTrainerSport(sport, index) {
    const errors = [];

    if (!sport.sport_type_id) {
      errors.push({
        field: `sports[${index}].sport_type_id`,
        message: 'ID вида спорта обязателен'
      });
    }

    if (sport.experience_years === undefined ||
        sport.experience_years === null) {
      errors.push({
        field: `sports[${index}].experience_years`,
        message: 'Опыт работы обязателен'
      });
    } else if (
        typeof sport.experience_years !== 'number' ||
        sport.experience_years < 0) {
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
      errors.push(
          {field: 'education_degree', message: 'Максимум 255 символов'});
    }

    if (!details.sports || !Array.isArray(details.sports) ||
        details.sports.length === 0) {
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

    const passwordResult =
        this.validatePasswordWithConfirmation(password, password_repeat);
    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(
          err => this.addError(err.field, err.message));
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
}

const validator = new Validator();

export const validateUsername = (username) =>
    validator.validateUsername(username);
export const validateEmail = (email) => validator.validateEmail(email);
export const validatePassword = (password) =>
    validator.validatePassword(password);
export const validatePasswordWithConfirmation = (password, repeat) =>
    validator.validatePasswordWithConfirmation(password, repeat);
export const validateFirstName = (firstName) =>
    validator.validateFirstName(firstName);
export const validateLastName = (lastName) =>
    validator.validateLastName(lastName);
export const validateBio = (bio) => validator.validateBio(bio);
export const validateClientRegister = (data) =>
    validator.validateClientRegister(data);
export const validateTrainerRegister = (data) =>
    validator.validateTrainerRegister(data);
export const validateTrainerDetails = (details) =>
    validator.validateTrainerDetails(details);
export const formatErrorsForAPI = () => validator.formatErrorsForAPI();

export default Validator;
