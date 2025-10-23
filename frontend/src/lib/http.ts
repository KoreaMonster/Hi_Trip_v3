import ky, { HTTPError } from 'ky';

export type ApiErrorBody =
  | string
  | { detail?: unknown; non_field_errors?: unknown; [key: string]: unknown }
  | null;

export class ApiError extends Error {
  public readonly status?: number;
  public readonly body: ApiErrorBody;

  constructor(message: string, options: { status?: number; body?: ApiErrorBody; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.body = options.body ?? null;
  }
}

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

const sanitizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlashes.toLowerCase().endsWith('/api')) {
    return withoutTrailingSlashes.slice(0, -4);
  }

  return withoutTrailingSlashes;
};

const resolveBaseUrl = (): string => {
  const globalProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;

  const envUrl = globalProcess?.env?.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return sanitizeBaseUrl(envUrl);
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }

  return '';
};

const normalizedBaseUrl = sanitizeBaseUrl(resolveBaseUrl());

const readCsrfToken = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('csrftoken='));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.split('=').slice(1).join('='));
};

export const apiClient = ky.create({
  prefixUrl: normalizedBaseUrl.length > 0 ? `${normalizedBaseUrl}/` : undefined,
  credentials: 'include',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
  hooks: {
    beforeRequest: [
      (request: Request) => {
        if (request.method !== 'GET' && !request.headers.has('Content-Type')) {
          request.headers.set('Content-Type', 'application/json');
        }

        if (!CSRF_SAFE_METHODS.has(request.method.toUpperCase())) {
          const token = readCsrfToken();
          if (token) {
            request.headers.set('X-CSRFToken', token);
          }
        }
      },
    ],
  },
});

const extractMessage = (body: ApiErrorBody, fallback: string) => {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  const detail = body.detail ?? body.non_field_errors;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail.find((value) => typeof value === 'string');
    if (typeof first === 'string') return first;
  }
  return fallback;
};

const normalizeError = async (error: unknown): Promise<Error> => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HTTPError) {
    const httpError = error as HTTPError;
    let body: ApiErrorBody = null;
    try {
      const data = await httpError.response.clone().json();
      body = data as ApiErrorBody;
    } catch {
      try {
        const text = await httpError.response.clone().text();
        body = text ?? null;
      } catch {
        body = null;
      }
    }

    const message = extractMessage(body, httpError.message);
    return new ApiError(message, { status: httpError.response.status, body, cause: httpError });
  }

  if (error instanceof Error) {
    return error;
  }

  return new ApiError('An unexpected error occurred.', { body: null, cause: error });
};

export const apiRequest = async <T>(callback: () => Promise<T>): Promise<T> => {
  try {
    return await callback();
  } catch (error) {
    throw await normalizeError(error);
  }
};
