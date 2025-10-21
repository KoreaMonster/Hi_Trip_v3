import { apiClient, apiRequest } from '@/lib/http';
import type {
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MonitoringAlert,
  MonitoringDemoResponse,
  ParticipantHistory,
  ParticipantLatest,
  Place,
  PlaceCoordinator,
  PlaceCoordinatorCreate,
  PlaceCoordinatorUpdate,
  PlaceCategory,
  PlaceCreate,
  PlaceSummaryCard,
  PlaceSummaryRefreshRequest,
  PlaceUpdate,
  ProfileResponse,
  Schedule,
  ScheduleCreate,
  ScheduleUpdate,
  ScheduleRebalanceRequest,
  ScheduleRebalanceResponse,
  StaffRegisterRequest,
  StaffUpdateRequest,
  Trip,
  TripCreate,
  TripDetail,
  TripParticipantCreate,
  TripParticipant,
  TripUpdate,
  Traveler,
  TravelerDetail,
  UserDetail,
  OptionalExpense,
  OptionalExpenseCreate,
  OptionalExpenseSelection,
  OptionalExpenseTotal,
  OptionalExpenseUpdate,
  CoordinatorRole,
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
});

const normalizeTripDetail = (trip: TripDetail): TripDetail => ({
  ...trip,
  status: deriveTripStatus(trip.status, trip.start_date, trip.end_date),
  participants: trip.participants ?? [],
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

type MonitoringHistoryParams = { limit?: number };

export const getMonitoringParticipantHistory = async (
  tripId: number | string,
  participantId: number | string,
  params?: MonitoringHistoryParams,
): Promise<ParticipantHistory> =>
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
      .json<ParticipantHistory>(),
  );

type MonitoringDemoRequest = { minutes?: number; interval?: number };

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

export const updateTrip = async (tripId: number, body: TripUpdate): Promise<Trip> =>
  apiRequest(async () => {
    const trip = await apiClient.patch(`api/trips/${tripId}/`, { json: body }).json<Trip>();
    return normalizeTrip(trip);
  });

export const deleteTrip = async (tripId: number): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/trips/${tripId}/`);
  });

export const listParticipants = async (tripId: number): Promise<TripParticipant[]> =>
  apiRequest(() => apiClient.get(`api/trips/${tripId}/participants/`).json<TripParticipant[]>());

export const createTripParticipant = async (
  tripId: number,
  body: TripParticipantCreate,
): Promise<TripParticipant> =>
  apiRequest(() =>
    apiClient
      .post(`api/trips/${tripId}/participants/`, { json: body })
      .json<{ participant: TripParticipant }>()
      .then((response) => response.participant),
  );

export const listPlaces = async (): Promise<Place[]> =>
  apiRequest(() => apiClient.get('api/places/').json<Place[]>());

export const createPlace = async (body: PlaceCreate): Promise<Place> =>
  apiRequest(() => apiClient.post('api/places/', { json: body }).json<Place>());

export const updatePlace = async (placeId: number | string, body: PlaceUpdate): Promise<Place> =>
  apiRequest(() => apiClient.patch(`api/places/${placeId}/`, { json: body }).json<Place>());

export const deletePlace = async (placeId: number | string): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/places/${placeId}/`);
  });

export const getPlaceDetail = async (placeId: number | string): Promise<Place> =>
  apiRequest(() => apiClient.get(`api/places/${placeId}/`).json<Place>());

export const getPlaceSummaryCard = async (placeId: number | string): Promise<PlaceSummaryCard> =>
  apiRequest(() => apiClient.get(`api/places/${placeId}/summary-card/`).json<PlaceSummaryCard>());

export const refreshPlaceSummaryCard = async (
  placeId: number | string,
  body?: PlaceSummaryRefreshRequest,
): Promise<PlaceSummaryCard> =>
  apiRequest(() =>
    apiClient
      .post(`api/places/${placeId}/summary-card/refresh/`, { json: body ?? {} })
      .json<PlaceSummaryCard>(),
  );

export const listCategories = async (): Promise<PlaceCategory[]> =>
  apiRequest(() => apiClient.get('api/categories/').json<PlaceCategory[]>());

export const listCoordinatorRoles = async (): Promise<CoordinatorRole[]> =>
  apiRequest(() => apiClient.get('api/coordinator-roles/').json<CoordinatorRole[]>());

export const listPlaceCoordinators = async (
  placeId: number | string,
): Promise<PlaceCoordinator[]> =>
  apiRequest(() =>
    apiClient.get(`api/places/${placeId}/coordinators/`).json<PlaceCoordinator[]>(),
  );

