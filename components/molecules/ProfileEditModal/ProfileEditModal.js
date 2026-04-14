// components/molecules/ProfileEditModal/ProfileEditModal.js
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button.js';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.js';
import { Validator } from '/src/utils/validator.js';

/**
 * Открывает модальное окно редактирования профиля
 * @param {Object} options
 * @param {import('/src/utils/api.js').ApiClient} options.api
 * @param {Object} options.currentUser - текущий пользователь
 * @param {Function} options.onUpdated - колбэк после успешного обновления
 */
export async function openProfileEditModal({ api, currentUser, onUpdated }) {
  const template = Handlebars.templates['ProfileEditModal.hbs'];

  const user = currentUser?.user || currentUser;
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const avatarUrl = user.avatar_url || '';
  const originalIsTrainer = user.is_trainer;

  const root = document.createElement('div');
  root.innerHTML = template({ avatar: avatarUrl, initials }).trim();
  const modal = root.firstElementChild;

  const form = modal.querySelector('.profile-edit-modal__form');
  const fieldsContainer = modal.querySelector('#profile-edit-fields');
  const globalErr = modal.querySelector('[data-profile-edit-global-error]');
  const cancelWrap = modal.querySelector('#profile-edit-cancel-wrap');
  const submitWrap = modal.querySelector('#profile-edit-submit-wrap');

  const avatarInput = modal.querySelector('#profile-avatar-input');
  const avatarPreview = modal.querySelector('#profile-avatar-preview');
  const avatarPlaceholder = modal.querySelector('.profile-edit-modal__avatar-placeholder');
  const removeAvatarBtn = modal.querySelector('#profile-avatar-remove');

  let avatarFile = null;
  let avatarRemoved = false;
  let becomingTrainer = false;

  const validator = new Validator();
  const inputsApi = new Map();

  // Базовые поля (для всех)
  const baseFields = [
    { name: 'username', label: 'Имя пользователя', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 30, placeholder: 'john_doe' },
    { name: 'first_name', label: 'Имя', type: INPUT_TYPES.NAME, required: true, maxlength: 100, placeholder: 'Введите имя' },
    { name: 'last_name', label: 'Фамилия', type: INPUT_TYPES.NAME, required: true, maxlength: 100, placeholder: 'Введите фамилию' },
    { name: 'bio', label: 'О себе', type: INPUT_TYPES.WITHOUTS, required: false, maxlength: 1000, placeholder: 'Расскажите о себе' }
  ];

  // Поля тренера
  const trainerFields = [
    { name: 'education_degree', label: 'Образование', type: INPUT_TYPES.WITHOUTS, required: false, maxlength: 255, placeholder: 'Введите образование' },
    { name: 'career_since_date', label: 'Дата начала профессиональной деятельности', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 10, placeholder: 'ГГГГ-ММ-ДД' },
    { name: 'sport_discipline', label: 'Вид дисциплины/спорта', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 100, placeholder: 'например: футбол, плавание, бокс' }
  ];

  // Функция рендера полей
  const renderFields = async (showTrainerFields) => {
    fieldsContainer.innerHTML = '';
    inputsApi.clear();

    const fieldsToRender = [...baseFields];
    if (showTrainerFields) {
      fieldsToRender.push(...trainerFields);
    }

    for (const field of fieldsToRender) {
      const container = document.createElement('div');
      fieldsContainer.appendChild(container);

      let value = user[field.name] || '';
      if (showTrainerFields && !originalIsTrainer) {
        value = '';
      } else if (originalIsTrainer) {
        if (field.name === 'education_degree' || field.name === 'career_since_date') {
          value = user.trainer_details?.[field.name] || '';
        } else if (field.name === 'sport_discipline') {
          value = user.trainer_details?.sports?.[0]?.sports_rank || '';
        }
      }

      const api = await renderInput(container, {
        type: field.type,
        label: field.label,
        name: field.name,
        value: value,
        placeholder: field.placeholder,
        required: field.required,
        maxlength: field.maxlength,
        onChange: () => api.setNormal()
      });

      if (field.name === 'career_since_date') {
        const input = api.input;
        input.addEventListener('input', e => {
          let val = e.target.value.replace(/\D/g, '');
          if (val.length >= 4) {
            let formatted = val.substring(0, 4);
            if (val.length > 4) formatted += '-' + val.substring(4, 6);
            if (val.length > 6) formatted += '-' + val.substring(6, 8);
            e.target.value = formatted;
          } else {
            e.target.value = val;
          }
        });
      }

      if (field.name === 'sport_discipline') {
        const helpText = document.createElement('small');
        helpText.textContent = 'Можно указать несколько через запятую';
        helpText.style.cssText = `
          font-size: var(--font-size-xs);
          color: var(--text-placeholder);
          margin-top: 2px;
          display: block;
        `;
        container.appendChild(helpText);
      }

      inputsApi.set(field.name, api);
    }
  };

  // Первичный рендер
  await renderFields(originalIsTrainer);

  // Кнопка "Стать тренером" для клиента
  if (!originalIsTrainer) {
    const becomeTrainerContainer = document.createElement('div');
    becomeTrainerContainer.style.marginTop = 'var(--spacing-md)';
    becomeTrainerContainer.style.textAlign = 'center';
    fieldsContainer.appendChild(becomeTrainerContainer);

    await renderButton(becomeTrainerContainer, {
      text: 'Стать тренером',
      variant: BUTTON_VARIANTS.SECONDARY_BLUE,
      size: BUTTON_SIZES.MEDIUM,
      onClick: async () => {
        becomingTrainer = true;
        await renderFields(true);
        becomeTrainerContainer.remove();
      }
    });
  }

  // Управление аватаром
  const updateAvatarPreview = () => {
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

  avatarInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      avatarFile = file;
      avatarRemoved = false;
    } else {
      avatarFile = null;
    }
    updateAvatarPreview();
  });

  removeAvatarBtn.addEventListener('click', () => {
    avatarFile = null;
    avatarRemoved = true;
    avatarInput.value = '';
    updateAvatarPreview();
  });

  // Закрытие
  const close = () => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = e => {
    if (e.key === 'Escape') close();
  };

  modal.querySelectorAll('[data-profile-edit-close]').forEach(el => {
    el.addEventListener('click', close);
  });

  // Кнопки
  await renderButton(cancelWrap, {
    text: 'Отмена',
    variant: BUTTON_VARIANTS.TEXT_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'button',
    onClick: close
  });

  const saveBtn = await renderButton(submitWrap, {
    text: 'Сохранить',
    variant: BUTTON_VARIANTS.PRIMARY_ORANGE,
    size: BUTTON_SIZES.MEDIUM,
    type: 'submit'
  });

  // Валидация
  const validateField = (fieldName, value) => {
    const api = inputsApi.get(fieldName);
    if (!api) return true;

    let result;
    switch (fieldName) {
      case 'username':
        result = validator.validateUsername(value);
        break;
      case 'first_name':
        result = validator.validateFirstName(value);
        break;
      case 'last_name':
        result = validator.validateLastName(value);
        break;
      case 'bio':
        result = { isValid: !value || value.length <= 1000, errors: [] };
        break;
      case 'education_degree':
        validator.reset();
        validator.validateField(value, 'education_degree', validator.rules.education_degree);
        result = { isValid: !validator.hasErrors(), errors: validator.getErrors() };
        break;
      case 'career_since_date':
        if (!value) {
          result = { isValid: false, errors: [{ field: 'career_since_date', message: 'Дата обязательна' }] };
        } else {
          const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
          result = {
            isValid: isValidFormat,
            errors: isValidFormat ? [] : [{ field: 'career_since_date', message: 'Формат ГГГГ-ММ-ДД' }]
          };
        }
        break;
      case 'sport_discipline':
        validator.reset();
        validator.validateField(value, 'sports_rank', validator.rules.sports_rank);
        result = { isValid: !validator.hasErrors(), errors: validator.getErrors() };
        break;
      default:
        return true;
    }

    if (!result.isValid && result.errors.length > 0) {
      api.setError(result.errors[0].message);
      return false;
    } else {
      api.setNormal();
      return true;
    }
  };

  const validateForm = () => {
    let isValid = true;
    for (const [name, api] of inputsApi) {
      const value = api.getValue();
      if (!validateField(name, value)) {
        isValid = false;
      }
    }
    return isValid;
  };

  // Отправка
  form.addEventListener('submit', async e => {
    e.preventDefault();
    globalErr.hidden = true;

    if (!validateForm()) return;

    saveBtn.setDisabled(true);
    try {
      const profileData = {};
      for (const [name, api] of inputsApi) {
        profileData[name] = api.getValue().trim();
      }

      await api.request('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username: profileData.username,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          bio: profileData.bio || ''
        })
      });

      if (becomingTrainer || originalIsTrainer) {
        const trainerDetails = {
          education_degree: profileData.education_degree || '',
          career_since_date: profileData.career_since_date,
          sports: [{
            sport_type_id: 1,
            experience_years: 1,
            sports_rank: profileData.sport_discipline || ''
          }]
        };

        await api.request('/profiles/me/trainer', {
          method: becomingTrainer ? 'POST' : 'PATCH',
          body: JSON.stringify(trainerDetails)
        });
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        await fetch(`${api.baseURL}/profiles/me/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      }

      onUpdated?.();
      close();
    } catch (error) {
      console.error('Profile update error:', error);
      let message = error.message || 'Не удалось сохранить изменения';
      if (error.data?.error?.fields) {
        error.data.error.fields.forEach(f => {
          const api = inputsApi.get(f.field);
          if (api) api.setError(f.message);
        });
        message = error.data.error.message;
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
