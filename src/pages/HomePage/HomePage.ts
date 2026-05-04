import type { ApiClient } from '../../utils/api';
import type { AuthResponse, TrainerListItem } from '../../types/api.types';
import type { SportType } from '../../types/api.types';
import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar';
import { escapeHtml, getFullName, getUserRoleLabel } from '../../utils/profilePageData';

interface HomePageParams {
  currentUser?: AuthResponse | null;
  onLogout?: (() => Promise<void>) | null;
}

function getInitials(name: string = ''): string {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TR';
}

function getExperienceYears(careerSinceDate: string | null | undefined): number | null {
  if (!careerSinceDate) return null;
  const date = new Date(careerSinceDate);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    years--;
  }
  return years < 0 ? 0 : years;
}

function getYearsWord(years: number): string {
  const lastDigit = years % 10;
  const lastTwoDigits = years % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
  if (lastDigit === 1) return 'год';
  if (lastDigit >= 2 && lastDigit <= 4) return 'года';
  return 'лет';
}

function renderTrainerCard(trainer: TrainerListItem, sportNamesById: Map<number, string>): string {
  const fullName = getFullName(trainer);
  const initials = getInitials(fullName);
  const bio = trainer.bio?.trim() || 'Профиль тренера пока без описания.';
  const experienceYears = getExperienceYears(trainer.trainer_details?.career_since_date);
  const sportNames = Array.isArray(trainer.trainer_details?.sports)
    ? trainer.trainer_details.sports
      .map(sport => sportNamesById.get(Number(sport.sport_type_id)))
      .filter(Boolean)
    : [];

  const sportsMarkup = sportNames.length > 0
    ? sportNames.map(name => `<span class="trainer-card__sport">${escapeHtml(name || '')}</span>`).join('')
    : '<span class="trainer-card__sport trainer-card__sport--muted">Специализация не указана</span>';

  const experienceMarkup = experienceYears === null
    ? ''
    : `<span class="trainer-card__meta-item">Стаж: ${experienceYears} ${getYearsWord(experienceYears)}</span>`;

  return `
    <button class="trainer-card" type="button" data-trainer-id="${trainer.user_id}">
      <div class="trainer-card__header">
        <div class="trainer-card__avatar">
          ${trainer.avatar_url
    ? `<img src="${escapeHtml(trainer.avatar_url)}" alt="${escapeHtml(fullName)}">`
    : `<span>${initials}</span>`}
        </div>
        <div class="trainer-card__identity">
          <div class="trainer-card__top">
            <h3 class="trainer-card__name">${escapeHtml(fullName)}</h3>
            <span class="trainer-card__badge">${escapeHtml(getUserRoleLabel(trainer.is_trainer))}</span>
          </div>
          <p class="trainer-card__username">@${escapeHtml(trainer.username || 'trainer')}</p>
        </div>
      </div>
      <p class="trainer-card__bio">${escapeHtml(bio)}</p>
      <div class="trainer-card__meta">${experienceMarkup}</div>
      <div class="trainer-card__sports">${sportsMarkup}</div>
    </button>`;
}

