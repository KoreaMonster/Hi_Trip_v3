// /frontend/src/lib/ky.ts
import ky from 'ky';

// .env.local 예시:
// NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/
//   ↑ 마지막에 반드시 슬래시(`/`) 포함!  (…/api/)
// 백엔드가 /api prefix가 아니라면 그에 맞춰 BASE_URL을 바꿔주세요.
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/';

// 안전하게 슬래시 보정
const ensureTrailingSlash = (s: string) => (s.endsWith('/') ? s : s + '/');
const API_BASE = ensureTrailingSlash(RAW_BASE);

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
          let data: any = null;
          try { data = await res.clone().json(); } catch { data = await res.clone().text(); }
          // eslint-disable-next-line no-console
          console.error('[API ERROR]', res.status, data);
          // 원하면 여기서 throw new Error(JSON.stringify({status:res.status, data})) 해도 됩니다.
        }
      },
    ],
  },
});

export default api;
