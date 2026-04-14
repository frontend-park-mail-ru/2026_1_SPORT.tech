// components/molecules/ProfileEditModal/ProfileEditModal.js
import { BUTTON_SIZES, BUTTON_VARIANTS, renderButton } from '../../atoms/Button/Button.js';
import { INPUT_TYPES, renderInput } from '../../atoms/Input/Input.js';
import { Validator } from '/src/utils/validator.js';
import { ApiClient } from '/src/utils/api.js';

/**
 * Открывает модальное окно редактирования профиля
 * @param {Object} options
 * @param {ApiClient} options.api
 * @param {Object} options.currentUser - текущий пользователь (из ответа /auth/me)
 * @param {Function} options.onUpdated - колбэк после успешного обновления
 */
export async function openProfileEditModal({ api, currentUser, onUpdated }) {
  const template = Handlebars.templates['ProfileEditModal.hbs'];

  // Подготовка данных
  const user = currentUser?.user || currentUser; // поддержка разных форматов
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const avatarUrl = user.avatar_url || '';

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

  const validator = new Validator();
  const inputsApi = new Map();

  // Определяем поля в зависимости от роли
  const isTrainer = user.is_trainer;
  const fields = [
    { name: 'username', label: 'Имя пользователя', type: INPUT_TYPES.WITHOUTS, required: true, maxlength: 30 },
    { name: 'first_name', label: 'Имя', type: INPUT_TYPES.NAME, required: true, maxlength: 100 },
    { name: 'last_name', label: 'Фамилия', type: INPUT_TYPES.NAME, required: true, maxlength: 100 },
    { name: 'bio', label: 'О себе', type: INPUT_TYPES.WITHOUTS, required: false, maxlength: 1000 }
  ];

  // Для тренера можно добавить дополнительные поля (только отображение, т.к. API нет)
  // Но пока оставим общие.

  // Рендерим поля
  for (const field of fields) {
    const container = document.createElement('div');
    fieldsContainer.appendChild(container);
    const api = await renderInput(container, {
      type: field.type,
      label: field.label,
      name: field.name,
      value: user[field.name] || '',
      required: field.required,
      maxlength: field.maxlength,
      onChange: () => api.setNormal()
    });
    inputsApi.set(field.name, api);
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

  // Валидация формы
  const validateForm = () => {
    let isValid = true;
    for (const [name, api] of inputsApi) {
      const value = api.getValue();
      const fieldRules = validator.rules[name];
      if (fieldRules) {
        validator.reset();
        validator.validateField(value, name, fieldRules);
        if (validator.hasErrors()) {
          api.setError(validator.getErrors()[0].message);
          isValid = false;
        } else {
          api.setNormal();
        }
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
      // 1. Обновление текстовых данных
      const profileData = {};
      for (const [name, api] of inputsApi) {
        profileData[name] = api.getValue().trim();
      }

      await api.request('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(profileData)
      });

      // 2. Загрузка аватара, если есть изменения
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        await fetch(`${api.baseURL}/profiles/me/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      } else if (avatarRemoved) {
        // API не предоставляет удаление аватара? Возможно, нужно отправить null или пустую строку.
        // Пока пропустим.
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

  // Установка начального состояния аватара
  updateAvatarPreview();
}
