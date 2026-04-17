// components/molecules/ProfileEditModal/ProfileEditModal.js
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button.js';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.js';
import { Validator } from '/src/utils/validator.js';

export async function openProfileEditModal({ api, currentUser, onUpdated }) {
  const template = Handlebars.templates['ProfileEditModal.hbs'];

  let user = currentUser?.user || currentUser;

  if (user.is_trainer && !user.trainer_details) {
    try {
      const profileData = await api.getProfile(user.user_id);
      user = { ...user, ...profileData };
    } catch (error) {

    }
  }
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

  const baseFields = [
    { name: 'username', label: 'Имя пользователя', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 30, placeholder: 'john_doe' },
    { name: 'first_name', label: 'Имя', type: INPUT_TYPES.NAME, required: true, maxlength: 100, placeholder: 'Введите имя' },
    { name: 'last_name', label: 'Фамилия', type: INPUT_TYPES.NAME, required: true, maxlength: 100, placeholder: 'Введите фамилию' },
    { name: 'bio', label: 'О себе', type: INPUT_TYPES.WITHOUTS, required: false, maxlength: 1000, placeholder: 'Расскажите о себе' }
  ];

  const trainerFields = [
    { name: 'education_degree', label: 'Образование', type: INPUT_TYPES.WITHOUTS, required: false, maxlength: 255, placeholder: 'Введите образование' },
    { name: 'career_since_date', label: 'Дата начала профессиональной деятельности', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 10, placeholder: 'ГГГГ-ММ-ДД' },
    { name: 'sport_discipline', label: 'Вид дисциплины/спорта', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 100, placeholder: 'например: футбол, плавание, бокс' }
  ];

  // Функция валидации поля (как в AuthForm)
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
        validator.reset();
        if (value && value.length > 1000) {
          result = { isValid: false, errors: [{ field: 'bio', message: 'Максимум 1000 символов' }] };
        } else {
          result = { isValid: true, errors: [] };
        }
        break;
      case 'education_degree':
        validator.reset();
        if (value && value.trim() !== '') {
          validator.validateField(value, 'education_degree', validator.rules.education_degree);
        }
        result = { isValid: !validator.hasErrors(), errors: validator.getErrors() };
        break;
      case 'career_since_date':
        if (!value) {
          result = {
            isValid: false,
            errors: [{ field: 'career_since_date', message: 'Дата начала деятельности обязательна' }]
          };
        } else {
          const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/.test(value);
          if (yyyyMmDd) {
            result = { isValid: true, errors: [] };
          } else {
            result = {
              isValid: false,
              errors: [{ field: 'career_since_date', message: 'Формат ГГГГ-ММ-ДД' }]
            };
          }
        }
        break;
      case 'sport_discipline':
        validator.reset();
        if (value && value.trim() !== '') {
          validator.validateField(value, 'sports_rank', validator.rules.sports_rank);
        }
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

      // Загружаем значения из API
      let value = '';

      if (field.name === 'username' || field.name === 'first_name' || field.name === 'last_name') {
        value = user[field.name] || '';
      } else if (field.name === 'bio') {
        value = user.bio || '';
      } else if (field.name === 'education_degree') {
        value = user.trainer_details?.education_degree || '';
      } else if (field.name === 'career_since_date') {
        value = user.trainer_details?.career_since_date || '';
      } else if (field.name === 'sport_discipline') {
        value = user.trainer_details?.sports?.[0]?.sports_rank || '';
      }

      const api = await renderInput(container, {
        type: field.type,
        label: field.label,
        name: field.name,
        value: value,
        placeholder: field.placeholder,
        required: field.required,
        maxlength: field.maxlength,
        onChange: (newValue) => {
          // ДИНАМИЧЕСКАЯ ВАЛИДАЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ
          validateField(field.name, newValue);
        }
      });

      // Маска для даты
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
          // Валидация после форматирования
          validateField(field.name, e.target.value);
        });
      }

      // Подсказка для sport_discipline
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

  // Валидация всей формы перед отправкой
  const validateForm = () => {
    let isValid = true;
    const showTrainerFields = originalIsTrainer || becomingTrainer;

    for (const [name, api] of inputsApi) {
      const value = api.getValue();

      // Пропускаем необязательные поля тренера, если они не отображаются
      if (!showTrainerFields && (name === 'education_degree' || name === 'career_since_date' || name === 'sport_discipline')) {
        continue;
      }

      if (!validateField(name, value)) {
        isValid = false;
      }
    }

    return isValid;
  };


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

    // Подготавливаем тело запроса
    const updatePayload = {
      username: profileData.username,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      bio: profileData.bio || ''
    };

    // Если пользователь тренер или становится тренером — добавляем trainer_details
    if (originalIsTrainer || becomingTrainer) {
      updatePayload.trainer_details = {
        education_degree: profileData.education_degree || '',
        career_since_date: profileData.career_since_date,
        sports: [{
          sport_type_id: 1,  // TODO: брать из выбора видов спорта
          experience_years: 1,
          sports_rank: profileData.sport_discipline || ''
        }]
      };
    }

    console.log('📤 Updating profile with:', updatePayload);

    // Обновление профиля (включая trainer_details)
    await api.request('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(updatePayload)
    });

    // Аватар: загрузка нового или удаление существующего
    if (avatarFile) {
      const formData = new FormData();
      formData.append('avatar', avatarFile, avatarFile.name || 'avatar.jpg');
      await fetch(`${api.baseURL}/profiles/me/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      console.log('✅ Avatar uploaded');
    } else if (avatarRemoved) {
      try {
        await api.deleteAvatar();
        console.log('✅ Avatar deleted');
      } catch (error) {
        console.log('DELETE failed, trying PATCH with avatar_url: null');
        await api.request('/profiles/me', {
          method: 'PATCH',
          body: JSON.stringify({ avatar_url: null })
        });
      }
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