// Функция debounce
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export async function renderHomePage(
  api: ApiClient,
  container: HTMLElement,
  params: HomePageParams = {}
): Promise<HTMLElement> {
  const { currentUser = null, onLogout = null } = params;

  const template = (window as any).Handlebars.templates['HomePage.hbs'];
  const html = template({});
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild as HTMLElement;

  container.innerHTML = '';
  container.appendChild(page);

  const sidebarContainer = page.querySelector('#sidebar-container') as HTMLElement;
  const grid = page.querySelector('#trainers-grid') as HTMLElement;
  const emptyState = page.querySelector('#trainers-empty') as HTMLElement;
  const searchInput = page.querySelector('.home-page__search-input') as HTMLInputElement;
  const filtersBtn = page.querySelector('#filters-btn') as HTMLElement;
  const filtersDropdown = page.querySelector('#filters-dropdown') as HTMLElement;
  const sportCheckboxesContainer = page.querySelector('#sport-checkboxes') as HTMLElement;

  // Загружаем профиль пользователя (для сайдбара)
  let currentUserProfile = null;
  if (currentUser?.user?.user_id) {
    try {
      currentUserProfile = await api.getProfile(currentUser.user.user_id);
    } catch { currentUserProfile = null; }
  }

  const sidebarUser = currentUser?.user ? {
    id: currentUser.user.user_id,
    name: getFullName(currentUserProfile || currentUser.user),
    role: getUserRoleLabel((currentUserProfile || currentUser.user).is_trainer),
    avatar: currentUserProfile?.avatar_url || currentUser.user.avatar_url || null
  } : null;

  await renderSidebar(sidebarContainer, {
    activePage: 'home',
    currentUser: sidebarUser,
    users: [],
    api,
    onLogout
  });

  // Загружаем виды спорта для фильтров
  const sportTypesResponse = await api.getSportTypes().catch(() => ({ sport_types: [] as SportType[] }));
  const sportTypes = sportTypesResponse.sport_types || [];

  // Строим чекбоксы видов спорта
  sportTypes.forEach(sport => {
    const label = document.createElement('label');
    label.className = 'home-page__filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(sport.sport_type_id);
    const span = document.createElement('span');
    span.textContent = sport.name;
    label.appendChild(checkbox);
    label.appendChild(span);
    sportCheckboxesContainer.appendChild(label);
  });

  // Состояние фильтров
  const getSelectedSportIds = (): number[] => Array.from(sportCheckboxesContainer.querySelectorAll('input:checked')).map(cb => Number((cb as HTMLInputElement).value));

  // Функция загрузки тренеров с сервера
  const loadTrainers = async (query: string, sportTypeIds: number[]) => {
    try {
      const response = await api.getTrainers({
        query: query || undefined,
        sport_type_ids: sportTypeIds.length > 0 ? sportTypeIds : undefined,
        limit: 50
      });
      const trainers = Array.isArray(response?.trainers)
        ? response.trainers.filter(t => t.is_trainer)
        : [];

      if (trainers.length === 0) {
        grid.innerHTML = '';
        emptyState.hidden = false;
        return;
      }

      // Возобновляем карту видов спорта (нужно для отображения названий)
      const sportNamesById = new Map<number, string>(
        sportTypes.map(s => [s.sport_type_id, s.name])
      );

      grid.innerHTML = trainers.map(t => renderTrainerCard(t, sportNamesById)).join('');
      emptyState.hidden = true;

      // Вешаем обработчики клика для перехода в профиль
      grid.querySelectorAll('.trainer-card').forEach(card => {
        card.addEventListener('click', () => {
          const trainerId = Number((card as HTMLElement).dataset.trainerId);
          if (!Number.isFinite(trainerId)) return;
          window.router.navigateTo(`/profile/${trainerId}`);
        });
      });
    } catch (error) {
      console.error('Failed to load trainers:', error);
    }
  };

  // Обработчик изменений: перезапрос с сервера
  const handleFilterChange = debounce(() => {
    const query = searchInput.value.trim();
    const sportIds = getSelectedSportIds();
    loadTrainers(query, sportIds);
  }, 300);

  // Обработчики событий
  searchInput.addEventListener('input', handleFilterChange);

  // При клике на кнопку «Фильтры» показываем/скрываем выпадашку
  filtersBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    filtersDropdown.hidden = !filtersDropdown.hidden;
  });

  // Скрываем фильтр при клике вне
  document.addEventListener('click', (e) => {
    if (!filtersDropdown.hidden && !filtersDropdown.contains(e.target as Node) && e.target !== filtersBtn) {
      filtersDropdown.hidden = true;
    }
  });

  // При изменении чекбоксов
  sportCheckboxesContainer.addEventListener('change', handleFilterChange);

  // Первичная загрузка
  loadTrainers('', []);

  return page;
}
