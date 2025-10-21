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

// ─── Schedules ────────────────────────────────────────────────────────────────
export type Schedule = {
  id: number;
  trip: number;
  place: number | null;
  place_id?: number | null;
  place_google_place_id?: string | null;
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
  place_id?: string;
  delta_text?: string;
  total_duration_text?: string;
  total_duration_seconds?: number;
  delta_seconds?: number;
  hint_url?: string;
  [key: string]: unknown;
};

export type Place = {
  id: number;
  name: string;
  address: string | null;
  google_place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

export type PlaceSummarySource = {
  id: number;
  name: string;
  url: string;
  note: string | null;
};

export type PlaceSummaryUpdate = {
  id: number;
  title: string;
  description: string;
  source_url: string | null;
  published_at: string | null;
  is_official: boolean;
  is_recent: boolean;
  sources: PlaceSummarySource[];
};

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
  updates: PlaceSummaryUpdate[];
};

export type PlaceAlternativeCandidate = {
  place: {
    place_id: string;
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    location: { latitude: number; longitude: number };
  };
  total_duration_seconds: number;
  total_duration_text: string;
  delta_seconds: number;
  delta_text: string;
  distance_meters?: number | null;
  distance_text?: string | null;
};

export type PlaceAlternativesResponse = {
  base_route: {
    previous_place_id: string;
    next_place_id: string;
    unavailable_place: {
      place_id: string;
      name: string;
      types: string[];
      location: { latitude: number; longitude: number };
    };
    original_duration_seconds?: number;
    original_duration_text?: string;
    original_distance_meters?: number | null;
    original_distance_text?: string | null;
  };
  alternatives: PlaceAlternativeCandidate[];
  searched_category: string;
  generated_at: string;
};

export type PlaceAlternativesRequest = {
  previous_place_id: string;
  unavailable_place_id: string;
  next_place_id: string;
  travel_mode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';
};

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
