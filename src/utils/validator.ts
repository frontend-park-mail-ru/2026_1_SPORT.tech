/**
 * @fileoverview Модуль валидации данных
 * Содержит правила и методы для проверки пользовательского ввода
 *
 * @module src/utils/validator
 */

import type {
  ValidationError,
  ValidationResult,
  DonationValidationResult,
  ValidationRule
} from '../types/validation.types';

interface Rules {
  username: ValidationRule;
  email: ValidationRule;
  password: ValidationRule;
  first_name: ValidationRule;
  last_name: ValidationRule;
  bio: ValidationRule;
  education_degree: ValidationRule;
  sports_rank: ValidationRule;
  post_title: ValidationRule;
  post_body: ValidationRule;
  receipt_email: ValidationRule;
  donation_message: ValidationRule;
}

const rules: Rules = {
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
    pattern: /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$/,
    messages: {
      required: 'Email обязателен',
      pattern: 'Неверный формат email (пример: example@smail.ru)'
    }
  },
  password: {
    required: true,
    min: 8,
    max: 128,
    pattern: /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
    messages: {
      required: 'Пароль обязателен',
      min: 'Минимум 8 символов',
      max: 'Максимум 128 символов',
      pattern: 'Пароль может содержать только латинские буквы, цифры и спецсимволы'
    }
  },
  first_name: {
    required: true,
    min: 1,
    max: 100,
    pattern: /^[A-Za-zА-Яа-я]+$/,
    messages: {
      required: 'Имя обязательно',
      min: 'Имя не может быть пустым',
      max: 'Максимум 100 символов',
      pattern: 'Имя может содержать только латинские и кириллические буквы'
    }
  },
  last_name: {
    required: true,
    min: 1,
    max: 100,
    pattern: /^[A-Za-zА-Яа-я]+$/,
    messages: {
      required: 'Фамилия обязательна',
      min: 'Фамилия не может быть пустой',
      max: 'Максимум 100 символов',
      pattern: 'Фамилия может содержать только латинские и кириллические буквы'
    }
  },
  bio: {
    required: false,
    max: 1000,
    messages: { max: 'Максимум 1000 символов' }
  },
  education_degree: {
    required: false,
    max: 255,
    pattern: /^[A-Za-zА-Яа-я\s\-.,]+$/,
    messages: {
      max: 'Максимум 255 символов',
      pattern: 'Образование может содержать только буквы, пробелы, дефисы, запятые и точки'
    }
  },
  sports_rank: {
    required: false,
    max: 100,
    pattern: /^[A-Za-zА-Яа-я\s\-.,]+$/,
    messages: {
      max: 'Максимум 100 символов',
      pattern: 'Виды спорта могут содержать только буквы, пробелы, дефисы, запятые и точки'
    }
  },
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
  },
  donation_message: {
    required: false,
    max: 500,
    messages: { max: 'Максимум 500 символов' }
  }
};

interface Checks {
  required: (value: unknown) => boolean;
  minLength: (value: string, min: number) => boolean;
  maxLength: (value: string, max: number) => boolean;
  pattern: (value: string, regex: RegExp) => boolean;
  email: (value: string) => boolean;
  username: (value: string) => boolean;
  dateFormat: (value: string) => boolean;
  passwordsMatch: (password: string, repeat: string) => boolean;
  nonNegative: (value: number) => boolean;
}

const checks: Checks = {
  required: (value: unknown): boolean => value !== undefined && value !== null && value !== '',
  minLength: (value: string, min: number): boolean => !value || value.length >= min,
  maxLength: (value: string, max: number): boolean => !value || value.length <= max,
  pattern: (value: string, regex: RegExp): boolean => !value || regex.test(value),
  email: (value: string): boolean => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
  username: (value: string): boolean => !value || /^[A-Za-z0-9_]{3,30}$/.test(value),
  dateFormat: (value: string): boolean => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  passwordsMatch: (password: string, repeat: string): boolean => password === repeat,
  nonNegative: (value: number): boolean => typeof value === 'number' && value >= 0
};

interface TrainerSportInput {
  sport_type_id: number;
  experience_years: number;
  sports_rank?: string | null;
}

interface TrainerDetailsInput {
  career_since_date?: string | null;
  education_degree?: string | null;
  sports: TrainerSportInput[];
}

interface ClientRegisterData {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
}

