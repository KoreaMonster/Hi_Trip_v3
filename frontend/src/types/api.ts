// ─── Users ────────────────────────────────────────────────────────────────────
export type LoginRequest = { username: string; password: string };

export type UserDetail = {
  id: number;
  username: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  first_name_kr: string;
  last_name_kr: string;
  full_name_kr: string;
  full_name_en: string;
  role: 'super_admin' | 'manager';
  role_display: string;
  is_approved: boolean;
};

export type LoginResponse = UserDetail;
export type ProfileResponse = UserDetail;

// ─── Monitoring ───────────────────────────────────────────────────────────────
export type HealthResponse = {
  status: string;
  message: string;
  service: string;
};

export type MonitoringAlert = {
  id: number;
  participant: number;
  traveler_name: string;
  trip_id: number;
  alert_type: 'health' | 'location';
  message: string;
  snapshot_time: string;
  created_at: string;
};

export type HealthSnapshot = {
  id: number;
  measured_at: string;
  heart_rate: number;
  spo2: string;
  status: string;
};

export type LocationSnapshot = {
  id: number;
  measured_at: string;
  latitude: string;
  longitude: string;
  accuracy_m: string | null;
};

export type ParticipantLatest = {
  participant_id: number;
  traveler_name: string;
  trip_id: number;
  health: HealthSnapshot | null;
  location: LocationSnapshot | null;
};

export type ParticipantHistory = {
  participant_id: number;
  traveler_name: string;
  trip_id: number;
  last_updated: string | null;
  health: HealthSnapshot[];
  location: LocationSnapshot[];
};

export type MonitoringDemoResponse = {
  created: number;
  minutes: number;
  interval: number;
  participants: number;
};

// ─── Trips ────────────────────────────────────────────────────────────────────
export type TripStatus = 'planning' | 'ongoing' | 'completed';

export type Trip = {
  id: number;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  invite_code?: string;
  manager?: number | null;
  manager_name?: string | null;
  participant_count?: number;
};

export type TripCreate = {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
};

export type TripUpdate = Partial<
  TripCreate & {
    status?: TripStatus;
    manager?: number | null;
    heart_rate_min?: number | null;
    heart_rate_max?: number | null;
    spo2_min?: string | null;
    geofence_center_lat?: string | null;
    geofence_center_lng?: string | null;
    geofence_radius_km?: string | null;
  }
>;

export type TripDetail = Trip & {
  invite_code: string;
  participant_count: number;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  spo2_min: string | null;
  geofence_center_lat: string | null;
  geofence_center_lng: string | null;
  geofence_radius_km: string | null;
  participants: TripParticipant[];
};

export type Traveler = {
  id: number;
  last_name_kr: string;
  first_name_kr: string;
  full_name_kr: string;
  first_name_en: string;
  last_name_en: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: 'M' | 'F';
};

export type TravelerDetail = Traveler & {
  full_name_en: string;
  gender_display: string;
  address: string;
  country: string;
  is_companion: boolean;
  companion_names: string;
  proxy_booking: boolean;
  passport_number: string | null;
  passport_expiry: string | null;
  passport_verified: boolean;
  identity_verified: boolean;
  booking_verified: boolean;
  insurance_subscribed: boolean;
  total_amount: number;
  paid_amount: number;
  payment_status: boolean;
  created_at: string;
  updated_at: string;
};

export type TripParticipant = {
  id: number;
  trip: number;
  traveler: Traveler;
  traveler_id?: number;
  invite_code?: string;
  joined_date: string;
};

export type TripParticipantCreate = {
  traveler_id: number;
  invite_code?: string;
};

