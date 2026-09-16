import { useRef } from 'react';
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
 * neither: it re-pulls the trend charts with no loader of its own.
 */
export const useReportingDashboard = (months) => {
  // Refresh sends force_refresh=1 WITHOUT changing the query key: it asks for
  // the same data, just recomputed upstream. So the flag is read from a ref
  // inside each queryFn at call time. `meta` cannot do this, since it is read
  // from the last COMMITTED options and would send the previous value.
  const forceRef = useRef(false);
  const withForce = (params) => (forceRef.current ? { ...params, force_refresh: 1 } : params);

  const summary = useQuery({
    queryKey: keys.reporting.summary(),
    queryFn: () => getReportingSummary(withForce({})),
  });
  const trends = useQuery({
    queryKey: keys.reporting.trends(months),
    queryFn: () => getReportingTrends(withForce({ months })),
    // Without this, changing the trend window is a new cache entry with no
    // data, which would flip the page back to the full-page spinner.
    placeholderData: keepPreviousData,
  });
  const breakdowns = useQuery({
    queryKey: keys.reporting.breakdowns(),
    queryFn: () => getReportingBreakdowns(withForce({})),
  });

  const queries = [summary, trends, breakdowns];

  // Only trends needs this. Its key changes with the window, and React Query
  // drops placeholderData the moment a query errors, so a failed window change
  // would blank the charts and take `hasAllData` down with them. summary and
  // breakdowns keep their last value across a failed refetch on their own.
  const trendsData = useLastDefined(trends.data, undefined);

  const refresh = () => {
    // refetch() runs each queryFn synchronously, so all three have read the
    // flag by the time the map returns and it is safe to clear right here.
    forceRef.current = true;
    const promises = queries.map((q) => q.refetch());
    forceRef.current = false;
    return Promise.all(promises);
  };

  return {
    summary: summary.data,
    trends: trendsData,
    breakdowns: breakdowns.data,
    isLoading: queries.some((q) => q.isPending),
    // Derived from the two queries Refresh owns and a trend-window change
    // never touches. Watching all three would flag a window change as a
    // refresh. Holding it in state instead wedges it on for good, because a
    // window change abandons the in-flight trends refetch, so the promise
    // that would have cleared the flag never settles.
    isRefreshing: summary.isFetching || breakdowns.isFetching,
    // Mirrors the Promise.all this replaced: partial data was never shown, so
    // a first load that loses any leg still replaces the page with the alert.
    hasAllData: [summary.data, trendsData, breakdowns.data].every((d) => d !== undefined),
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
