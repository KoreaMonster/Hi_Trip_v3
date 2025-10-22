'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Filter, MapPin, Plane, PlusCircle, UserCog, Users2, X } from 'lucide-react';
import { assignTripManager, createTrip } from '@/lib/api';
import { useTranslations } from '@/lib/i18n';
import { useStaffDirectoryQuery } from '@/lib/queryHooks';
import { useScopedTrips } from '@/lib/useScopedTrips';
import type { Trip, TripCreate } from '@/types/api';

type TripFormState = {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
};

const initialTripForm: TripFormState = {
  title: '',
  destination: '',
  start_date: '',
  end_date: '',
};

const statusFilters: Array<'all' | Trip['status']> = ['all', 'planning', 'ongoing', 'completed'];

export default function TripsPage() {
  const { data: trips = [], isLoading: tripsLoading, isSuperAdmin } = useScopedTrips();
  const queryClient = useQueryClient();
  const t = useTranslations();
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<TripFormState>({ ...initialTripForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Trip | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<number | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const canManageAssignments = isSuperAdmin;
  const canCreateTrips = isSuperAdmin;

  const createTripMutation = useMutation({
    mutationFn: (payload: TripCreate) => createTrip(payload),
    onSuccess: async (createdTrip) => {
      setForm({ ...initialTripForm });
      setShowCreateModal(false);
      setFormError(null);
      setFormSuccess(`${createdTrip.title} ${t('trips.create.successSuffix')}`);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : t('trips.create.errorFallback');
      setFormError(message);
    },
  });

  const { data: staffDirectory = [], isLoading: staffLoading } = useStaffDirectoryQuery(
    assignTarget && canManageAssignments ? { is_approved: true } : undefined,
    { enabled: canManageAssignments && assignTarget !== null },
  );

  useEffect(() => {
    if (!assignTarget) return;
    if (assignManagerId !== null) return;

    if (typeof assignTarget.manager === 'number') {
      setAssignManagerId(assignTarget.manager);
      return;
    }

    if (staffDirectory.length > 0) {
      setAssignManagerId(staffDirectory[0].id);
    }
  }, [assignManagerId, assignTarget, staffDirectory]);

  useEffect(() => {
    if (!canManageAssignments && assignTarget) {
      setAssignTarget(null);
      setAssignManagerId(null);
      setAssignError(null);
    }
  }, [canManageAssignments, assignTarget]);

  const assignManagerMutation = useMutation({
    mutationFn: ({ tripId, managerId }: { tripId: number; managerId: number }) =>
      assignTripManager(tripId, managerId),
    onSuccess: async (updatedTrip) => {
      setFormSuccess(`${updatedTrip.title} ${t('trips.assign.successSuffix')}`);
      setAssignTarget(null);
      setAssignManagerId(null);
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : t('trips.assign.errorFallback');
      setAssignError(message);
    },
  });

  const handleFormChange = (field: keyof TripFormState) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleCreateTrip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.title.trim() || !form.destination.trim()) {
      setFormError(t('trips.create.validation.titleDestination'));
      return;
    }

    if (!form.start_date || !form.end_date) {
      setFormError(t('trips.create.validation.datesRequired'));
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setFormError(t('trips.create.validation.dateOrder'));
      return;
    }

    const payload: TripCreate = {
      title: form.title.trim(),
      destination: form.destination.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
    };

    createTripMutation.mutate(payload);
  };

  const statusCounts = useMemo(() => {
    return trips.reduce(
      (acc, trip) => {
        acc.total += 1;
        acc[trip.status] += 1;
        return acc;
      },
      { total: 0, planning: 0, ongoing: 0, completed: 0 },
    );
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [filter, trips]);

  const tableColumnCount = canManageAssignments ? 6 : 5;
  const emptyTableMessage = filter === 'all'
    ? (isSuperAdmin ? t('trips.table.emptySuperAdmin') : t('trips.table.emptyAssigned'))
    : t('trips.table.emptyFilter');

  const tripStatusMeta: Record<Trip['status'], { label: string; tone: string; chip: string }> = useMemo(
    () => ({
      planning: {
        label: t('trips.status.planning'),
        tone: 'bg-amber-50 text-amber-600 border border-amber-200',
        chip: 'bg-amber-500/15 text-amber-600',
      },
      ongoing: {
        label: t('trips.status.ongoing'),
        tone: 'bg-primary-50 text-primary-600 border border-primary-200',
        chip: 'bg-primary-500/15 text-primary-600',
      },
      completed: {
        label: t('trips.status.completed'),
        tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        chip: 'bg-emerald-500/15 text-emerald-600',
      },
    }),
    [t],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
              {t('trips.header.badge')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('trips.header.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('trips.header.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600">
              <Filter className="h-4 w-4" />
              {t('trips.header.advancedFilter')}
            </button>
            {canCreateTrips ? (
              <button
                type="button"
                onClick={() => {
                  setForm({ ...initialTripForm });
                  setFormError(null);
                  setFormSuccess(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                <PlusCircle className="h-4 w-4" />
                {t('trips.header.createTrip')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400">
                {t('trips.header.readOnly')}
              </span>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TripSummaryCard
            icon={Plane}
            title={t('trips.summary.total.title')}
            value={`${statusCounts.total} ${t('trips.summary.unit')}`}
            helper={t('trips.summary.total.helper')}
          />
          <TripSummaryCard
            icon={CalendarRange}
            title={t('trips.summary.ongoing.title')}
            value={`${statusCounts.ongoing} ${t('trips.summary.unit')}`}
            helper={t('trips.summary.ongoing.helper')}
            tone="bg-primary-500/10 text-primary-600"
          />
          <TripSummaryCard
            icon={MapPin}
            title={t('trips.summary.planning.title')}
            value={`${statusCounts.planning} ${t('trips.summary.unit')}`}
            helper={t('trips.summary.planning.helper')}
            tone="bg-amber-500/10 text-amber-600"
          />
          <TripSummaryCard
            icon={Users2}
            title={t('trips.summary.completed.title')}
            value={`${statusCounts.completed} ${t('trips.summary.unit')}`}
            helper={t('trips.summary.completed.helper')}
            tone="bg-emerald-500/10 text-emerald-600"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('trips.table.title')}</h2>
            <p className="text-sm text-slate-500">{t('trips.table.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((item) => {
              const isActive = item === filter;
              const label = item === 'all' ? t('trips.filters.all') : tripStatusMeta[item].label;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-primary-200 hover:text-primary-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-[#F7F9FC] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">{t('trips.table.headers.trip')}</th>
                <th className="px-5 py-3 text-left font-semibold">{t('trips.table.headers.period')}</th>
                <th className="px-5 py-3 text-left font-semibold">{t('trips.table.headers.manager')}</th>
                <th className="px-5 py-3 text-left font-semibold">{t('trips.table.headers.status')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('trips.table.headers.participants')}</th>
                {canManageAssignments && (
                  <th className="px-5 py-3 text-right font-semibold">{t('trips.table.headers.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tripsLoading && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    {t('trips.table.loading')}
                  </td>
                </tr>
              )}
              {!tripsLoading && filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={tableColumnCount} className="px-5 py-6 text-center text-sm text-slate-500">
                    {emptyTableMessage}
                  </td>
                </tr>
              )}
              {filteredTrips.map((trip) => {
                const status = tripStatusMeta[trip.status];
                return (
                  <tr key={trip.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-800">{trip.title}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {trip.start_date} ~ {trip.end_date}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{trip.manager_name ?? t('trips.table.managerUnassigned')}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>
                        <span className={`h-2 w-2 rounded-full ${status.chip}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-600">
                      {trip.participant_count ?? 0} {t('trips.table.participantUnit')}
                    </td>
                    {canManageAssignments && (
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTarget(trip);
                            setAssignManagerId(trip.manager ?? null);
                            setAssignError(null);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-600 shadow-sm transition hover:bg-primary-100"
                        >
                          <UserCog className="h-4 w-4" /> {t('trips.table.assignAction')}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {formSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-600 shadow-sm">
          {formSuccess}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
                  {t('trips.create.modal.badge')}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{t('trips.create.modal.title')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('trips.create.modal.description')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 transition hover:border-primary-200 hover:text-primary-600"
                aria-label={t('trips.create.modal.closeAria')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {formError}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleCreateTrip}>
              <div className="space-y-2">
                <label htmlFor="trip-title" className="text-sm font-semibold text-slate-700">
                  {t('trips.create.form.titleLabel')}
                </label>
                <input
                  id="trip-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => handleFormChange('title')(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  placeholder={t('trips.create.form.titlePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="trip-destination" className="text-sm font-semibold text-slate-700">
                  {t('trips.create.form.destinationLabel')}
                </label>
                <input
                  id="trip-destination"
                  type="text"
                  value={form.destination}
                  onChange={(event) => handleFormChange('destination')(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  placeholder={t('trips.create.form.destinationPlaceholder')}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="trip-start" className="text-sm font-semibold text-slate-700">
                    {t('trips.create.form.startDateLabel')}
                  </label>
                  <input
                    id="trip-start"
                    type="date"
                    value={form.start_date}
                    onChange={(event) => handleFormChange('start_date')(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="trip-end" className="text-sm font-semibold text-slate-700">
                    {t('trips.create.form.endDateLabel')}
                  </label>
                  <input
                    id="trip-end"
                    type="date"
                    value={form.end_date}
                    onChange={(event) => handleFormChange('end_date')(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                >
                  {t('trips.create.form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createTripMutation.isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createTripMutation.isLoading ? t('trips.create.form.submitting') : t('trips.create.form.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignTarget && canManageAssignments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-500">
                  {t('trips.assign.modal.badge')}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{assignTarget.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('trips.assign.modal.description')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignTarget(null);
                  setAssignManagerId(null);
                  setAssignError(null);
                }}
                className="rounded-full border border-slate-200 p-1.5 text-slate-400 transition hover:border-primary-200 hover:text-primary-600"
                aria-label={t('trips.assign.modal.closeAria')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {assignError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {assignError}
              </div>
            )}

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!assignTarget) return;
                if (!assignManagerId) {
                  setAssignError(t('trips.assign.validation.selectManager'));
                  return;
                }
                setAssignError(null);
                assignManagerMutation.mutate({ tripId: assignTarget.id, managerId: assignManagerId });
              }}
            >
              <div className="space-y-2">
                <label htmlFor="trip-manager" className="text-sm font-semibold text-slate-700">
                  {t('trips.assign.form.managerLabel')}
                </label>
                {staffLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {t('trips.assign.form.loadingManagers')}
                  </div>
                ) : staffDirectory.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">
                    {t('trips.assign.form.noManagers')}
                  </div>
                ) : (
                  <select
                    id="trip-manager"
                    value={assignManagerId ?? ''}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setAssignManagerId(Number.isNaN(value) ? null : value);
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-primary-200 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    required
                  >
                    {staffDirectory.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name_kr} · {member.role_display}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-2xl bg-[#F7F9FC] px-4 py-3 text-xs text-slate-500">
                {t('trips.assign.form.currentLabel')} ·{' '}
                <span className="font-semibold text-slate-700">{assignTarget.manager_name ?? t('trips.assign.form.currentFallback')}</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignTarget(null);
                    setAssignManagerId(null);
                    setAssignError(null);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
                >
                  {t('trips.assign.form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={assignManagerMutation.isLoading || staffDirectory.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assignManagerMutation.isLoading
                    ? t('trips.assign.form.submitting')
                    : t('trips.assign.form.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TripSummaryCard({
  icon: Icon,
  title,
  value,
  helper,
  tone = 'bg-slate-500/10 text-slate-600',
}: {
  icon: (props: { className?: string }) => JSX.Element;
  title: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}
