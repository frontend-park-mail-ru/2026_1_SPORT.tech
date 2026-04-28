import Handlebars from 'handlebars';

// Импорт всех шаблонов
import ButtonTemplate from './components/atoms/Button/Button.hbs';
import InputTemplate from './components/atoms/Input/Input.hbs';
import AvatarTemplate from './components/atoms/Avatar/Avatar.hbs';
import UserPhotoItemTemplate from './components/atoms/UserPhotoItem/UserPhotoItem.hbs';
import AuthFormTemplate from './components/organisms/AuthForm/AuthForm.hbs';
import ProfileHeaderTemplate from './components/molecules/ProfileHeader/ProfileHeader.hbs';
import PostCardTemplate from './components/molecules/PostCard/PostCard.hbs';
import DonationModalTemplate from './components/molecules/DonationModal/DonationModal.hbs';
import PostFormModalTemplate from './components/molecules/PostFormModal/PostFormModal.hbs';
import SidebarTemplate from './components/organisms/Sidebar/Sidebar.hbs';
import ProfileContentTemplate from './components/organisms/ProfileContent/ProfileContent.hbs';
import AuthPageTemplate from './pages/AuthPage/AuthPage.hbs';
import ProfilePageTemplate from './pages/ProfilePage/ProfilePage.hbs';
import HomePageTemplate from './pages/HomePage/HomePage.hbs';
import ProfileEditModalTemplate from './components/molecules/ProfileEditModal/ProfileEditModal.hbs';

const templates: Record<string, Handlebars.TemplateDelegate> = {
  'Button.hbs': Handlebars.compile(ButtonTemplate),
  'Input.hbs': Handlebars.compile(InputTemplate),
  'Avatar.hbs': Handlebars.compile(AvatarTemplate),
  'UserPhotoItem.hbs': Handlebars.compile(UserPhotoItemTemplate),
  'AuthForm.hbs': Handlebars.compile(AuthFormTemplate),
  'ProfileHeader.hbs': Handlebars.compile(ProfileHeaderTemplate),
  'PostCard.hbs': Handlebars.compile(PostCardTemplate),
  'DonationModal.hbs': Handlebars.compile(DonationModalTemplate),
  'PostFormModal.hbs': Handlebars.compile(PostFormModalTemplate),
  'Sidebar.hbs': Handlebars.compile(SidebarTemplate),
  'ProfileContent.hbs': Handlebars.compile(ProfileContentTemplate),
  'AuthPage.hbs': Handlebars.compile(AuthPageTemplate),
  'ProfilePage.hbs': Handlebars.compile(ProfilePageTemplate),
  'HomePage.hbs': Handlebars.compile(HomePageTemplate),
  'ProfileEditModal.hbs': Handlebars.compile(ProfileEditModalTemplate)
};

export default templates;
