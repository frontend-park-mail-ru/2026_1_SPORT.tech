// src/types/api.types.ts

export interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_trainer: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
}

export interface CSRFTokenResponse {
  csrf_token: string;
}

export interface NotificationPreferences {
  comments: boolean;
  likes: boolean;
  donations: boolean;
  posts: boolean;
  subscriptions: boolean;
  meetings: boolean;
  email_digest: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferences;
}

export interface PrivacySettings {
  show_profile_in_search: boolean;
  allow_measurement_sharing: boolean;
  show_activity_status: boolean;
}

export interface PrivacySettingsResponse {
  settings: PrivacySettings;
}

export interface PostBlock {
  post_block_id: number;
  text_content: string;
  file_url: string;
  kind: string;
  position: number;
}

export interface PostBlockInput {
  text_content?: string;
  file_url?: string;
  kind?: string;
}

export interface Post {
  post_id: number;
  title: string;
  trainer_id: number;
  created_at: string;
  updated_at: string;
  min_tier_id: number | null;
  is_liked: boolean;
  likes_count: number;
  comments_count: number;
  blocks: PostBlock[];
  can_view: boolean;
  sport_type_id?: number | null;
}

export interface PostListItem {
  post_id: number;
  title: string;
  trainer_id: number;
  created_at: string;
  min_tier_id: number | null;
  is_liked: boolean;
  likes_count: number;
  comments_count: number;
  can_view: boolean;
  sport_type_id?: number | null;
}

export interface PostLikeResponse {
  post_id: number;
  is_liked: boolean;
  likes_count: number;
}

export interface PostLike {
  user_id: number;
  created_at: string;
}

export interface TrainerSport {
  sport_type_id: number;
  experience_years: number;
  sports_rank?: string;
}

export interface TrainerDetails {
  education_degree?: string;
  career_since_date: string;
  sports: TrainerSport[];
}

export interface TrainerListItem extends User {
  is_trainer: boolean;
  trainer_details?: TrainerDetails;
}

export interface Profile extends User {
  is_me: boolean;
  trainer_details?: TrainerDetails;
}

export interface SportType {
  sport_type_id: number;
  name: string;
}

export interface DonationResponse {
  donation_id: number;
  sender_user_id: number;
  recipient_user_id: number;
  amount_value: number;
  currency: string;
  message: string;
  created_at: string;
}

export interface UpdateProfilePayload {
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  trainer_details?: TrainerDetails;
}

export interface Tier {
  tier_id: number;
  name: string;
  price: number;
  description: string;
  chat_enabled: boolean;
  calendar_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeetingAvailabilityRule {
  rule_id: number;
  weekday: number;
  start_hour: number;
  created_at: string;
}

export interface MeetingSlot {
  slot_id: number;
  starts_at: string;
  created_at: string;
}

export interface MeetingAvailabilitySlot {
  starts_at: string;
  ends_at: string;
}

export interface MeetingBooking {
  booking_id: number;
  trainer_user_id: number;
  client_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_by_user_id: number;
  note?: string;
  created_at: string;
  role: string;
  other_user_id: number;
}

export interface ChatMessage {
  message_id: number;
  sender_user_id: number;
  receiver_user_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatConversation {
  other_user_id: number;
  last_message: ChatMessage;
  unread_count: number;
}

export interface ChatConversationsSnapshot {
  conversations: ChatConversation[];
  unread_total: number;
}

export interface Subscription {
  subscription_id: number;
  trainer_id: number;
  tier_id: number;
  tier_name: string;
  price: number;
  active: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// НОВЫЙ ТИП для обновления подписки
export interface UpdateSubscriptionPayload {
  tier_id: number;
}

export interface Subscriber {
  subscription_id: number;
  client_id: number;
  tier_id: number;
  tier_name: string;
  price: number;
  active: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  comment_id: number;
  post_id: number;
  author_user_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface StatisticsResponse {
  trainer_id: number;
  posts_count: number;
  monthly_revenue: number;
  total_revenue: number;
  donations_count: number;
  currency: string;
}

export interface BalanceResponse {
  trainer_id: number;
  amount_value: number;
  currency: string;
}

export interface DonationItem {
  donation_id: number;
  sender_user_id: number;
  amount_value: number;
  currency: string;
  message?: string | null;
  created_at: string;
}

export interface ListDonationsResponse {
  donations: DonationItem[];
  total: number;
}

export interface Notification {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  actor_user_id: number | null;
  post_id: number | null;
  comment_id: number | null;
  donation_id: number | null;
  subscription_id: number | null;
  read_at: string | null;
  created_at: string;
}

export interface PaymentDonation {
  donation_id: number;
  sender_user_id: number;
  recipient_user_id: number;
  amount_value: number;
  currency: string;
  message: string;
  created_at: string;
}

export interface Measurement {
  measurement_id: number;
  user_id: number;
  measured_at: string; // timestamp string
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentResponse {
  payment_id: number;
  confirmation_url: string;
  confirmation_token: string;
  status: string;
  donation: PaymentDonation | null;
  subscription: Subscription | null;
  amount_value: number;
  currency: string;
  message: string;
  recipient_user_id: number;
  sender_user_id: number;
  provider_payment_id: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}