export const createPlaceCoordinator = async (
  placeId: number | string,
  body: PlaceCoordinatorCreate,
): Promise<PlaceCoordinator> =>
  apiRequest(() =>
    apiClient
      .post(`api/places/${placeId}/coordinators/`, { json: body })
      .json<PlaceCoordinator>(),
  );

export const updatePlaceCoordinator = async (
  placeId: number | string,
  coordinatorId: number,
  body: PlaceCoordinatorUpdate,
): Promise<PlaceCoordinator> =>
  apiRequest(() =>
    apiClient
      .patch(`api/places/${placeId}/coordinators/${coordinatorId}/`, { json: body })
      .json<PlaceCoordinator>(),
  );

export const deletePlaceCoordinator = async (
  placeId: number | string,
  coordinatorId: number,
): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/places/${placeId}/coordinators/${coordinatorId}/`);
  });

export const listOptionalExpenses = async (
  placeId: number | string,
): Promise<OptionalExpense[]> =>
  apiRequest(() => apiClient.get(`api/places/${placeId}/expenses/`).json<OptionalExpense[]>());

export const createOptionalExpense = async (
  placeId: number | string,
  body: OptionalExpenseCreate,
): Promise<OptionalExpense> =>
  apiRequest(() =>
    apiClient
      .post(`api/places/${placeId}/expenses/`, { json: body })
      .json<OptionalExpense>(),
  );

export const updateOptionalExpense = async (
  placeId: number | string,
  expenseId: number,
  body: OptionalExpenseUpdate,
): Promise<OptionalExpense> =>
  apiRequest(() =>
    apiClient
      .patch(`api/places/${placeId}/expenses/${expenseId}/`, { json: body })
      .json<OptionalExpense>(),
  );

export const deleteOptionalExpense = async (
  placeId: number | string,
  expenseId: number,
): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/places/${placeId}/expenses/${expenseId}/`);
  });

export const calculateOptionalExpenseTotal = async (
  placeId: number | string,
  body: OptionalExpenseSelection,
): Promise<OptionalExpenseTotal> =>
  apiRequest(() =>
    apiClient
      .post(`api/places/${placeId}/expenses/calculate/`, { json: body })
      .json<OptionalExpenseTotal>(),
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

export const registerStaff = async (body: StaffRegisterRequest): Promise<UserDetail> =>
  apiRequest(() => apiClient.post('api/auth/staff/', { json: body }).json<UserDetail>());

export const updateStaff = async (staffId: number, body: StaffUpdateRequest): Promise<UserDetail> =>
  apiRequest(() => apiClient.patch(`api/auth/staff/${staffId}/`, { json: body }).json<UserDetail>());

export const deleteStaff = async (staffId: number): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/auth/staff/${staffId}/`);
  });

export const approveStaff = async (staffId: number): Promise<UserDetail> =>
  apiRequest(() => apiClient.post(`api/auth/staff/${staffId}/approve/`).json<UserDetail>());

export const listTravelers = async (): Promise<Traveler[]> =>
  apiRequest(() => apiClient.get('api/travelers/').json<Traveler[]>());

export const listSchedules = async (tripId: number): Promise<Schedule[]> =>
  apiRequest(() => apiClient.get(`api/trips/${tripId}/schedules/`).json<Schedule[]>());

export const createSchedule = async (
  tripId: number,
  body: ScheduleCreate,
): Promise<Schedule> =>
  apiRequest(() => apiClient.post(`api/trips/${tripId}/schedules/`, { json: body }).json<Schedule>());

export const updateSchedule = async (
  tripId: number,
  scheduleId: number,
  body: ScheduleUpdate,
): Promise<Schedule> =>
  apiRequest(() =>
    apiClient.patch(`api/trips/${tripId}/schedules/${scheduleId}/`, { json: body }).json<Schedule>(),
  );

export const deleteSchedule = async (tripId: number, scheduleId: number): Promise<void> =>
  apiRequest(async () => {
    await apiClient.delete(`api/trips/${tripId}/schedules/${scheduleId}/`);
  });

export const rebalanceTripDay = async (
  tripId: number,
  body: ScheduleRebalanceRequest,
): Promise<ScheduleRebalanceResponse> =>
  apiRequest(() =>
    apiClient
      .post(`api/trips/${tripId}/schedules/rebalance-day/`, { json: body })
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

export const getTravelerDetail = async (
  travelerId: number | string,
): Promise<TravelerDetail> =>
  apiRequest(() => apiClient.get(`api/travelers/${travelerId}/`).json<TravelerDetail>());
