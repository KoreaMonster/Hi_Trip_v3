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
  [key: string]: unknown;
};

export type Place = {
  id: number;
  name: string;
  address: string | null;
  google_place_id?: string | null;
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

export type PlaceUpdateSource = {
  id: number;
  name: string;
  url: string;
  note: string | null;
};

export type PlaceSummaryCardUpdate = {
  id: number;
  title: string;
  description: string;
  source_url: string;
  published_at: string;
  is_official: boolean;
  is_recent: boolean;
  sources: PlaceUpdateSource[];
};

export type PlaceSummaryCard = {
  id: number;
  place_id: number;
  generated_lines: string[];
  sources: string[];
  generator: string;
  generated_at: string | null;
  cached_at: string | null;
  is_cache_valid: boolean;
  created_by: string | null;
  updates: PlaceSummaryCardUpdate[];
};

export type AlternativePlaceRecommendationRequest = {
  previous_place_id: string;
  unavailable_place_id: string;
  next_place_id: string;
  travel_mode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';
};

export type AlternativePlaceRecommendationPlace = {
  place_id: string;
  name: string | null;
  rating: number;
  user_ratings_total: number | null;
  types?: string[] | null;
  location?: {
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export type AlternativePlaceRecommendation = {
  place: AlternativePlaceRecommendationPlace;
  total_duration_seconds: number;
  total_duration_text?: string | null;
  delta_seconds: number;
  delta_text: string;
};

export type AlternativeRecommendationBaseRoute = {
  previous_place_id: string;
  unavailable_place: AlternativePlaceRecommendationPlace;
  next_place_id: string;
  original_duration_seconds?: number;
  original_duration_text?: string | null;
};

export type AlternativePlaceRecommendationResponse = {
  base_route: AlternativeRecommendationBaseRoute;
  alternatives: AlternativePlaceRecommendation[];
  searched_category: string | null;
  generated_at: string;
  detail?: string;
};
