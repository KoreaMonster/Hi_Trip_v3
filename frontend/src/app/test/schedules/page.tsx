'use client';

import { useState } from 'react';
import { listSchedules, createSchedule } from '@/lib/api';
import JsonCard from '@/components/JsonCard';

export default function SchedulesTestPage() {
  const [tripId, setTripId] = useState<number>(1);
  const [title, setTitle] = useState<string>('Demo Schedule');
  const [list, setList] = useState<unknown>(null);
  const [created, setCreated] = useState<unknown>(null);
  const [err, setErr] = useState<unknown>(null);

const handleList = async () => {
    setErr(null); //
    try {
      // [수정됨] 객체 대신 tripId를 직접 전달
      const data = await listSchedules(tripId); //
      setList(data); //
    } catch (e) {
      setErr(e); //
    }
  };

  const handleCreate = async () => {
    setErr(null); //
    try {
      // [수정됨] tripId와 body 객체를 분리하여 전달
      const data = await createSchedule(tripId, { //
        title, //
        // 필요시 날짜를 넣고 싶다면 ISO 문자열로 전달:
        // starts_at: new Date().toISOString(),
        // ends_at: new Date(Date.now() + 60*60*1000).toISOString(),
      });
      setCreated(data); //
    } catch (e) {
      setErr(e); //
    }
  };

  return (
    <main className="p-6 space-y-4"> {/* */}
      <h1 className="text-2xl font-bold">Test — Schedules</h1> {/* */}

      <div className="flex gap-2 items-center flex-wrap"> {/* */}
        <label className="text-sm">tripId</label> {/* */}
        <input
          type="number"
          className="px-2 py-2 rounded border"
          value={tripId}
          onChange={(e) => setTripId(Number(e.target.value))}
        /> {/* */}
        <label className="text-sm">title</label> {/* */}
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        /> {/* */}

        {/* 버튼 텍스트는 편의상 그대로 두셔도 됩니다. */}
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={handleList}
        >
          GET /api/trips/{tripId}/schedules/
        </button>

        {/* [수정됨] {id} -> {tripId}로 변경 */}
        <button
          className="px-3 py-2 rounded bg-emerald-600 text-white"
          onClick={handleCreate}
        >
          POST /api/trips/{tripId}/schedules/
        </button>
      </div>

      <JsonCard title="schedules" data={list} /> {/* */}
      <JsonCard title="created" data={created} /> {/* */}
      <JsonCard title="에러(있다면)" data={err} /> {/* */}
    </main>
  );
}
