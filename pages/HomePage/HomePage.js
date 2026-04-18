import { renderSidebar } from '../../components/organisms/Sidebar/Sidebar.js';
import { escapeHtml, getFullName, getUserRoleLabel } from '/src/utils/profilePageData.js';

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TR';
}

function getExperienceYears(careerSinceDate) {
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

function getYearsWord(years) {
  const lastDigit = years % 10;
  const lastTwoDigits = years % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
  if (lastDigit === 1) return 'год';
  if (lastDigit >= 2 && lastDigit <= 4) return 'года';
  return 'лет';
}

function renderTrainerCard(trainer, sportNamesById) {
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
    ? sportNames.map(name => `<span class="trainer-card__sport">${escapeHtml(name)}</span>`).join('')
    : '<span class="trainer-card__sport trainer-card__sport--muted">Специализация не указана</span>';

  const experienceMarkup = experienceYears === null
    ? ''
    : `
      <span class="trainer-card__meta-item">
        Стаж: ${experienceYears} ${getYearsWord(experienceYears)}
      </span>
    `;

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

      <div class="trainer-card__meta">
        ${experienceMarkup}
      </div>

      <div class="trainer-card__sports">
        ${sportsMarkup}
      </div>
    </button>
  `;
}

export async function renderHomePage(api, container, {
  currentUser = null,
  onLogout = null
} = {}) {
  const template = Handlebars.templates['HomePage.hbs'];
  const html = template({});

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const page = wrapper.firstElementChild;

  container.innerHTML = '';
  container.appendChild(page);

  const sidebarContainer = page.querySelector('#sidebar-container');
  const grid = page.querySelector('#trainers-grid');
  const emptyState = page.querySelector('#trainers-empty');
  const currentUserProfile = currentUser?.user?.user_id
    ? await api.getProfile(currentUser.user.user_id).catch(() => null)
    : null;

  const sidebarUser = currentUser?.user ? {
    id: currentUser.user.user_id,
    name: getFullName(currentUserProfile || currentUser.user),
    role: getUserRoleLabel((currentUserProfile || currentUser.user).is_trainer),
    avatar: currentUserProfile?.avatar_url || currentUser.user.avatar_url || currentUser.user.avatar || null
  } : null;

  await renderSidebar(sidebarContainer, {
    activePage: 'home',
    currentUser: sidebarUser,
    users: [],
    api,
    onLogout
  });

  const [trainersResponse, sportTypesResponse] = await Promise.all([
    api.getTrainers().catch(() => ({ trainers: [] })),
    api.getSportTypes().catch(() => ({ sport_types: [] }))
  ]);

  const trainers = Array.isArray(trainersResponse?.trainers)
    ? trainersResponse.trainers.filter(trainer => trainer.is_trainer)
    : [];

  const sportNamesById = new Map(
    (Array.isArray(sportTypesResponse?.sport_types) ? sportTypesResponse.sport_types : [])
      .map(sportType => [Number(sportType.sport_type_id), sportType.name])
  );

  if (trainers.length === 0) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    return page;
  }

  emptyState.hidden = true;
  grid.innerHTML = trainers.map(trainer => renderTrainerCard(trainer, sportNamesById)).join('');

  grid.querySelectorAll('.trainer-card').forEach(card => {
    card.addEventListener('click', () => {
      const trainerId = Number(card.dataset.trainerId);
      if (!Number.isFinite(trainerId)) return;
      window.router.navigateTo(`/profile/${trainerId}`);
    });
  });

  return page;
}