// ─── Schedules ────────────────────────────────────────────────────────────────
export type Schedule = {
  id: number;
  trip: number;
  place: number | null;
  place_id?: number | null;
  day_number: number;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  transport: string | null;
  main_content: string | null;
  meeting_point: string | null;
  budget: number | null;
  order: number;
  place_name: string | null;
  duration_display: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleCreate = {
  place_id?: number | null;
  day_number: number;
  start_time: string;
  end_time: string;
  transport?: string | null;
  main_content?: string | null;
  meeting_point?: string | null;
  budget?: number | null;
  order?: number;
};

export type ScheduleUpdate = Partial<
  ScheduleCreate & {
    minimum_stay_minutes?: number | null;
  }
>;

export type ScheduleRebalanceRequest = {
  day_number: number;
  schedule_ids: number[];
  travel_mode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';
  day_start_time?: string;
};

export type ScheduleRebalanceSegment = {
  from_schedule_id: number;
  to_schedule_id: number;
  duration_seconds: number;
  duration_text: string;
};

export type ScheduleRebalanceResponse = {
  trip_id: number;
  day_number: number;
  travel_mode: ScheduleRebalanceRequest['travel_mode'];
  resolved_day_start: string;
  rebalanced_at: string;
  travel_segments: ScheduleRebalanceSegment[];
  schedules: Schedule[];
};

// ─── Places ────────────────────────────────────────────────────────────────────
export type PlaceCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type PlaceAlternativeInfo = {
  place_name?: string;
  reason?: string;
  distance_text?: string;
  eta_minutes?: number;
  [key: string]: unknown;
};

export type Place = {
  id: number;
  name: string;
  address: string | null;
  category?: PlaceCategory | null;
  category_id?: number | null;
  entrance_fee?: number | null;
  activity_time?: string | null;
  ai_alternative_place?: PlaceAlternativeInfo | string | null;
  ai_generated_info?: string | null;
  ai_meeting_point?: string | null;
  image?: string | null;
  entrance_fee_display?: string | null;
  activity_time_display?: string | null;
  has_image?: boolean;
  alternative_place_info?: PlaceAlternativeInfo | null;
  created_at: string;
  updated_at: string;
};

export type PlaceCreate = {
  name: string;
  address?: string | null;
  category_id?: number | null;
  entrance_fee?: number | null;
  activity_time?: string | null;
  ai_generated_info?: string | null;
  ai_meeting_point?: string | null;
  ai_alternative_place?: PlaceAlternativeInfo | string | null;
};

export type PlaceUpdate = Partial<
  PlaceCreate & {
    image?: string | null;
  }
>;

export type CoordinatorRole = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type PlaceCoordinator = {
  id: number;
  place: number;
  role: CoordinatorRole | null;
  role_id?: number;
  name: string;
  phone: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceCoordinatorCreate = {
  role_id: number;
  name: string;
  phone: string;
  note?: string | null;
};

export type PlaceCoordinatorUpdate = Partial<PlaceCoordinatorCreate>;

export type PlaceSummaryCard = {
  id: number;
  place_id: number;
  generated_lines: string[];
  sources: string[];
  generator: string | null;
  generated_at: string | null;
  cached_at: string | null;
  is_cache_valid: boolean;
  created_by: string | null;
  updates: Array<{
    id: number;
    title: string;
    description: string;
    source_url: string | null;
    published_at: string | null;
    is_official: boolean;
    is_recent: boolean;
    sources: Array<{
      id: number;
      name: string;
      url: string | null;
      note: string | null;
    }>;
  }>;
};

export type PlaceSummaryRefreshRequest = {
  force_refresh?: boolean;
  memo?: string | null;
};

export type OptionalExpense = {
  id: number;
  place: number;
  item_name: string;
  price: number;
  description: string | null;
  display_order: number | null;
  price_display?: string | null;
  created_at: string;
  updated_at: string;
};

export type OptionalExpenseCreate = {
  item_name: string;
  price: number;
  description?: string | null;
  display_order?: number | null;
};

export type OptionalExpenseUpdate = Partial<OptionalExpenseCreate>;

export type OptionalExpenseSelection = {
  expense_ids: number[];
};

export type OptionalExpenseTotal = {
  total: number;
  count: number;
  items: Array<{
    id: number;
    item_name: string;
    price: number;
    price_display: string | null;
    place_name: string;
    description: string;
  }>;
  formatted_total: string;
};

export type StaffRegisterRequest = {
  username: string;
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
  first_name_kr: string;
  last_name_kr: string;
  role: UserDetail['role'];
};

export type StaffUpdateRequest = Partial<
  Omit<StaffRegisterRequest, 'password'> & {
    password?: string;
    is_approved?: boolean;
  }
>;
