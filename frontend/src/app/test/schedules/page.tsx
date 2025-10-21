'use client';

import { useState } from 'react';
import { createSchedule, listSchedules } from '@/lib/api';
import JsonCard from '@/components/JsonCard';
import type { Schedule } from '@/types/api';

export default function SchedulesTestPage() {
  const [tripId, setTripId] = useState<number>(1);
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [mainContent, setMainContent] = useState<string>('Demo 일정');
  const [meetingPoint, setMeetingPoint] = useState<string>('로비');
  const [list, setList] = useState<Schedule[] | null>(null);
  const [created, setCreated] = useState<Schedule | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const handleList = async () => {
    setErr(null);
    try {
      const data = await listSchedules(tripId);
      setList(data);
    } catch (e) {
      setErr(e);
    }
  };

  const handleCreate = async () => {
    setErr(null);
    try {
      const normalizeTime = (value: string) =>
        value.includes(':') && value.length === 5 ? `${value}:00` : value;
      const data = await createSchedule(tripId, {
        day_number: dayNumber,
        start_time: normalizeTime(startTime),
        end_time: normalizeTime(endTime),
        main_content: mainContent,
        meeting_point: meetingPoint,
      });
      setCreated(data);
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Test — Schedules</h1>

      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-sm">tripId</label>
        <input
          type="number"
          className="px-2 py-2 rounded border"
          value={tripId}
          onChange={(e) => setTripId(Number(e.target.value))}
        />
        <label className="text-sm">day_number</label>
        <input
          type="number"
          className="px-2 py-2 rounded border"
          value={dayNumber}
          onChange={(e) => setDayNumber(Number(e.target.value))}
        />
        <label className="text-sm">start_time(HH:MM)</label>
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <label className="text-sm">end_time(HH:MM)</label>
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
        <label className="text-sm">main_content</label>
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={mainContent}
          onChange={(e) => setMainContent(e.target.value)}
        />
        <label className="text-sm">meeting_point</label>
        <input
          type="text"
          className="px-2 py-2 rounded border"
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
        />

        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={handleList}
        >
          GET /api/trips/{tripId}/schedules/
        </button>
        <button
          className="px-3 py-2 rounded bg-emerald-600 text-white"
          onClick={handleCreate}
        >
          POST /api/trips/{tripId}/schedules/
        </button>
      </div>

      <JsonCard title="schedules" data={list} />
      <JsonCard title="created" data={created} />
      <JsonCard title="에러(있다면)" data={err} />
    </main>
  );
}
