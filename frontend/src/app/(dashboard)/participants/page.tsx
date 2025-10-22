'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown, UsersRound } from 'lucide-react';
import { useParticipantsQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Trip, TripParticipant } from '@/types/api';

const genderLabel = (gender?: TripParticipant['traveler']['gender']) => {
  if (gender === 'M') return 'Male';
  if (gender === 'F') return 'Female';
  return 'Unknown';
};

const formatDate = (value?: string | null) => {
  if (!value) return 'TBD';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`;
};

const formatTripRange = (trip?: Trip | null) => {
  if (!trip) return 'No schedule available';
  if (!trip.start_date || !trip.end_date) return 'Schedule TBD';
  return `${formatDate(trip.start_date)} ~ ${formatDate(trip.end_date)}`;
};

export default function ParticipantsPage() {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isSuperAdmin,
  } = useScopedTrips();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (trips.length === 0) {
      if (selectedTripId !== null) {
        setSelectedTripId(null);
      }
      return;
    }

    const queryTripId = searchParams.get('tripId');
    if (queryTripId) {
      const parsed = Number(queryTripId);
      if (!Number.isNaN(parsed) && trips.some((trip) => trip.id === parsed)) {
        if (selectedTripId !== parsed) {
          setSelectedTripId(parsed);
        }
        return;
      }
    }

    if (selectedTripId === null || !trips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(trips[0].id);
    }
  }, [searchParams, selectedTripId, trips]);

  const tripQueryEnabled = typeof selectedTripId === 'number';
  const { data: participants = [], isLoading } = useParticipantsQuery(selectedTripId ?? undefined, {
    enabled: tripQueryEnabled,
  });

  const currentTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  const sortedTrips = useMemo(() => {
    const toComparable = (value?: string | null) => {
      if (!value) return Number.MAX_SAFE_INTEGER;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return Number.MAX_SAFE_INTEGER;
      }
      return parsed.getTime();
    };

    return [...trips].sort((a, b) => {
      const diff = toComparable(a.start_date) - toComparable(b.start_date);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });
  }, [trips]);

  const groupedTrips = useMemo(
    () =>
      sortedTrips.map((trip, index) => ({
        order: index + 1,
        trip,
      })),
    [sortedTrips],
  );

  const participantMetrics = useMemo(() => {
    if (participants.length === 0) {
      return {
        total: 0,
        contactReady: 0,
        responseRate: 0,
        latest: null as TripParticipant | null,
        pendingContacts: 0,
      };
    }

    const contactReady = participants.filter(
      (participant) => participant.traveler.phone && participant.traveler.email,
    ).length;
    const responseRate = Math.round((contactReady / participants.length) * 100);
    const latest = [...participants]
      .filter((participant) => Boolean(participant.joined_date))
      .sort(
        (a, b) => new Date(a.joined_date ?? 0).getTime() - new Date(b.joined_date ?? 0).getTime(),
      )
      .pop() ?? null;
    const pendingContacts = participants.length - contactReady;

    return { total: participants.length, contactReady, responseRate, latest, pendingContacts };
  }, [participants]);

  const emptyParticipantsMessage = useMemo(() => {
    if (currentTrip) {
      return 'No participants yet. Share an invite code to get started.';
    }
    if (trips.length === 0) {
      return isSuperAdmin ? 'No trips have been created yet.' : 'No trips have been assigned yet.';
    }
    return 'Select a trip to review its participants.';
  }, [currentTrip, isSuperAdmin, trips.length]);

  const noGroupMessage = isSuperAdmin
    ? 'No trips have been created yet.'
    : 'No trips have been assigned to you yet.';

  const canSelectTrip = groupedTrips.length > 1;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">Trip groups</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Participant overview by trip</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSuperAdmin
                ? 'Super admins can review participant groups across all trips.'
                : 'The list reflects the trips assigned to you.'}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Order</th>
                <th className="px-5 py-3 text-left font-semibold">Customers</th>
                <th className="px-5 py-3 text-left font-semibold">Trip name</th>
                <th className="px-5 py-3 text-left font-semibold">Owner</th>
                <th className="px-5 py-3 text-left font-semibold">Start date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tripsLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    Loading trip information…
                  </td>
                </tr>
              )}
              {!tripsLoading && groupedTrips.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                    {noGroupMessage}
                  </td>
                </tr>
              )}
              {groupedTrips.map(({ order, trip }) => {
                const isActive = trip.id === selectedTripId;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`cursor-pointer transition ${
                      isActive ? 'bg-primary-50/80 text-primary-700' : 'hover:bg-slate-50/70'
                    }`}
                    aria-selected={isActive}
                  >
                    <td className="px-5 py-4 font-semibold">{order}</td>
                    <td className="px-5 py-4 font-semibold">{trip.participant_count ?? 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{trip.title}</span>
                        <span className="text-xs text-slate-500">
                          {trip.destination ?? 'Destination TBD'} · {formatTripRange(trip)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{trip.manager_name ?? 'Unassigned'}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(trip.start_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">Selected trip</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {currentTrip ? `${currentTrip.title} participant summary` : 'No trip selected'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {currentTrip
                ? `${currentTrip.destination ?? 'Destination TBD'} · ${formatTripRange(currentTrip)}`
                : isSuperAdmin
                  ? 'Create a trip and assign an owner to see participant groups here.'
                  : 'You will see participant details once a trip is assigned to you.'}
            </p>
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
                  {groupedTrips.map(({ trip }) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            ) : currentTrip ? (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {currentTrip.title}
              </span>
            ) : null}
            <button
              type="button"
              disabled={!currentTrip}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UsersRound className="h-4 w-4" />
              Share invite code
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ParticipantSummary
            label="Total participants"
            value={`${participantMetrics.total}`}
            helper="Confirmed attendees"
          />
          <ParticipantSummary
            label="Contact completion"
            value={`${participantMetrics.responseRate}%`}
            helper={`Contacts on file ${participantMetrics.contactReady}/${participantMetrics.total}`}
            tone="bg-emerald-500/10 text-emerald-600"
          />
          <ParticipantSummary
            label="Most recent join"
            value={participantMetrics.latest?.traveler.full_name_kr ?? 'No record'}
            helper={participantMetrics.latest?.joined_date
              ? new Date(participantMetrics.latest.joined_date).toLocaleDateString('en-US')
              : 'No recent join history.'}
            tone="bg-primary-500/10 text-primary-600"
          />
          <ParticipantSummary
            label="Contacts missing"
            value={`${participantMetrics.pendingContacts}`}
            helper="Follow up to collect details"
            tone="bg-amber-500/10 text-amber-600"
          />
        </div>
      </section>

      <section>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Participant directory</h3>
              <p className="text-sm text-slate-500">Review contact information and key details.</p>
            </div>
            {currentTrip && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {currentTrip.destination ?? 'Destination TBD'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-[#F7F9FC] text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Name</th>
                  <th className="px-5 py-3 text-left font-semibold">Phone</th>
                  <th className="px-5 py-3 text-left font-semibold">Email</th>
                  <th className="px-5 py-3 text-left font-semibold">Gender</th>
                  <th className="px-5 py-3 text-left font-semibold">Join date</th>
                  <th className="px-5 py-3 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                      Loading participant information…
                    </td>
                  </tr>
                )}
                {!isLoading && (participants.length === 0 || !currentTrip) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">
                      {emptyParticipantsMessage}
                    </td>
                  </tr>
                )}
                {participants.map((participant) => (
                  <tr key={participant.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-semibold text-slate-800">{participant.traveler.full_name_kr}</td>
                    <td className="px-5 py-4 text-slate-600">{participant.traveler.phone}</td>
                    <td className="px-5 py-4 text-slate-600">{participant.traveler.email}</td>
                    <td className="px-5 py-4 text-slate-600">{genderLabel(participant.traveler.gender)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(participant.joined_date ?? '').toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4 text-right text-sm">
                      {tripQueryEnabled ? (
                        <Link
                          href={`/participants/${participant.id}?tripId=${selectedTripId}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
                        >
                          View details
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                          View details
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

function ParticipantSummary({
  label,
  value,
  helper,
  tone = 'bg-slate-500/10 text-slate-600',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <UsersRound className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
