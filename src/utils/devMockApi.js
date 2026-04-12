/**
 * Подмена методов ApiClient для просмотра вёрстки без работающего бэкенда.
 * Включается через `getDevMockMode` в constants (`?mock=1` или `?mock=auth`).
 *
 * @module src/utils/devMockApi
 */

const MOCK_USER_ID = 1;

const mockUserPayload = () => ({
  user: {
    user_id: MOCK_USER_ID,
    is_trainer: true,
    profile: {
      first_name: 'Демо',
      last_name: 'Тренер',
      username: 'demo_trainer',
      avatar_url: null
    }
  }
});

const mockProfilePayload = () => ({
  is_me: true,
  is_trainer: true,
  profile: {
    first_name: 'Демо',
    last_name: 'Тренер',
    username: 'demo_trainer',
    avatar_url: null
  }
});

const mockPostsList = () => ({
  posts: [
    {
      post_id: 101,
      title: 'Демо-публикация',
      can_view: true,
      created_at: new Date().toISOString(),
      min_tier_id: null
    }
  ]
});

/**
 * @param {number} postId
 * @returns {Object}
 */
const mockPostDetail = postId => ({
  post_id: postId,
  title: 'Демо-публикация',
  text_content: 'Текст демо-поста.\n\nВторой абзац для проверки переносов.',
  likes_count: 12,
  comments_count: 3,
  liked_by_me: false,
  attachments: []
});

/**
 * Подменяет вызовы на фикстуры. Вызывать сразу после `new ApiClient(...)`.
 * @param {import('./api.js').ApiClient} api
 * @param {'full'|'auth'} mode
 */
export function applyDevMockApiOverrides(api, mode) {
  if (mode === 'full') {
    api.getCurrentUser = async () => mockUserPayload();
    api.getProfile = async () => mockProfilePayload();
    api.getUserPosts = async () => mockPostsList();
    api.getPost = async postId => mockPostDetail(postId);
    api.likePost = async postId => ({
      ...mockPostDetail(postId),
      likes_count: 13,
      liked_by_me: true
    });
    api.unlikePost = async () => null;
    api.createPost = async () => ({ post_id: 102 });
    api.updatePost = async () => ({ post_id: 101 });
    api.deletePost = async () => null;
    api.createDonation = async () => ({ status: 'mock' });
    api.login = async () => mockUserPayload();
    api.registerClient = async () => mockUserPayload();
    api.registerTrainer = async () => mockUserPayload();
    api.logout = async () => null;
    api.getSportTypes = async () => ({ sport_types: [] });
    return;
  }

  if (mode === 'auth') {
    api.getCurrentUser = async () => null;
    api.login = async () => mockUserPayload();
    api.registerClient = async () => mockUserPayload();
    api.registerTrainer = async () => mockUserPayload();
    api.logout = async () => null;
    api.getProfile = async () => mockProfilePayload();
    api.getUserPosts = async () => ({ posts: [] });
    api.getPost = async postId => mockPostDetail(postId);
    api.getSportTypes = async () => ({ sport_types: [] });
  }
}
