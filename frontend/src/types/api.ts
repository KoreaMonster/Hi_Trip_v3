// ─── Users ────────────────────────────────────────────────────────────────────
export type LoginRequest = { username: string; password: string };
export type LoginResponse = { access: string; refresh?: string };

export type ProfileResponse = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_approved: boolean;
};

// ─── Monitoring ───────────────────────────────────────────────────────────────
export type HealthResponse = { status: 'ok' | 'error'; message: string; service?: string };

// ─── Trips ────────────────────────────────────────────────────────────────────
export type Trip = {
  id: number;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type TripCreate = {
  title: string;
  start_date?: string;
  end_date?: string;
};

export type Participant = {
  id: number;
  name?: string;
  user?: number;
};

// ─── Schedules ────────────────────────────────────────────────────────────────
export type Schedule = {
  id: number;
  trip: number;
  title: string;
  starts_at?: string | null; // ISO8601 문자열 가정
  ends_at?: string | null;   // ISO8601 문자열 가정
};

export type ScheduleCreate = {
  trip: number;
  title: string;
  starts_at?: string; // 예: '2025-10-20T09:00:00Z'
  ends_at?: string;   // 예: '2025-10-20T10:00:00Z'
};
