'use client';

import { useEffect, useRef, useState } from 'react';
import { getHealth, getMonitoringTripAlerts, getMonitoringTripLatest } from '@/lib/api';
import JsonCard from '@/components/JsonCard';
import type { HealthResponse, MonitoringAlert, ParticipantLatest } from '@/types/api';

export default function MonitoringTestPage() {
  // 응답 상태
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[] | null>(null);
  const [latest, setLatest] = useState<ParticipantLatest[] | null>(null);
  const [err, setErr] = useState<unknown>(null);

  // 입력 상태
  const [tripId, setTripId] = useState<number>(1);

  // 폴링
  const [pollHealth, setPollHealth] = useState<boolean>(false);
  const [pollAlerts, setPollAlerts] = useState<boolean>(false);
  const [pollLatest, setPollLatest] = useState<boolean>(false);
  const pollHealthTimer = useRef<NodeJS.Timer | null>(null);
  const pollAlertsTimer = useRef<NodeJS.Timer | null>(null);
  const pollLatestTimer = useRef<NodeJS.Timer | null>(null);

  const safeTripId = Number.isFinite(tripId) ? tripId : 1;

  const handleHealth = async () => {
    setErr(null);
    try {
      const res = await getHealth();
      setHealth(res);
    } catch (e) {
      setErr(e);
    }
  };

  const handleAlerts = async () => {
    setErr(null);
    try {
      const res = await getMonitoringTripAlerts(safeTripId);
      setAlerts(res);
    } catch (e) {
      setErr(e);
    }
  };

  const handleLatest = async () => {
    setErr(null);
    try {
      const res = await getMonitoringTripLatest(safeTripId);
      setLatest(res);
    } catch (e) {
      setErr(e);
    }
  };

  useEffect(() => {
    if (pollHealth) {
      pollHealthTimer.current = setInterval(() => {
        getHealth().then(setHealth).catch(setErr);
      }, 5000);
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
    if (pollAlerts) {
      pollAlertsTimer.current = setInterval(() => {
        getMonitoringTripAlerts(safeTripId).then(setAlerts).catch(setErr);
      }, 5000);
    } else if (pollAlertsTimer.current) {
      clearInterval(pollAlertsTimer.current);
      pollAlertsTimer.current = null;
    }

    return () => {
      if (pollAlertsTimer.current) {
        clearInterval(pollAlertsTimer.current);
        pollAlertsTimer.current = null;
      }
    };
  }, [pollAlerts, safeTripId]);

  useEffect(() => {
    if (pollLatest) {
      pollLatestTimer.current = setInterval(() => {
        getMonitoringTripLatest(safeTripId).then(setLatest).catch(setErr);
      }, 5000);
    } else if (pollLatestTimer.current) {
      clearInterval(pollLatestTimer.current);
      pollLatestTimer.current = null;
    }

    return () => {
      if (pollLatestTimer.current) {
        clearInterval(pollLatestTimer.current);
        pollLatestTimer.current = null;
      }
    };
  }, [pollLatest, safeTripId]);

  return (
    <main className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Test — Monitoring (alerts/latest/health)</h1>

      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={handleHealth}>
          GET /api/health/
        </button>
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={handleAlerts}>
          GET /api/monitoring/trips/{tripId}/alerts/
        </button>
        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={handleLatest}>
          GET /api/monitoring/trips/{tripId}/latest/
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">tripId</label>
        <input
          type="number"
          className="px-2 py-2 rounded border"
          value={tripId}
          onChange={(e) => setTripId(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pollHealth} onChange={(e) => setPollHealth(e.target.checked)} />
          <span>health 5초 폴링</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pollAlerts} onChange={(e) => setPollAlerts(e.target.checked)} />
          <span>alerts 5초 폴링</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pollLatest} onChange={(e) => setPollLatest(e.target.checked)} />
          <span>latest 5초 폴링</span>
        </label>
      </div>

      <JsonCard title="health 응답" data={health} />
      <JsonCard title="monitoring/trips/{id}/alerts 응답" data={alerts} />
      <JsonCard title="monitoring/trips/{id}/latest 응답" data={latest} />
      <JsonCard title="에러(있다면)" data={err} />
    </main>
  );
}
