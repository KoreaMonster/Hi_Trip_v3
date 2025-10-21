import type { Place, PlaceAlternativeInfo } from '@/types/api';

type AlternativeSource = Place['alternative_place_info'] | Place['ai_alternative_place'];

type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const minutesFromSeconds = (value: unknown): number | undefined => {
  const seconds = asNumber(value);
  if (seconds === undefined) return undefined;
  if (!Number.isFinite(seconds)) return undefined;
  return Math.max(1, Math.round(seconds / 60));
};

const buildReasonFromCandidate = (candidate: RecordLike): string | undefined => {
  const provided = asNonEmptyString(candidate.reason);
  if (provided) return provided;

  const parts: string[] = [];
  const delta = asNonEmptyString(candidate.delta_text);
  const durationText = asNonEmptyString(candidate.total_duration_text);
  if (delta) {
    parts.push(`기존 경로 대비 ${delta}`);
  }
  if (durationText) {
    parts.push(`총 소요 ${durationText}`);
  }
  if (parts.length === 0) return undefined;
  return parts.join(' · ');
};

const extractCandidate = (value: unknown): PlaceAlternativeInfo | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = extractCandidate(item);
      if (normalized) return normalized;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  const candidate = value as RecordLike & { alternatives?: unknown };

  const placeInfo = isRecord(candidate.place) ? candidate.place : undefined;
  const placeName =
    asNonEmptyString(candidate.place_name) ??
    asNonEmptyString(placeInfo?.name) ??
    asNonEmptyString(candidate.name);
  const placeId =
    asNonEmptyString(candidate.place_id) ??
    asNonEmptyString(placeInfo?.place_id);

  const distanceText =
    asNonEmptyString(candidate.distance_text) ??
    asNonEmptyString(candidate.total_duration_text) ??
    asNonEmptyString(placeInfo?.distance_text);

  const etaMinutes =
    asNumber(candidate.eta_minutes) ??
    asNumber(candidate.travel_minutes) ??
    minutesFromSeconds(candidate.total_duration_seconds);

  const reason = buildReasonFromCandidate(candidate);
  const deltaText = asNonEmptyString(candidate.delta_text);

  const result: PlaceAlternativeInfo = {};
  if (placeName) result.place_name = placeName;
  if (placeId) result.place_id = placeId;
  if (reason) result.reason = reason;
  if (distanceText) result.distance_text = distanceText;
  if (etaMinutes !== undefined) result.eta_minutes = etaMinutes;
  if (deltaText) result.delta_text = deltaText;

  const totalDurationText = asNonEmptyString(candidate.total_duration_text);
  if (totalDurationText) {
    result.total_duration_text = totalDurationText;
  }

  const deltaSeconds = asNumber(candidate.delta_seconds);
  if (deltaSeconds !== undefined) {
    result.delta_seconds = deltaSeconds;
  }

  const totalDurationSeconds = asNumber(candidate.total_duration_seconds);
  if (totalDurationSeconds !== undefined) {
    result.total_duration_seconds = totalDurationSeconds;
  }

  const hintUrl = asNonEmptyString(candidate.hint_url);
  if (hintUrl) {
    result.hint_url = hintUrl;
  }

  if (
    Object.keys(result).length === 0 &&
    Array.isArray(candidate.alternatives)
  ) {
    for (const item of candidate.alternatives) {
      const nested = extractCandidate(item);
      if (nested) return nested;
    }
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  for (const nestedValue of Object.values(candidate)) {
    const nested = extractCandidate(nestedValue);
    if (nested) return nested;
  }

  return null;
};

const parseAlternativeSource = (value: AlternativeSource): unknown => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return value;
};

export const normalizeAlternativeInfo = (
  value: AlternativeSource,
): PlaceAlternativeInfo | null => {
  const parsed = parseAlternativeSource(value);
  return extractCandidate(parsed);
};

export const mergeAlternativeInfo = (
  primary: AlternativeSource,
  fallback: AlternativeSource,
): PlaceAlternativeInfo | null => {
  const primaryInfo = normalizeAlternativeInfo(primary);
  const fallbackInfo = normalizeAlternativeInfo(fallback);

  if (primaryInfo && fallbackInfo) {
    return { ...fallbackInfo, ...primaryInfo };
  }
  return primaryInfo ?? fallbackInfo;
};
