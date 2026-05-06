/**
 * @fileoverview Модальное окно редактирования профиля
 * @module components/molecules/ProfileEditModal
 */

import type { ApiClient } from '../../../utils/api';
import type { User, Profile, TrainerDetails } from '../../../types/api.types';
import type { ButtonAPI } from '../../atoms/Button/Button';
import type { InputAPI, InputType } from '../../atoms/Input/Input';
import type { SportTypeFieldApi, SportTypeFieldOption } from '../../../types/components.types';
import type { ValidationResult } from '../../../types/validation.types';
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input';
import { createSportTypesField, loadSportTypes } from '../../organisms/AuthForm/AuthForm';
import { Validator } from '../../../utils/validator';

export interface ProfileEditModalOptions {
  api: ApiClient;
  currentUser: { user: User } | User;
  onUpdated?: () => void;
}

interface FieldConfig {
  name: string;
  label: string;
  type: InputType;
  required: boolean;
  maxlength: number;
  placeholder: string;
}

interface ExtendedUser extends User {
  trainer_details?: TrainerDetails;
}

export async function openProfileEditModal({
  api,
  currentUser,
  onUpdated
}: ProfileEditModalOptions): Promise<void> {
  const template = (window as any).Handlebars.templates['ProfileEditModal.hbs'];

  let user: ExtendedUser = ('user' in currentUser ? currentUser.user : currentUser) as ExtendedUser;

  if (user.is_trainer && !user.trainer_details) {
    try {
      const profileData: Profile = await api.getProfile(user.user_id);
      user = { ...user, ...profileData };
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  const fullName: string = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials: string = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const avatarUrl: string = user.avatar_url || '';
  const originalIsTrainer: boolean = user.is_trainer;

  const root = document.createElement('div');
  root.innerHTML = template({ avatar: avatarUrl, initials }).trim();
  const modal = root.firstElementChild as HTMLElement;

  const form = modal.querySelector('.profile-edit-modal__form') as HTMLFormElement;
  const fieldsContainer = modal.querySelector('#profile-edit-fields') as HTMLElement;
  const globalErr = modal.querySelector('[data-profile-edit-global-error]') as HTMLElement;
  const cancelWrap = modal.querySelector('#profile-edit-cancel-wrap') as HTMLElement;
  const submitWrap = modal.querySelector('#profile-edit-submit-wrap') as HTMLElement;

  const avatarInput = modal.querySelector('#profile-avatar-input') as HTMLInputElement;
  const avatarPreview = modal.querySelector('#profile-avatar-preview') as HTMLImageElement;
  const avatarPlaceholder = modal.querySelector('.profile-edit-modal__avatar-placeholder') as HTMLElement;
  const removeAvatarBtn = modal.querySelector('#profile-avatar-remove') as HTMLButtonElement;

  // Установить ограничения для аватара
  if (avatarInput) {
    avatarInput.setAttribute('accept', 'image/*');
  }

  let avatarFile: File | null = null;
  let avatarRemoved: boolean = false;
  const becomingTrainer: boolean = false;
  let sportTypeOptions: SportTypeFieldOption[] = [];
  let sportTypesLoaded: boolean = false;

  const validator = new Validator();
  const inputsApi = new Map<string, InputAPI | SportTypeFieldApi>();

  const baseFields: FieldConfig[] = [
    { name: 'username', label: 'Имя пользователя', type: INPUT_TYPES.WITHOUTS as InputType, required: true, maxlength: 30, placeholder: 'john_doe' },
    { name: 'first_name', label: 'Имя', type: INPUT_TYPES.NAME as InputType, required: true, maxlength: 100, placeholder: 'Введите имя' },
    { name: 'last_name', label: 'Фамилия', type: INPUT_TYPES.NAME as InputType, required: true, maxlength: 100, placeholder: 'Введите фамилию' },
    { name: 'bio', label: 'О себе', type: INPUT_TYPES.WITHOUTS as InputType, required: false, maxlength: 1000, placeholder: 'Расскажите о себе' }
  ];

  const trainerFields: FieldConfig[] = [
    { name: 'education_degree', label: 'Образование', type: INPUT_TYPES.WITHOUTS as InputType, required: false, maxlength: 255, placeholder: 'Введите образование' },
    // Теперь дата необязательна
    { name: 'career_since_date', label: 'Дата начала профессиональной деятельности', type: INPUT_TYPES.WITHOUTS as InputType, required: false, maxlength: 10, placeholder: 'ГГГГ-ММ-ДД' },
    { name: 'sport_discipline', label: 'Вид дисциплины/спорта', type: INPUT_TYPES.WITHOUTS as InputType, required: true, maxlength: 100, placeholder: 'Выберите виды спорта' }
  ];

  // Безопасное получение значения поля пользователя
  const getUserFieldValue = (fieldName: string): string => {
    switch (fieldName) {
    case 'username': return user.username || '';
    case 'first_name': return user.first_name || '';
    case 'last_name': return user.last_name || '';
    case 'bio': return user.bio || '';
    case 'education_degree': return user.trainer_details?.education_degree || '';
    case 'career_since_date': return user.trainer_details?.career_since_date || '';
    default: return '';
    }
  };

  const getSportTypeIds = (): number[] => {
    return user.trainer_details?.sports
      ? user.trainer_details.sports
        .map(sport => Number(sport.sport_type_id))
        .filter(id => Number.isFinite(id))
      : [];
  };

  const validateField = (fieldName: string, value: string | number[]): boolean => {
    const api = inputsApi.get(fieldName);
    if (!api) return true;

    let result: ValidationResult;

    switch (fieldName) {
    case 'username':
      result = validator.validateUsername(value as string);
      break;
    case 'first_name':
      result = validator.validateFirstName(value as string);
      break;
    case 'last_name':
      result = validator.validateLastName(value as string);
      break;
    case 'bio':
      validator.reset();
      if (typeof value === 'string' && value.length > 1000) {
        result = { isValid: false, errors: [{ field: 'bio', message: 'Максимум 1000 символов' }] };
      } else {
        result = { isValid: true, errors: [] };
      }
      break;
    case 'education_degree':
      validator.reset();
      if (typeof value === 'string' && value.trim() !== '') {
        validator.validateField(value, 'education_degree', validator.rules.education_degree);
      }
      result = { isValid: !validator.hasErrors(), errors: validator.getErrors() };
      break;
    case 'career_since_date': {
      const dateStr = (value as string).trim();
      if (!dateStr) {
        // поле необязательное
        result = { isValid: true, errors: [] };
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        result = { isValid: false, errors: [{ field: 'career_since_date', message: 'Формат ГГГГ-ММ-ДД' }] };
      } else if (Validator.isFutureDate(dateStr)) {
        result = { isValid: false, errors: [{ field: 'career_since_date', message: 'Дата не может быть в будущем' }] };
      } else {
        result = { isValid: true, errors: [] };
      }
      break;
    }
    case 'sport_discipline':
      result = Array.isArray(value) && value.length > 0
        ? { isValid: true, errors: [] }
        : {
          isValid: false,
          errors: [{ field: 'sport_discipline', message: 'Выберите хотя бы один вид спорта' }]
        };
      break;
    default:
      return true;
    }

    if (!result.isValid && result.errors.length > 0) {
      if ('setError' in api) {
        (api as InputAPI).setError(result.errors[0].message);
      }
      return false;
    } else {
      if ('setNormal' in api) {
        (api as InputAPI).setNormal();
      }
      return true;
    }
  };

  const getFieldValue = (fieldName: string): string | number[] => {
    const api = inputsApi.get(fieldName);
    if (!api) return '';
    return api.getValue();
  };

  const renderFields = async (showTrainerFields: boolean): Promise<void> => {
    fieldsContainer.innerHTML = '';
    inputsApi.clear();

    if (showTrainerFields && !sportTypesLoaded) {
      sportTypesLoaded = true;
      sportTypeOptions = await loadSportTypes(api);
    }

    const fieldsToRender: FieldConfig[] = [...baseFields];
    if (showTrainerFields) {
      fieldsToRender.push(...trainerFields);
    }

    for (const field of fieldsToRender) {
      const container = document.createElement('div');
      fieldsContainer.appendChild(container);

      let value: string | number[];

      if (field.name === 'sport_discipline') {
        value = getSportTypeIds();
      } else {
        value = getUserFieldValue(field.name);
      }

      if (field.name === 'sport_discipline') {
        const sportFieldApi = createSportTypesField(container, {
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: sportTypeOptions,
          onChange: (newValue: number[]) => {
            validateField(field.name, newValue);
          }
        }) as SportTypeFieldApi;

        sportFieldApi.setValue(value as number[]);

        const helpText = document.createElement('small');
        helpText.textContent = sportTypeOptions.length > 0
          ? 'Выберите один или несколько видов спорта'
          : 'Не удалось загрузить список видов спорта';
        helpText.style.cssText = `
          font-size: var(--font-size-xs);
          color: var(--text-placeholder);
          margin-top: 2px;
          display: block;
        `;
        container.appendChild(helpText);

        inputsApi.set(field.name, sportFieldApi);
        continue;
      }

      const inputApi: InputAPI = await renderInput(container, {
        type: field.type,
        label: field.label,
        name: field.name,
        value: value as string,
        placeholder: field.placeholder,
        required: field.required,
        maxlength: field.maxlength,
        onChange: (newValue: string) => {
          validateField(field.name, newValue);
        }
      });

      if (field.name === 'career_since_date') {
        const input = inputApi.input;
        input.addEventListener('input', (e: Event) => {
          const target = e.target as HTMLInputElement;
          let val = target.value.replace(/\D/g, '');
          if (val.length >= 4) {
            let formatted = val.substring(0, 4);
            if (val.length > 4) formatted += '-' + val.substring(4, 6);
            if (val.length > 6) formatted += '-' + val.substring(6, 8);
            target.value = formatted;
          } else {
            target.value = val;
          }
          validateField(field.name, target.value);
        });
      }

      inputsApi.set(field.name, inputApi);
    }
  };

  await renderFields(originalIsTrainer);

  const updateAvatarPreview = (): void => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      avatarPreview.src = url;
      avatarPreview.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
    } else if (avatarRemoved || !avatarUrl) {
      avatarPreview.style.display = 'none';
      avatarPlaceholder.style.display = 'flex';
      avatarPlaceholder.textContent = initials;
    } else {
      avatarPreview.src = avatarUrl;
      avatarPreview.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
    }
  };

  avatarInput.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0] || null;
    if (file && !file.type.startsWith('image/')) {
      // Ошибка: не изображение
      alert('Пожалуйста, выберите изображение (JPG, PNG, GIF и т.д.).');
      target.value = ''; // сброс
      avatarFile = null;
      avatarRemoved = false;
      return;
    }
    avatarFile = file;
    avatarRemoved = false;
    updateAvatarPreview();
  });

  removeAvatarBtn.addEventListener('click', () => {
    avatarFile = null;
    avatarRemoved = true;
    avatarInput.value = '';
    updateAvatarPreview();
  });

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };

  modal.querySelectorAll('[data-profile-edit-close]').forEach(el => {
    el.addEventListener('click', close);
  });

  await renderButton(cancelWrap, {
    text: 'Отмена',
    variant: BUTTON_VARIANTS.TEXT_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'button',
    onClick: close
  });

  const saveBtn: ButtonAPI = await renderButton(submitWrap, {
    text: 'Сохранить',
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'submit'
  });

  const validateForm = (): boolean => {
    let isValid = true;
    const showTrainerFields = originalIsTrainer || becomingTrainer;

    for (const [name] of inputsApi) {
      const value = getFieldValue(name);

      if (!showTrainerFields && (name === 'education_degree' || name === 'career_since_date' || name === 'sport_discipline')) {
        continue;
      }

      if (!validateField(name, value)) {
        isValid = false;
      }
    }

    return isValid;
  };

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    globalErr.hidden = true;

    if (!validateForm()) return;

    saveBtn.setDisabled(true);

    try {
      // Триммируем все строковые поля перед отправкой
      const updatePayload: Record<string, unknown> = {
        username: (getFieldValue('username') as string).trim(),
        first_name: (getFieldValue('first_name') as string).trim(),
        last_name: (getFieldValue('last_name') as string).trim(),
        bio: ((getFieldValue('bio') as string) || '').trim()
      };

      if (originalIsTrainer || becomingTrainer) {
        const careerDateStr = (getFieldValue('career_since_date') as string).trim();
        // Если дата пустая, не передаём её (она опциональна)
        const trainerDetailsPayload: Record<string, unknown> = {
          education_degree: ((getFieldValue('education_degree') as string) || '').trim()
        };
        if (careerDateStr) {
          trainerDetailsPayload.career_since_date = careerDateStr;
        }

        const selectedSportTypes = getFieldValue('sport_discipline') as number[];
        const existingSports = user.trainer_details?.sports || [];
        const existingSportsById = new Map(
          existingSports.map(sport => [Number(sport.sport_type_id), sport])
        );

        trainerDetailsPayload.sports = selectedSportTypes.map(sportTypeId => {
          const existingSport = existingSportsById.get(Number(sportTypeId));
          // Рассчитываем опыт от даты (если она есть)
          let experienceYears = 0;
          if (careerDateStr) {
            const careerDate = new Date(careerDateStr);
            const today = new Date();
            experienceYears = today.getFullYear() - careerDate.getFullYear();
            const monthDiff = today.getMonth() - careerDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < careerDate.getDate())) {
              experienceYears--;
            }
            if (experienceYears < 0) experienceYears = 0;
          }
          return {
            sport_type_id: Number(sportTypeId),
            experience_years: experienceYears,
            ...(existingSport?.sports_rank ? { sports_rank: existingSport.sports_rank } : {})
          };
        });

        updatePayload.trainer_details = trainerDetailsPayload;
      }

      await api.request('/v1/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(updatePayload)
      });

      if (avatarFile) {
        await api.uploadAvatar(avatarFile);
      } else if (avatarRemoved) {
        try {
          await api.deleteAvatar();
        } catch {
          // Если deleteAvatar не сработал
        }
      }

      onUpdated?.();
      close();
    } catch (error: unknown) {
      const err = error as { message?: string; data?: { error?: { message?: string; fields?: Array<{ field: string; message: string }> } } };
      let message = err.message || 'Не удалось сохранить изменения';

      if (err.data?.error?.fields) {
        err.data.error.fields.forEach(f => {
          const api = inputsApi.get(f.field);
          if (api && 'setError' in api) {
            (api as InputAPI).setError(f.message);
          }
        });
        message = err.data.error.message || message;
      }

      globalErr.textContent = message;
      globalErr.hidden = false;
    } finally {
      saveBtn.setDisabled(false);
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
  modal.focus({ preventScroll: true });
  updateAvatarPreview();
}
