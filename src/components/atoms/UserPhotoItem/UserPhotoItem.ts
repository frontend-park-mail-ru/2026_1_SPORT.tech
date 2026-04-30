/**
 * @fileoverview Базовый компонент элемента пользователя
 * @module components/atoms/UserPhotoItem
 */

export interface UserPhotoItemConfig {
  id?: number | null;
  name?: string;
  role?: string;
  avatar?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  clickable?: boolean;
  onClick?: ((data: { id: number | null; name: string; role: string; avatar: string | null }) => void) | null;
  count?: string | number | null;
}

export interface UserPhotoListOptions {
  compact?: boolean;
  clickable?: boolean;
  emptyMessage?: string;
}

export async function renderUserPhotoItem(
  container: HTMLElement,
  config: UserPhotoItemConfig = {}
): Promise<HTMLElement> {
  const {
    id = null,
    name = '',
    role = '',
    avatar = null,
    isEmpty = false,
    emptyMessage = 'Нет пользователей',
    compact = false,
    clickable = true,
    onClick = null,
    count = null
  } = config;

  const template = (window as any).Handlebars.templates['UserPhotoItem.hbs'];

  const initials: string = name
    .split(' ')
    .map((n: string) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const html: string = template({
    id,
    name,
    role,
    avatar,
    initials,
    isEmpty,
    emptyMessage,
    clickable: clickable && !isEmpty,
    count
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const element = wrapper.firstElementChild as HTMLElement;

  if (compact) {
    element.classList.add('user-photo-item--compact');
  }

  if (onClick && !isEmpty) {
    element.addEventListener('click', () => onClick({ id, name, role, avatar }));
  }

  container.appendChild(element);
  return element;
}

export async function renderUserPhotoList(
  container: HTMLElement,
  title: string,
  users: UserPhotoItemConfig[] = [],
  options: UserPhotoListOptions = {}
): Promise<HTMLElement> {
  const titleEl = document.createElement('h3');
  titleEl.className = 'user-photo-section-title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  const listContainer = document.createElement('div');
  listContainer.className = 'user-photo-list';
  container.appendChild(listContainer);

  if (users.length === 0) {
    await renderUserPhotoItem(listContainer, {
      isEmpty: true,
      emptyMessage: options.emptyMessage || 'Нет пользователей'
    });
  } else {
    for (const user of users) {
      await renderUserPhotoItem(listContainer, {
        ...user,
        compact: options.compact,
        clickable: options.clickable
      });
    }
  }

  return listContainer;
}
