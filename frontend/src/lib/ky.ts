// /frontend/src/lib/ky.ts
import ky from 'ky';

// .env.local 예시:
/// NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
//   ↑ /api 경로는 포함하지 않고, 필요하면 환경 변수에서 직접 조정하세요.
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// 안전하게 슬래시 보정
const ensureTrailingSlash = (s: string) => (s.endsWith('/') ? s : s + '/');
const API_BASE = ensureTrailingSlash(RAW_BASE.replace(/\/+$/, ''));

const parseErrorPayload = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    try {
      return await response.clone().text();
    } catch {
      return null;
    }
  }
};

const api = ky.create({
  prefixUrl: API_BASE,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  hooks: {
    afterResponse: [
      async (_req, _opt, res) => {
        if (!res.ok) {
          const payload = await parseErrorPayload(res);
          console.error('[API ERROR]', res.status, payload);

        }
      },
    ],
  },
});

export default api;
