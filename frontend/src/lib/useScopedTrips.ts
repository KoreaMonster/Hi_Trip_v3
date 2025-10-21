'use client';

import { useMemo } from 'react';
import { useTripsQuery } from '@/lib/queryHooks';
import { useUserStore } from '@/stores/useUserStore';
import type { Trip, UserDetail } from '@/types/api';

export type ScopedTripsResult = ReturnType<typeof useTripsQuery> & {
  data: Trip[];
  scopedTrips: Trip[];
  rawTrips: Trip[];
  isSuperAdmin: boolean;
  userRole: UserDetail['role'] | undefined;
  currentUserId: number | undefined;
};

export const useScopedTrips = (): ScopedTripsResult => {
  const queryResult = useTripsQuery();
  const user = useUserStore((state) => state.user);

  const scopedTrips = useMemo<Trip[]>(() => {
    const trips = queryResult.data ?? [];
    if (!user) {
      return trips;
    }
    if (user.role === 'super_admin') {
      return trips;
    }
    return trips.filter((trip) => trip.manager === user.id);
  }, [queryResult.data, user]);

  const isSuperAdmin = user?.role === 'super_admin';

  return {
    ...queryResult,
    data: scopedTrips,
    scopedTrips,
    rawTrips: queryResult.data ?? [],
    isSuperAdmin: Boolean(isSuperAdmin),
    userRole: user?.role,
    currentUserId: user?.id,
  };
};
