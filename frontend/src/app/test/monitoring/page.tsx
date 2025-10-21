'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getHealth,
  listMonitoringTrips,
  getMonitoringTrip,
  getMonitoringTripAction,
} from '@/lib/api';
import JsonCard from '@/components/JsonCard';

export default function MonitoringTestPage() {
  // 응답 상태
  const [health, setHealth] = useState<unknown>(null);
  const [monTrips, setMonTrips] = useState<unknown>(null);
  const [tripDetail, setTripDetail] = useState<unknown>(null);
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [err, setErr] = useState<unknown>(null);

  // 입력 상태
  const [tripId, setTripId] = useState<number>(1);
  const [action, setAction] = useState<string>('metrics'); // 예: 'metrics', 'events'
  const [query, setQuery] = useState<string>(''); // action 호출 시 ?key=value&... 쿼리 문자열

  // 폴링
  const [pollHealth, setPollHealth] = useState<boolean>(false);
  const [pollDetail, setPollDetail] = useState<boolean>(false);
  const pollHealthTimer = useRef<NodeJS.Timer | null>(null);
  const pollDetailTimer = useRef<NodeJS.Timer | null>(null);

  // 쿼리 문자열을 객체로 변환 (key=value&x=1 → {key:'value', x:'1'})
  const parseQuery = (qs: string): Record<string, string> => {
    if (!qs.trim()) return {};
    return qs.split('&').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      if (k) acc[k] = v ?? '';
      return acc;
    }, {});
  };

  // 단발 호출
  const handleHealth = async () => {
    setErr(null);
    try {
      const res = await getHealth();
      setHealth(res);
    } catch (e) { setErr(e); }
  };

  const handleListMonitoringTrips = async () => {
    setErr(null);
    try {
      const res = await listMonitoringTrips();
      setMonTrips(res);
    } catch (e) { setErr(e); }
  };

  const handleTripDetail = async () => {
    setErr(null);
    try {
      const res = await getMonitoringTrip(tripId);
      setTripDetail(res);
    } catch (e) { setErr(e); }
  };

  const handleTripAction = async () => {
    setErr(null);
    try {
      const params = parseQuery(query);
      const res = await getMonitoringTripAction(tripId, action, params);
      setActionResult(res);
    } catch (e) { setErr(e); }
  };

  // 폴링 토글
  useEffect(() => {
    // Health 폴링
    if (pollHealth) {
      pollHealthTimer.current = setInterval(() => {
        getHealth().then(setHealth).catch(setErr);
      }, 5000); // 5초
    } else if (pollHealthTimer.current) {
      clearInterval(pollHealthTimer.current);
      pollHealthTimer.current = null;
    }

    return () => {
      if (pollHealthTimer.current) {
        clearInterval(pollHealthTimer.current);
        pollHealthTimer.current = null;
      }
    };
  }, [pollHealth]);

  useEffect(() => {
    // Trip 상세 폴링
    if (pollDetail) {
      pollDetailTimer.current = setInterval(() => {
        getMonitoringTrip(tripId).then(setTripDetail).catch(setErr);
      }, 5000); // 5초
    } else if (pollDetailTimer.current) {
      clearInterval(pollDetailTimer.current);
      pollDetailTimer.current = null;
    }

    return () => {
      if (pollDetailTimer.current) {
        clearInterval(pollDetailTimer.current);
        pollDetailTimer.current = null;
      }
    };
  }, [pollDetail, tripId]);

  return (
    <main className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Test — Monitoring (목록/상세/액션/폴링)</h1>

      {/* 액션 버튼들 */}
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={handleHealth}>
          GET /health/
        </button>
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={handleListMonitoringTrips}>
          GET /monitoring/trips/
        </button>
        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={handleTripDetail}>
          GET /monitoring/trips/&#123;id&#125;/
        </button>
        <button className="px-3 py-2 rounded bg-fuchsia-600 text-white" onClick={handleTripAction}>
          GET /monitoring/trips/&#123;id&#125;/&#123;action&#125;/
        </button>
      </div>

      {/* 입력 파트 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">tripId</label>
        <input
          type="number"
          className="px-2 py-2 rounded border"
          value={tripId}
          onChange={(e) => setTripId(Number(e.target.value))}
        />

        <label className="text-sm">action</label>
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="metrics / events / status ..."
        />

        <label className="text-sm">query(?key=value&x=1)</label>
        <input
          type="text"
          className="px-2 py-2 rounded border min-w-[240px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="since=2025-10-20T00:00:00Z&limit=50"
        />
      </div>

      {/* 폴링 토글 */}
      <div className="flex gap-4 items-center">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={pollHealth} onChange={(e) => setPollHealth(e.target.checked)} />
          <span>건강(health) 5초 폴링</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={pollDetail} onChange={(e) => setPollDetail(e.target.checked)} />
          <span>trip 상세 5초 폴링</span>
        </label>
      </div>

      {/* 결과 표시 */}
      <JsonCard title="health 응답" data={health} />
      <JsonCard title="monitoring/trips 응답" data={monTrips} />
      <JsonCard title="monitoring/trips/{id} 응답" data={tripDetail} />
      <JsonCard title="monitoring/trips/{id}/{action} 응답" data={actionResult} />
      <JsonCard title="에러(있다면)" data={err} />
    </main>
  );
}
