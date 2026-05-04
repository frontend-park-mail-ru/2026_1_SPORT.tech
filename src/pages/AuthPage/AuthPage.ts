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

export async function renderAuthPage(
  container: HTMLElement,
  api: ApiClient
): Promise<void> {
  let currentMode: string = AUTH_MODES.LOGIN;
  let _form: AuthFormAPI | null = null; // ← Исправлено: убран any

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
      alert('Введите дату в формате ГГГГ-ММ-ДД (например, 2020-01-01)');
      return;
    }

    if (sports.length === 0) {
      alert('Выберите хотя бы один вид спорта');
      return;
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
      localStorage.setItem('user', JSON.stringify(response.user));
      window.router?.setCurrentUser(response);
      window.router.navigateTo('/');
    }
  }

  async function switchMode(newMode: string): Promise<void> {
    currentMode = newMode;
    await render();
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

  await render();
}