interface TrainerRegisterData {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
  trainer_details: TrainerDetailsInput;
}

export class Validator {
  private errors: ValidationError[] = [];
  public rules: Rules = rules;

  reset(): void {
    this.errors = [];
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  addError(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  /**
   * Проверяет, является ли дата в будущем (строго после сегодняшнего дня)
   */
  public static isFutureDate(dateStr: string): boolean {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today;
  }

  validateField(
    value: unknown,
    fieldName: string,
    fieldRules: ValidationRule,
    nullable: boolean = false
  ): boolean {
    let val = value;
    if (typeof val === 'string' && !['password', 'password_repeat'].includes(fieldName)) {
      val = val.trim();
    }

    const { required, min, max, pattern, messages = {} } = fieldRules;

    if (nullable && val === null) {
      return true;
    }

    if (required && !checks.required(val)) {
      this.addError(fieldName, (messages.required as string) || `Поле ${fieldName} обязательно`);
      return false;
    }

    if (!val && !required) return true;

    if (min !== undefined && typeof val === 'string' && !checks.minLength(val, min)) {
      this.addError(fieldName, (messages.min as string) || `Минимум ${min} символов`);
    }

    if (max !== undefined && typeof val === 'string' && !checks.maxLength(val, max)) {
      this.addError(fieldName, (messages.max as string) || `Максимум ${max} символов`);
    }

    if (pattern && typeof val === 'string' && !checks.pattern(val, pattern)) {
      this.addError(fieldName, (messages.pattern as string) || 'Недопустимый формат');
    }

    return !this.hasErrors();
  }

  validateUsername(username: string): ValidationResult {
    this.reset();
    this.validateField(username, 'username', rules.username);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validateEmail(email: string): ValidationResult {
    this.reset();
    this.validateField(email, 'email', rules.email);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validatePassword(password: string): ValidationResult {
    this.reset();
    this.validateField(password, 'password', rules.password);
    // дополнительные проверки сложности
    if (typeof password === 'string' && password.length > 0) {
      if (!/[A-Za-z]/.test(password)) {
        this.addError('password', 'Пароль должен содержать хотя бы одну букву');
      }
      if (!/[0-9]/.test(password)) {
        this.addError('password', 'Пароль должен содержать хотя бы одну цифру');
      }
    }
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validatePasswordWithConfirmation(password: string, passwordRepeat: string): ValidationResult {
    this.reset();

    this.validateField(password, 'password', rules.password);
    // проверки сложности
    if (typeof password === 'string' && password.length > 0) {
      if (!/[A-Za-z]/.test(password)) {
        this.addError('password', 'Пароль должен содержать хотя бы одну букву');
      }
      if (!/[0-9]/.test(password)) {
        this.addError('password', 'Пароль должен содержать хотя бы одну цифру');
      }
    }

    if (!checks.required(passwordRepeat)) {
      this.addError('password_repeat', 'Подтверждение пароля обязательно');
    } else if (!checks.passwordsMatch(password, passwordRepeat)) {
      this.addError('password_repeat', 'Пароли не совпадают');
    }

    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validateFirstName(firstName: string): ValidationResult {
    this.reset();
    this.validateField(firstName, 'first_name', rules.first_name);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validateLastName(lastName: string): ValidationResult {
    this.reset();
    this.validateField(lastName, 'last_name', rules.last_name);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validateBio(bio: string): ValidationResult {
    this.reset();
    if (bio) {
      this.validateField(bio, 'bio', rules.bio);
    }
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  validateClientRegister(data: ClientRegisterData): ValidationResult {
    this.reset();

    this.validateField(data.username, 'username', rules.username);
    this.validateField(data.email, 'email', rules.email);
    this.validateField(data.first_name, 'first_name', rules.first_name);
    this.validateField(data.last_name, 'last_name', rules.last_name);

    const passwordResult = this.validatePasswordWithConfirmation(data.password, data.password_repeat);

    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(err => this.addError(err.field, err.message));
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      apiFormat: this.formatErrorsForAPI()
    };
  }

  private validateTrainerSport(sport: TrainerSportInput, index: number): ValidationError[] {
    const errors: ValidationError[] = [];

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

    if (sport.sports_rank !== undefined && sport.sports_rank !== null && sport.sports_rank !== '') {
      const rank = sport.sports_rank;
      const rankRules = rules.sports_rank;
      const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g;

      if (emojiRegex.test(rank)) {
        errors.push({
          field: `sports[${index}].sports_rank`,
          message: 'Спортивный разряд не может содержать смайлы'
        });
      }

      if (rankRules.max && rank.length > rankRules.max) {
        errors.push({
          field: `sports[${index}].sports_rank`,
          message: rankRules.messages?.max as string || ''
        });
      }

      if (rankRules.pattern && !checks.pattern(rank, rankRules.pattern)) {
        errors.push({
          field: `sports[${index}].sports_rank`,
          message: rankRules.messages?.pattern as string || ''
        });
      }
    }

    return errors;
  }

  private validateTrainerDetails(details: TrainerDetailsInput): ValidationError[] {
    const errors: ValidationError[] = [];

    const careerDate = details.career_since_date?.trim() || '';
    if (careerDate !== '') {
      if (!checks.dateFormat(careerDate)) {
        errors.push({
          field: 'career_since_date',
          message: 'Дата должна быть в формате ГГГГ-ММ-ДД'
        });
      } else if (Validator.isFutureDate(careerDate)) {
        errors.push({
          field: 'career_since_date',
          message: 'Дата не может быть в будущем'
        });
      }
    }

    if (details.education_degree !== undefined && details.education_degree !== null && details.education_degree !== '') {
      const degree = details.education_degree;
      const educationRules = rules.education_degree;
      const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g;

      if (emojiRegex.test(degree)) {
        errors.push({
          field: 'education_degree',
          message: 'Степень образования не может содержать смайлы'
        });
      }

      if (educationRules.max && degree.length > educationRules.max) {
        errors.push({
          field: 'education_degree',
          message: educationRules.messages?.max as string || ''
        });
      }

      if (educationRules.pattern && !checks.pattern(degree, educationRules.pattern)) {
        errors.push({
          field: 'education_degree',
          message: educationRules.messages?.pattern as string || ''
        });
      }
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

  validateTrainerRegister(data: TrainerRegisterData): ValidationResult {
    this.reset();

    this.validateField(data.username, 'username', rules.username);
    this.validateField(data.email, 'email', rules.email);
    this.validateField(data.first_name, 'first_name', rules.first_name);
    this.validateField(data.last_name, 'last_name', rules.last_name);

    const passwordResult = this.validatePasswordWithConfirmation(data.password, data.password_repeat);
    if (passwordResult.errors.length > 0) {
      passwordResult.errors.forEach(err => this.addError(err.field, err.message));
    }

    if (!data.trainer_details) {
      this.addError('trainer_details', 'Данные тренера обязательны');
    } else {
      const trainerErrors = this.validateTrainerDetails(data.trainer_details);
      trainerErrors.forEach(err => this.addError(err.field, err.message));
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      apiFormat: this.formatErrorsForAPI()
    };
  }

  formatErrorsForAPI(): ValidationResult['apiFormat'] {
    if (!this.hasErrors()) return null;

    return {
      error: {
        code: 'validation_error',
        message: 'Некорректные данные',
        fields: this.getErrors()
      }
    };
  }

  validatePostEditor(data: { title: string; text_content: string }): ValidationResult {
    this.reset();
    const title = data?.title ?? '';
    const textContent = data?.text_content ?? '';
    this.validateField(title, 'title', rules.post_title);
    this.validateField(textContent, 'text_content', rules.post_body);
    return { isValid: !this.hasErrors(), errors: this.getErrors() };
  }

  static parseDonationAmount(raw: unknown): number | null {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  validateDonationForm(data: { amount: string; email: string; message?: string }): DonationValidationResult {
    this.reset();
    const amountNum = Validator.parseDonationAmount(data?.amount);
    const email = data?.email ?? '';
    const message = data?.message?.trim() ?? '';

    if (amountNum === null) {
      this.addError('amount', 'Введите корректную сумму');
    } else if (amountNum <= 0) {
      this.addError('amount', 'Сумма должна быть больше нуля');
    } else if (amountNum > 1_000_000_000) {
      this.addError('amount', 'Сумма слишком велика');
    }

    this.validateField(email, 'email', rules.receipt_email);

    if (message.length > 500) {
      this.addError('message', 'Максимум 500 символов');
    }

    return {
      isValid: !this.hasErrors(),
      errors: this.getErrors(),
      amountNumber: amountNum
    };
  }
}
