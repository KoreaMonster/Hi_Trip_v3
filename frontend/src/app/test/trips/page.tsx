'use client';

import { useState } from 'react';
import { listTrips, createTrip, listParticipants } from '@/lib/api';
import JsonCard from '@/components/JsonCard';

export default function TripsTestPage() {
  const [trips, setTrips] = useState<unknown>(null);
  const [created, setCreated] = useState<unknown>(null);
  const [participants, setParticipants] = useState<unknown>(null);
  const [tripId, setTripId] = useState<number>(1);
  const [err, setErr] = useState<unknown>(null);

  const handleList = async () => {
    setErr(null);
    try {
      const data = await listTrips();
      setTrips(data);
    } catch (e) { setErr(e); }
  };

  const handleCreate = async () => {
    setErr(null);
    try {
      const data = await createTrip({ title: `Demo Trip ${Date.now()}` });
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
