// 공용 API 래퍼 (users / monitoring / trips / schedules)
// ky 인스턴스는 '@/lib/ky'에 있다고 가정합니다.
// 만약 ky.ts가 named export라면 아래 첫 줄을
//   import { api } from '@/lib/ky'
// 로 바꿔 주세요.
import api from '@/lib/ky';

// ── Monitoring & Health ───────────────────────────────────────────────────────

// GET /api/health/
export const getHealth = () => api.get('health/').json<any>();

// GET /api/monitoring/trips/
export const listMonitoringTrips = () => api.get('monitoring/trips/').json<any[]>();

// GET /api/monitoring/trips/{id}/
export const getMonitoringTrip = (tripId: number | string) =>
  api.get(`monitoring/trips/${tripId}/`).json<any>();

// GET /api/monitoring/trips/{id}/{action}/?key=value...
export const getMonitoringTripAction = (
  tripId: number | string,
  action: string,
  searchParams?: Record<string, string | number | boolean | null | undefined>
) =>
  api
    .get(`monitoring/trips/${tripId}/${action}/`, { searchParams: searchParams as any })
    .json<any>();

// ── Users ─────────────────────────────────────────────────────────────────────

// POST /api/users/login/   -> { access, refresh? }
export const postLogin = (body: { username: string; password: string }) =>
  api.post('users/login/', { json: body }).json<{ access: string; refresh?: string }>();

// GET /api/users/profile/
export const getProfile = () => api.get('users/profile/').json<any>();

// ── Trips ─────────────────────────────────────────────────────────────────────

// GET /api/trips/
export const listTrips = () => api.get('trips/').json<any[]>();

// POST /api/trips/
export const createTrip = (body: { title: string; start_date?: string; end_date?: string }) =>
  api.post('trips/', { json: body }).json<any>();

// GET /api/trips/{id}/participants/
export const listParticipants = (tripId: number) =>
  api.get(`trips/${tripId}/participants/`).json<any[]>();

// ── Schedules ────────────────────────────────────────────────────────────────

// GET /api/schedules/?trip={id}
export const listSchedules = (params?: { trip?: number }) =>
  api.get('schedules/', { searchParams: params as any }).json<any[]>();

// POST /api/schedules/
export const createSchedule = (body: { trip: number; title: string; starts_at?: string; ends_at?: string }) =>
  api.post('schedules/', { json: body }).json<any>();
