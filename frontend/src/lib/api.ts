import { apiClient, apiRequest } from '@/lib/http';
import type {
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MonitoringAlert,
  MonitoringDemoRequest,
  MonitoringDemoResponse,
  MonitoringParticipantHistory,
  ParticipantLatest,
  Place,
  PlaceAutocompleteResponse,
  PlaceCategory,
  ProfileResponse,
  Schedule,
  ScheduleCreate,
  ScheduleRebalanceRequest,
  ScheduleRebalanceResponse,
  Trip,
  TripCreate,
  TripDetail,
  TripParticipant,
  TripParticipantOverview,
  UserDetail,
} from '@/types/api';

const toTripStatus = (value: Trip['status'] | string | undefined): Trip['status'] => {
  if (value === 'ongoing' || value === 'completed') return value;
  return 'planning';
};

const dateOnly = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateOnly(parsed);
};

const deriveTripStatus = (
  status: Trip['status'] | string | undefined,
  startDate?: string,
  endDate?: string,
): Trip['status'] => {
  const fallback = toTripStatus(status);
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    return fallback;
  }

  const today = dateOnly(new Date());
  if (today < start) {
    return 'planning';
  }
  if (today > end) {
    return 'completed';
  }
  return 'ongoing';
};

const normalizeTrip = (trip: Trip): Trip => ({
  ...trip,
  status: deriveTripStatus(trip.status, trip.start_date, trip.end_date),
  max_participants: trip.max_participants ?? null,
});

const normalizeTripDetail = (trip: TripDetail): TripDetail => ({
  ...trip,
  status: deriveTripStatus(trip.status, trip.start_date, trip.end_date),
  participants: trip.participants ?? [],
  max_participants: trip.max_participants ?? null,
});

export const getHealth = async (): Promise<HealthResponse> =>
  apiRequest(() => apiClient.get('api/health/').json<HealthResponse>());

export const getMonitoringTripAlerts = async (
  tripId: number | string,
): Promise<MonitoringAlert[]> =>
  apiRequest(() => apiClient.get(`api/monitoring/trips/${tripId}/alerts/`).json<MonitoringAlert[]>());

export const getMonitoringTripLatest = async (
  tripId: number | string,
): Promise<ParticipantLatest[]> =>
  apiRequest(() => apiClient.get(`api/monitoring/trips/${tripId}/latest/`).json<ParticipantLatest[]>());

export const getMonitoringParticipantHistory = async (
  tripId: number | string,
  participantId: number | string,
  params?: { limit?: number },
): Promise<MonitoringParticipantHistory> =>
  apiRequest(() =>
    apiClient
      .get(`api/monitoring/trips/${tripId}/participants/${participantId}/history/`, {
        searchParams: params
          ? Object.fromEntries(
              Object.entries(params)
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, String(value)]),
            )
          : undefined,
      })
      .json<MonitoringParticipantHistory>(),
  );

export const postMonitoringGenerateDemo = async (
  tripId: number | string,
  body?: MonitoringDemoRequest,
): Promise<MonitoringDemoResponse> =>
  apiRequest(() =>
    apiClient
      .post(`api/monitoring/trips/${tripId}/generate-demo/`, {
        json: body ?? {},
      })
      .json<MonitoringDemoResponse>(),
  );

export const postLogin = async (body: LoginRequest): Promise<LoginResponse> =>
  apiRequest(() => apiClient.post('api/auth/login/', { json: body }).json<LoginResponse>());

export const postLogout = async (): Promise<void> =>
  apiRequest(async () => {
    await apiClient.post('api/auth/logout/');
  });

export const getProfile = async (): Promise<ProfileResponse> =>
  apiRequest(() => apiClient.get('api/auth/profile/').json<ProfileResponse>());

export const listTrips = async (): Promise<Trip[]> =>
  apiRequest(async () => {
    const trips = await apiClient.get('api/trips/').json<Trip[]>();
    return trips.map((trip) => normalizeTrip(trip));
  });

