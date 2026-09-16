import { useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getCourseReports, getReportingBreakdowns, getReportingSummary, getReportingTrends,
} from '../api';
import { EMPTY_PAGE } from './emptyPage';
import { keys } from './keys';
import { useLastDefined } from './useLastDefined';

/**
 * The three dashboard endpoints, plus the two-tier loading state the page has
 * always had: a full-page spinner until everything has arrived once, and a
 * soft "refreshing" state for a Refresh after that. A trend-window change is
 * neither — it re-pulls the trend charts with no loader of its own.
 */
export const useReportingDashboard = (months) => {
  // Owned by refresh() rather than derived from `isFetching` across the three
  // queries: picking a different trend window refetches trends alone and was
  // never a "refresh" (it has no loader of its own), so a derived flag would
  // disable the Refresh button and blank the KPI cards for a fetch nobody
  // asked for.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh has to send force_refresh=1 WITHOUT changing the query key — it
  // asks for the same data, just recomputed upstream. So the flag is read
  // from a ref inside each queryFn at call time. `meta` cannot do this: it is
  // read from the last COMMITTED options, so setting it and refetching in one
  // handler would send the previous value.
  //
  // The ref holds the trend window the refresh started with, not a boolean:
  // picking a new window mid-refresh creates a FOURTH query whose queryFn
  // would otherwise inherit the flag, and a window change never bypassed the
  // backend cache before.
  const forceRef = useRef(null);
  const withForce = (params) => (forceRef.current !== null ? { ...params, force_refresh: 1 } : params);
  const withForceForMonths = (params) => (
    forceRef.current === params.months ? { ...params, force_refresh: 1 } : params
  );

  const summary = useQuery({
    queryKey: keys.reporting.summary(),
    queryFn: () => getReportingSummary(withForce({})),
  });
  const trends = useQuery({
    queryKey: keys.reporting.trends(months),
    queryFn: () => getReportingTrends(withForceForMonths({ months })),
    // Without this, changing the trend window is a new cache entry with no
    // data, which would flip the page back to the full-page spinner.
    placeholderData: keepPreviousData,
  });
  const breakdowns = useQuery({
    queryKey: keys.reporting.breakdowns(),
    queryFn: () => getReportingBreakdowns(withForce({})),
  });

  const queries = [summary, trends, breakdowns];
  const isLoading = queries.some((q) => q.isPending);

  // A window change is a new cache entry, and React Query drops
  // placeholderData the moment a query errors, so the last good value is held
  // here. The Promise.all this replaced left already-loaded data untouched on
  // failure, which is what keeps a failed soft reload from blanking the page.
  const summaryData = useLastDefined(summary.data, undefined);
  const trendsData = useLastDefined(trends.data, undefined);
  const breakdownsData = useLastDefined(breakdowns.data, undefined);

  const refresh = () => {
    setIsRefreshing(true);
    forceRef.current = months;
    // react-query calls each queryFn synchronously inside refetch(), before
    // refetch() itself returns — so by the time `.map()` below is done, all
    // three queryFns have already read the flag. Clearing it right here
    // (instead of in `.finally()`, after the requests settle) closes the
    // window where an unrelated fetch — e.g. a trend-window change made
    // while this refresh is still in flight — could pick up force_refresh
    // for a request that was never part of this refresh.
    const promises = queries.map((q) => q.refetch());
    forceRef.current = null;
    return Promise.all(promises).finally(() => setIsRefreshing(false));
  };

  return {
    summary: summaryData,
    trends: trendsData,
    breakdowns: breakdownsData,
    isLoading,
    isRefreshing,
    // Mirrors the Promise.all this replaced: partial data was never shown, so
    // a first load that loses any leg still replaces the page with the alert.
    hasAllData: [summaryData, trendsData, breakdownsData].every((d) => d !== undefined),
    error: queries.find((q) => q.isError)?.error ?? null,
    refresh,
  };
};

/** One page of the annotated course-run list. `enabled` is the debounce gate. */
export const useCourseReports = ({ search, page, enabled }) => {
  const query = useQuery({
    queryKey: keys.reporting.courses({ search, page }),
    queryFn: () => getCourseReports({ page, ...(search ? { search } : {}) }),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    data: useLastDefined(query.data, EMPTY_PAGE),
    isPending: query.isPending,
    // A page or search change refetches under the rows already on screen
    // (keepPreviousData), so the caller flags it beside the filters instead of
    // replacing the table with the full-page spinner.
    isRefetching: query.isRefetching,
    error: query.error,
    errorUpdatedAt: query.errorUpdatedAt,
  };
};
