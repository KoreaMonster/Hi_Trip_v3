'use client';

import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import {
  getHealth,
  getMonitoringTripAlerts,
  getMonitoringParticipantHistory,
  getMonitoringTripLatest,
  getProfile,
  getTripDetail,
  getTravelerDetail,
  getPlaceSummaryCard,
  listCategories,
  listCoordinatorRoles,
  listParticipants,
  listPlaceCoordinators,
  getPlaceDetail,
  listPendingStaff,
  listPlaces,
  listSchedules,
  listStaff,
  listTrips,
  listOptionalExpenses,
  listTravelers,
} from '@/lib/api';
import type {
  HealthResponse,
  MonitoringAlert,
  ParticipantHistory,
  ParticipantLatest,
  Place,
  PlaceCoordinator,
  PlaceCategory,
  PlaceSummaryCard,
  ProfileResponse,
  Schedule,
  Trip,
  TripDetail,
  TripParticipant,
  CoordinatorRole,
  OptionalExpense,
  TravelerDetail,
  Traveler,
  UserDetail,
} from '@/types/api';

type BaseOptions<TData> = Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>;

export const useTripsQuery = (options?: BaseOptions<Trip[]>) =>
  useQuery({
    queryKey: ['trips'],
    queryFn: listTrips,
    staleTime: 1000 * 60 * 5,
    ...options,
  });

export const useTripDetailQuery = (tripId?: number, options?: BaseOptions<TripDetail>) =>
  useQuery({
    queryKey: ['trips', tripId, 'detail'],
    queryFn: () => getTripDetail(tripId!),
    enabled: typeof tripId === 'number',
    staleTime: 1000 * 30,
    ...options,
  });

export const useSchedulesQuery = (trip?: number, options?: BaseOptions<Schedule[]>) =>
  useQuery({
    queryKey: ['trips', trip, 'schedules'],
    queryFn: () => listSchedules(trip!),
    enabled: typeof trip === 'number',
    staleTime: 1000 * 60,
    ...options,
  });

export const useHealthQuery = (options?: BaseOptions<HealthResponse>) =>
  useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 1000 * 60,
    ...options,
  });

export const useMonitoringAlertsQuery = (
  tripId?: number,
  options?: BaseOptions<MonitoringAlert[]>,
) =>
  useQuery({
    queryKey: ['monitoring', 'alerts', tripId],
    queryFn: () => getMonitoringTripAlerts(tripId!),
    enabled: typeof tripId === 'number',
    refetchInterval: 1000 * 60,
    ...options,
  });

export const useMonitoringLatestQuery = (
  tripId?: number,
  options?: BaseOptions<ParticipantLatest[]>,
) =>
  useQuery({
    queryKey: ['monitoring', 'latest', tripId],
    queryFn: () => getMonitoringTripLatest(tripId!),
    enabled: typeof tripId === 'number',
    refetchInterval: 1000 * 60,
    ...options,
  });

export const useMonitoringParticipantHistoryQuery = (
  tripId?: number,
  participantId?: number,
  params?: { limit?: number },
  options?: BaseOptions<ParticipantHistory>,
) =>
  useQuery({
    queryKey: ['monitoring', 'history', tripId, participantId, params],
    queryFn: () => getMonitoringParticipantHistory(tripId!, participantId!, params),
    enabled: typeof tripId === 'number' && typeof participantId === 'number',
    refetchInterval: 1000 * 15,
    staleTime: 0,
    ...options,
  });

export const useParticipantsQuery = (
  tripId?: number,
  options?: BaseOptions<TripParticipant[]>,
) =>
  useQuery({
    queryKey: ['trips', tripId, 'participants'],
    queryFn: () => listParticipants(tripId!),
    enabled: typeof tripId === 'number',
    staleTime: 1000 * 60,
    ...options,
  });

export const usePlacesQuery = (options?: BaseOptions<Place[]>) =>
  useQuery({
    queryKey: ['places'],
    queryFn: listPlaces,
    staleTime: 1000 * 60 * 10,
    ...options,
  });

export const usePlaceDetailQuery = (placeId?: number, options?: BaseOptions<Place>) =>
  useQuery({
    queryKey: ['places', placeId, 'detail'],
    queryFn: () => getPlaceDetail(placeId!),
    enabled: typeof placeId === 'number',
    staleTime: 1000 * 60 * 10,
    ...options,
  });

export const usePlaceSummaryCardQuery = (placeId?: number, options?: BaseOptions<PlaceSummaryCard>) =>
  useQuery({
    queryKey: ['places', placeId, 'summary-card'],
    queryFn: () => getPlaceSummaryCard(placeId!),
    enabled: typeof placeId === 'number',
    staleTime: 1000 * 60 * 5,
    ...options,
  });

export const useCategoriesQuery = (options?: BaseOptions<PlaceCategory[]>) =>
  useQuery({
    queryKey: ['place-categories'],
    queryFn: listCategories,
    staleTime: 1000 * 60 * 10,
    ...options,
  });

export const useCoordinatorRolesQuery = (options?: BaseOptions<CoordinatorRole[]>) =>
  useQuery({
    queryKey: ['coordinator-roles'],
    queryFn: listCoordinatorRoles,
    staleTime: 1000 * 60 * 60,
    ...options,
  });

export const usePlaceCoordinatorsQuery = (
  placeId?: number,
  options?: BaseOptions<PlaceCoordinator[]>,
) =>
  useQuery({
    queryKey: ['places', placeId, 'coordinators'],
    queryFn: () => listPlaceCoordinators(placeId!),
    enabled: typeof placeId === 'number',
    staleTime: 1000 * 60 * 10,
    ...options,
  });

export const useOptionalExpensesQuery = (
  placeId?: number,
  options?: BaseOptions<OptionalExpense[]>,
) =>
  useQuery({
    queryKey: ['places', placeId, 'expenses'],
    queryFn: () => listOptionalExpenses(placeId!),
    enabled: typeof placeId === 'number',
    staleTime: 1000 * 60 * 5,
    ...options,
  });

export const usePendingStaffQuery = (options?: BaseOptions<UserDetail[]>) =>
  useQuery({
    queryKey: ['staff', 'pending'],
    queryFn: listPendingStaff,
    staleTime: 1000 * 60,
    ...options,
  });

export const useStaffDirectoryQuery = (
  params?: { is_approved?: boolean },
  options?: BaseOptions<UserDetail[]>,
) =>
  useQuery({
    queryKey: ['staff', 'directory', params],
    queryFn: () => listStaff(params),
    staleTime: 1000 * 60,
    ...options,
  });

export const useProfileQuery = (options?: BaseOptions<ProfileResponse>) =>
  useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: getProfile,
    staleTime: 1000 * 30,
    retry: false,
    ...options,
  });

export const useTravelerDetailQuery = (
  travelerId?: number,
  options?: BaseOptions<TravelerDetail>,
) =>
  useQuery({
    queryKey: ['travelers', travelerId],
    queryFn: () => getTravelerDetail(travelerId!),
    enabled: typeof travelerId === 'number',
    staleTime: 1000 * 60 * 5,
    ...options,
  });

export const useTravelersQuery = (options?: BaseOptions<Traveler[]>) =>
  useQuery({
    queryKey: ['travelers'],
    queryFn: listTravelers,
    staleTime: 1000 * 60 * 10,
    ...options,
  });
