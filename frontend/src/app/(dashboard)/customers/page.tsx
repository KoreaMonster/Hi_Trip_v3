'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarCheck2, ChevronDown, Crown, Mail, PhoneCall, UserRound } from 'lucide-react';
import { useParticipantsQuery, useSchedulesQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Schedule, Trip } from '@/types/api';

export default function CustomersPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  useEffect(() => {
    if (trips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    if (selectedTripId === null || !trips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);

  const { data: participants = [], isLoading } = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });

  const { data: schedules = [] } = useSchedulesQuery(selectedTripId ?? undefined, {
    enabled: typeof selectedTripId === 'number',
  });

  const selectedTrip = useMemo<Trip | null>(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );
  const canSelectTrip = trips.length > 1;
  const noTripMessage = isSuperAdmin ? 'No trips have been created yet.' : 'No trips have been assigned yet.';

  const responseRate = useMemo(() => {
    if (participants.length === 0) return 0;
    const withResponse = participants.filter((participant) => Boolean(participant.joined_date)).length;
    const denominator = selectedTrip?.participant_count ?? participants.length;
    if (!denominator) return 0;
    return Math.min(100, Math.round((withResponse / denominator) * 100));
  }, [participants, selectedTrip]);

  const upcomingCount = useMemo(() => {
    if (!selectedTrip) return 0;
    return getUpcomingScheduleCount(selectedTrip, schedules);
  }, [schedules, selectedTrip]);

  const engagement = useMemo(() => {
    const total = participants.length;
    const vip = [...participants]
      .sort(
        (a, b) =>
          new Date(a.joined_date).getTime() - new Date(b.joined_date).getTime(),
      )
      .slice(0, 3);
    return {
      total,
      vip,
      responseRate,
      upcoming: upcomingCount,
    };
  }, [participants, responseRate, upcomingCount]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">Customer success</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">VIP care board</h1>
            <p className="mt-1 text-sm text-slate-500">Track participant outreach and response trends to deliver personalized care.</p>
            {!selectedTrip && (
              <p className="mt-2 text-xs text-slate-500">
                {tripsLoading ? 'Loading trip information…' : noTripMessage}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canSelectTrip ? (
              <div className="relative">
                <select
                  value={selectedTripId ?? ''}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      setSelectedTripId(null);
                      return;
                    }
                    setSelectedTripId(value);
                  }}
                  className="appearance-none rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus:border-primary-300 focus:outline-none"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            ) : selectedTrip ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {selectedTrip.title}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {tripsLoading ? 'Loading trip information…' : noTripMessage}
              </span>
            )}
            <button className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
            <Mail className="h-4 w-4" /> Send tailored email
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CustomerSummary icon={UserRound} label="Total customers" value={`${engagement.total}`} helper="Confirmed attendees" />
          <CustomerSummary icon={Crown} label="VIP" value={`${engagement.vip.length}`} helper="Priority follow-up" tone="bg-primary-500/10 text-primary-600" />
          <CustomerSummary icon={Mail} label="Response rate" value={`${engagement.responseRate}%`} helper="Campaign replies" tone="bg-emerald-500/10 text-emerald-600" />
          <CustomerSummary icon={CalendarCheck2} label="Upcoming events" value={`${engagement.upcoming}`} helper="Experiences & meetings" tone="bg-amber-500/10 text-amber-600" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Engagement timeline</h2>
              <p className="text-sm text-slate-500">See the latest touchpoints and priorities for each customer.</p>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">Last 7 days</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-[#F7F9FC] text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Name</th>
                  <th className="px-5 py-3 text-left font-semibold">Phone</th>
                  <th className="px-5 py-3 text-left font-semibold">Email</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                      Loading customer information…
                    </td>
                  </tr>
                )}
                {!isLoading && participants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                      {selectedTrip ? 'No customer information yet.' : noTripMessage}
                    </td>
                  </tr>
                )}
                {participants.map((participant) => {
                  const daysSinceJoin = Math.floor(
                    (Date.now() - new Date(participant.joined_date).getTime()) / (1000 * 60 * 60 * 24),
                  );
                  const isRecent = daysSinceJoin <= 7;
                  const params = new URLSearchParams();
                  if (selectedTripId) {
                    params.set('trip', String(selectedTripId));
                  }
                  params.set('participant', String(participant.id));
                  const query = params.toString();
                  const href = `/customers/${participant.traveler.id}${query ? `?${query}` : ''}`;
                  return (
                    <tr key={participant.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-semibold text-primary-600">
                        <Link href={href} className="hover:underline">
                          {participant.traveler.full_name_kr}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{participant.traveler.phone}</td>
                      <td className="px-5 py-4 text-slate-600">{participant.traveler.email}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isRecent ? 'bg-primary-50 text-primary-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isRecent ? 'Meeting scheduled' : 'Response received'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                        >
                          View details
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Care notes</h2>
          <p className="text-sm text-slate-500">Keep personalized talking points ready for your VIP customers.</p>
          <div className="space-y-3 text-sm text-slate-600">
            {engagement.vip.map((customer) => (
              <div key={customer.id} className="rounded-2xl border border-slate-100 bg-[#E8F1FF] p-4 shadow-inner">
                <p className="text-sm font-semibold text-slate-900">{customer.traveler.full_name_kr}</p>
                <p className="mt-1 text-xs text-slate-500">Recent inquiry · Requested seat upgrade</p>
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-primary-600">
                  <PhoneCall className="h-3.5 w-3.5" /> Respond within 24 hours
                </p>
              </div>
            ))}
            {engagement.vip.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No priority customers at the moment.
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function getUpcomingScheduleCount(trip: Trip, schedules: Schedule[]): number {
  if (!trip.start_date) return 0;

  const baseDate = new Date(trip.start_date);
  const now = Date.now();

  return schedules.filter((schedule) => {
    const scheduleDate = new Date(baseDate);
    scheduleDate.setDate(scheduleDate.getDate() + Math.max(schedule.day_number - 1, 0));
    const [hour, minute] = schedule.start_time.split(':').map((value) => Number(value));
    scheduleDate.setHours(hour ?? 0, minute ?? 0, 0, 0);
    return scheduleDate.getTime() >= now;
  }).length;
}

function CustomerSummary({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'bg-slate-500/10 text-slate-600',
}: {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
