'use client';

import { useState } from 'react';
import { createTrip, listParticipants, listTrips } from '@/lib/api';
import JsonCard from '@/components/JsonCard';
import type { Trip, TripCreate, TripParticipant } from '@/types/api';

export default function TripsTestPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [created, setCreated] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<TripParticipant[] | null>(null);
  const [form, setForm] = useState<TripCreate>({
    title: 'Demo Trip',
    destination: '서울',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    status: 'planning',
  });
  const [tripId, setTripId] = useState<number>(1);
  const [err, setErr] = useState<unknown>(null);

  const handleList = async () => {
    setErr(null);
    try {
      const data = await listTrips();
      setTrips(data);
    } catch (e) { setErr(e); }
  };

  const handleChange = (field: keyof TripCreate) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'status' ? (value as TripCreate['status']) : value,
    }));
  };

  const handleCreate = async () => {
    setErr(null);
    try {
      const data = await createTrip({
        ...form,
        title: form.title.trim() ? form.title : `Demo Trip ${Date.now()}`,
      });
      setCreated(data);
    } catch (e) { setErr(e); }
  };

  const handleParticipants = async () => {
    setErr(null);
    try {
      const data = await listParticipants(tripId);
      setParticipants(data);
    } catch (e) { setErr(e); }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Test — Trips</h1>

      <div className="flex gap-2 items-center flex-wrap">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={handleList}>
          GET /trips/
        </button>
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={handleCreate}>
          POST /trips/
        </button>

        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs uppercase text-slate-500">제목</label>
          <input
            type="text"
            className="px-2 py-1 border rounded"
            value={form.title}
            onChange={(e) => handleChange('title')(e.target.value)}
          />
          <label className="text-xs uppercase text-slate-500">목적지</label>
          <input
            type="text"
            className="px-2 py-1 border rounded"
            value={form.destination}
            onChange={(e) => handleChange('destination')(e.target.value)}
          />
          <label className="text-xs uppercase text-slate-500">시작일</label>
          <input
            type="date"
            className="px-2 py-1 border rounded"
            value={form.start_date}
            onChange={(e) => handleChange('start_date')(e.target.value)}
          />
          <label className="text-xs uppercase text-slate-500">종료일</label>
          <input
            type="date"
            className="px-2 py-1 border rounded"
            value={form.end_date}
            onChange={(e) => handleChange('end_date')(e.target.value)}
          />
          <label className="text-xs uppercase text-slate-500">상태</label>
          <select
            className="px-2 py-1 border rounded"
            value={form.status ?? 'planning'}
            onChange={(e) => handleChange('status')(e.target.value)}
          >
            <option value="planning">planning</option>
            <option value="ongoing">ongoing</option>
            <option value="completed">completed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="tripId" className="text-sm">tripId</label>
          <input
            id="tripId"
            type="number"
            className="px-2 py-2 rounded border"
            value={tripId}
            onChange={(e) => setTripId(Number(e.target.value))}
          />
          <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={handleParticipants}>
            GET /trips/{'{id}'}/participants/
          </button>
        </div>
      </div>

      <JsonCard title="trips" data={trips} />
      <JsonCard title="created" data={created} />
      <JsonCard title="participants" data={participants} />
      <JsonCard title="에러(있다면)" data={err} />
    </main>
  );
}
