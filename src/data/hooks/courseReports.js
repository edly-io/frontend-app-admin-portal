import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCourseCertificates, getCourseReportDownloads, triggerCourseReport,
} from '../api';
import { keys } from './keys';

const RUNNING_STATES = new Set(['QUEUING', 'IN_PROGRESS']);

// Hoisted so React Query can memoise on identity; an inline arrow would
// re-run select (and hand DataTable a new array) on every render.
const selectResults = (data) => data.results || [];

// `query.state.data` is the RAW cached value — `select` runs downstream of it.
const pollWhileRunning = (query) => (
  (query.state.data?.results || []).some((row) => RUNNING_STATES.has(row.state)) ? 10000 : false
);

/** Recent report tasks for a course; polls itself while any task is running. */
export const useCourseReportDownloads = (courseId) => useQuery({
  queryKey: keys.courseReports.downloads(courseId),
  queryFn: () => getCourseReportDownloads(courseId),
  select: selectResults,
  refetchInterval: pollWhileRunning,
  // The setInterval this replaces kept polling in a background tab; React
  // Query would otherwise skip ticks while the tab is hidden.
  refetchIntervalInBackground: true,
});

/** Issued certificates for a course. */
export const useCourseCertificates = (courseId) => useQuery({
  queryKey: keys.courseReports.certificates(courseId),
  queryFn: () => getCourseCertificates(courseId),
  select: selectResults,
});

/**
 * Queue a report export. `onQueued` fires before the tables are invalidated,
 * matching the old order (toast first, then refetch).
 */
export const useTriggerCourseReport = (courseId, { onQueued } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    // Wrapped, not passed by reference: v5 calls mutationFn(variables, ctx),
    // and the API function's second parameter is the report type.
    mutationFn: ({ slug }) => triggerCourseReport(courseId, slug),
    onSuccess: (data, variables) => {
      onQueued?.(variables);
      // Returned, so isPending stays true until both tables are fresh —
      // the old handler awaited its refetch before re-enabling the menu.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.courseReports.downloads(courseId) }),
        queryClient.invalidateQueries({ queryKey: keys.courseReports.certificates(courseId) }),
      ]);
    },
  });
};