export const createTrip = async (body: TripCreate): Promise<Trip> =>
  apiRequest(async () => {
    const trip = await apiClient.post('api/trips/', { json: body }).json<Trip>();
    return normalizeTrip(trip);
  });

export const listParticipants = async (tripId: number): Promise<TripParticipant[]> =>
  apiRequest(() => apiClient.get(`api/trips/${tripId}/participants/`).json<TripParticipant[]>());

export const listParticipantOverview = async (
  params?: { trip?: number; status?: string; manager?: number },
): Promise<TripParticipantOverview[]> =>
  apiRequest(() => {
    const searchParams = params
      ? Object.fromEntries(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
        )
      : undefined;

    return apiClient
      .get('api/participants-overview/', { searchParams })
      .json<TripParticipantOverview[]>();
  });

export const listPlaces = async (): Promise<Place[]> =>
  apiRequest(() => apiClient.get('api/places/').json<Place[]>());

export const listCategories = async (): Promise<PlaceCategory[]> =>
  apiRequest(() => apiClient.get('api/categories/').json<PlaceCategory[]>());

export const autocompletePlaces = async (
  query: string,
  sessionToken?: string,
): Promise<PlaceAutocompleteResponse> =>
  apiRequest(() =>
    apiClient
      .get('api/place-recommendations/autocomplete/', {
        searchParams: {
          query,
          ...(sessionToken ? { session_token: sessionToken } : {}),
        },
      })
      .json<PlaceAutocompleteResponse>(),
  );

export const lookupPlace = async (placeId: string): Promise<Place> =>
  apiRequest(() =>
    apiClient
      .get('api/place-recommendations/lookup/', {
        searchParams: { place_id: placeId },
      })
      .json<Place>(),
  );

export const listPendingStaff = async (): Promise<UserDetail[]> =>
  apiRequest(async () => {
    const staff = await apiClient
      .get('api/auth/staff/', {
        searchParams: { is_approved: 'false' },
      })
      .json<UserDetail[]>();

    return staff.filter((member: UserDetail) => !member.is_approved);
  });

export const listStaff = async (params?: { is_approved?: boolean }): Promise<UserDetail[]> =>
  apiRequest(async () => {
    const searchParams = params
      ? Object.fromEntries(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)]),
        )
      : undefined;

    return apiClient
      .get('api/auth/staff/', {
        searchParams,
      })
      .json<UserDetail[]>();
  });

export const approveStaff = async (staffId: number): Promise<UserDetail> =>
  apiRequest(() => apiClient.post(`api/auth/staff/${staffId}/approve/`).json<UserDetail>());

export const listSchedules = async (tripId: number): Promise<Schedule[]> =>
  apiRequest(() => apiClient.get(`api/trips/${tripId}/schedules/`).json<Schedule[]>());

export const createSchedule = async (
  tripId: number,
  body: ScheduleCreate,
): Promise<Schedule> =>
  apiRequest(() => apiClient.post(`api/trips/${tripId}/schedules/`, { json: body }).json<Schedule>());

export const rebalanceTripSchedules = async (
  tripId: number,
  body: ScheduleRebalanceRequest,
): Promise<ScheduleRebalanceResponse> =>
  apiRequest(() =>
    apiClient
      .post(`api/trips/${tripId}/schedules/rebalance-day/`, {
        json: body,
      })
      .json<ScheduleRebalanceResponse>(),
  );

export const listTripParticipants = listParticipants;

export const assignTripManager = async (tripId: number, managerId: number): Promise<Trip> =>
  apiRequest(async () => {
    const trip = await apiClient
      .post(`api/trips/${tripId}/assign-manager/`, { json: { manager_id: managerId } })
      .json<Trip>();

    return normalizeTrip(trip);
  });

export const getTripDetail = async (tripId: number): Promise<TripDetail> =>
  apiRequest(async () => {
    const trip = await apiClient.get(`api/trips/${tripId}/`).json<TripDetail>();
    return normalizeTripDetail(trip);
  });
