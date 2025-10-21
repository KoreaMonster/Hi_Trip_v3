import { apiClient, apiRequest } from '@/lib/http';
import type {
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MonitoringAlert,
  ParticipantLatest,
  Place,
  PlaceCategory,
  ProfileResponse,
  Schedule,
  ScheduleCreate,
  Trip,
  TripCreate,
  TripParticipant,
  UserDetail,
} from '@/types/api';

const toTripStatus = (value: Trip['status'] | string | undefined): Trip['status'] => {
  if (value === 'ongoing' || value === 'completed') return value;
  return 'planning';
};

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
    return trips.map((trip: Trip) => ({
      ...trip,
      status: toTripStatus(trip.status),
    }));
  });

export const createTrip = async (body: TripCreate): Promise<Trip> =>
  apiRequest(async () => {
    const payload: TripCreate = {
      ...body,
      status: toTripStatus(body.status ?? 'planning'),
    };
    const trip = await apiClient.post('api/trips/', { json: payload }).json<Trip>();
    return { ...trip, status: toTripStatus(trip.status) };
  });

export const listParticipants = async (tripId: number): Promise<TripParticipant[]> =>
  apiRequest(() => apiClient.get(`api/trips/${tripId}/participants/`).json<TripParticipant[]>());

export const listPlaces = async (): Promise<Place[]> =>
  apiRequest(() => apiClient.get('api/places/').json<Place[]>());

export const listCategories = async (): Promise<PlaceCategory[]> =>
  apiRequest(() => apiClient.get('api/categories/').json<PlaceCategory[]>());

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

export const listTripParticipants = listParticipants;

export const assignTripManager = async (tripId: number, managerId: number): Promise<Trip> =>
  apiRequest(async () => {
    const trip = await apiClient
      .post(`api/trips/${tripId}/assign-manager/`, { json: { manager_id: managerId } })
      .json<Trip>();

    return { ...trip, status: toTripStatus(trip.status) };
  });
