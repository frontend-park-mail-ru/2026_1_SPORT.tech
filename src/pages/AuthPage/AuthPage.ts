/**
 * @fileoverview Страница авторизации
 * @module pages/AuthPage
 */

import type { ApiClient } from '../../utils/api';
import type { AuthFormAPI } from '../../components/organisms/AuthForm/AuthForm';
import { AUTH_MODES, renderAuthForm } from '../../components/organisms/AuthForm/AuthForm';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_repeat: string;
  first_name: string;
  last_name: string;
  bio?: string;
  trainer_details?: {
    education_degree?: string;
    career_since_date: string;
    sports: Array<{
      sport_type_id: number;
      experience_years: number;
      sports_rank?: string;
    }>;
  };
}

type AuthInitialMode = 'login' | 'register' | 'register-client' | 'register-trainer';

const URL_BY_MODE: Record<string, string> = {
  [AUTH_MODES.LOGIN]: '/auth/login',
  [AUTH_MODES.REGISTER_CLIENT]: '/auth/register',
  [AUTH_MODES.REGISTER_TRAINER]: '/auth/register/trainer'
};

const TITLE_BY_MODE: Record<string, string> = {
  [AUTH_MODES.LOGIN]: 'Вход',
  [AUTH_MODES.REGISTER_CLIENT]: 'Регистрация',
  [AUTH_MODES.REGISTER_TRAINER]: 'Регистрация тренера'
};

export async function renderAuthPage(
  container: HTMLElement,
  api: ApiClient,
  initialMode: AuthInitialMode = 'login'
): Promise<void> {
  let currentMode: string =
    initialMode === 'register' || initialMode === 'register-client'
      ? AUTH_MODES.REGISTER_CLIENT
      : initialMode === 'register-trainer'
        ? AUTH_MODES.REGISTER_TRAINER
        : AUTH_MODES.LOGIN;
  let _form: AuthFormAPI | null = null; // ← Исправлено: убран any

  function syncUrlAndTitle(): void {
    const targetPath = URL_BY_MODE[currentMode];
    if (targetPath && window.location.pathname !== targetPath) {
      history.replaceState(history.state, '', targetPath);
    }
    const title = TITLE_BY_MODE[currentMode];
    if (title) document.title = `Sporteon - ${title}`;
  }

  async function handleLogin(data: LoginData): Promise<void> {
    const response = await api.login(data.email, data.password);

    if (response?.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
      window.router?.setCurrentUser(response);
    }

    window.router.navigateTo('/');
  }

  async function handleClientRegister(data: RegisterData): Promise<void> {
    const response = await api.registerClient({
      username: data.username,
      email: data.email,
      password: data.password,
      password_repeat: data.password_repeat,
      first_name: data.first_name,
      last_name: data.last_name
    });

    if (response?.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
      window.router?.setCurrentUser(response);
    }

    window.router.navigateTo('/');
  }

  async function handleTrainerRegister(data: RegisterData): Promise<void> {
    const careerDate = data.trainer_details?.career_since_date?.trim() || '';
    const sports = Array.isArray(data.trainer_details?.sports) ? data.trainer_details.sports : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(careerDate)) {
      throw new Error('Введите дату в формате ГГГГ-ММ-ДД (например, 2020-01-01)');
    }

    if (sports.length === 0) {
      throw new Error('Выберите хотя бы один вид спорта');
    }

    const response = await api.registerTrainer({
      username: data.username,
      email: data.email,
      password: data.password,
      password_repeat: data.password_repeat,
      first_name: data.first_name,
      last_name: data.last_name,
      trainer_details: {
        education_degree: data.trainer_details?.education_degree || '',
        career_since_date: careerDate,
        sports
      }
    });

    if (response?.user) {
      const bio = data.bio?.trim();
      const authResponse = { user: response.user };

      if (bio) {
        const updatedProfile = await api.updateMyProfile({ bio });
        authResponse.user = { ...authResponse.user, ...updatedProfile };
      }

      localStorage.setItem('user', JSON.stringify(authResponse.user));
      window.router?.setCurrentUser(authResponse);
      window.router.navigateTo('/');
    }
  }

  async function switchMode(newMode: string): Promise<void> {
    // Save common field values before wiping the form
    const savedValues: Record<string, string> = {};
    if (_form) {
      const data = _form.getData();
      for (const key of ['username', 'email', 'password', 'password_repeat', 'first_name', 'last_name']) {
        const val = data[key];
        if (typeof val === 'string' && val) savedValues[key] = val;
      }
    }

    currentMode = newMode;
    syncUrlAndTitle();
    await render();

    // Restore saved values into the new form
    if (_form && Object.keys(savedValues).length > 0) {
      for (const [key, value] of Object.entries(savedValues)) {
        const inputApi = _form.inputs.get(key);
        if (inputApi && 'setValue' in inputApi) {
          (inputApi as any).setValue(value);
        }
      }
    }
  }

  async function render(): Promise<void> {
    container.innerHTML = '';

    const template = (window as any).Handlebars.templates['AuthPage.hbs'];

    const html = template({
      showRoleSelector: currentMode !== AUTH_MODES.LOGIN,
      isClientActive: currentMode === AUTH_MODES.REGISTER_CLIENT,
      isTrainerActive: currentMode === AUTH_MODES.REGISTER_TRAINER
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const pageElement = wrapper.firstElementChild as HTMLElement;

    const formContainer = pageElement.querySelector('.auth-form-container') as HTMLElement;

    _form = await renderAuthForm(formContainer, {
      mode: currentMode as 'login' | 'register-client' | 'register-trainer',
      api: api,
      onSubmit: async (data: Record<string, unknown>, mode: string) => {
        if (mode === AUTH_MODES.LOGIN) {
          await handleLogin(data as unknown as LoginData);
        } else if (mode === AUTH_MODES.REGISTER_CLIENT) {
          await handleClientRegister(data as unknown as RegisterData);
        } else if (mode === AUTH_MODES.REGISTER_TRAINER) {
          await handleTrainerRegister(data as unknown as RegisterData);
        }
      },
      onSwitchMode: (newMode: string) => {
        void switchMode(newMode);
      }
    });

    const roleButtons = pageElement.querySelectorAll('.auth-page__role-btn');
    roleButtons.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        const role = (e.target as HTMLElement).dataset.role;
        if (role === 'client') {
          void switchMode(AUTH_MODES.REGISTER_CLIENT);
        } else if (role === 'trainer') {
          void switchMode(AUTH_MODES.REGISTER_TRAINER);
        }
      });
    });

    container.appendChild(pageElement);
  }

  syncUrlAndTitle();
  await render();
}
