import { QueryClient } from '@tanstack/react-query';

/**
 * The single QueryClient factory for both the app and the test harness.
 *
 * Every default here exists to reproduce what the hand-rolled `useEffect`
 * fetching did, rather than to adopt React Query's own opinions:
 *
 *  - `retry: false` — the portal fails fast. Each page renders its alert on
 *    the first rejection, so retrying would only delay it (and would push the
 *    fail-closed admin gate past its budget).
 *  - `refetchOnWindowFocus` / `refetchOnReconnect` — the old code fetched on
 *    mount and on explicit user action only. Both default to refetching.
 *  - `networkMode: 'always'` — the default 'online' PAUSES a fetch while the
 *    browser reports itself offline, which would leave a spinner up forever
 *    where the old code surfaced the request failure.
 */
export const createQueryClient = (queryOverrides = {}) => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: 'always',
      ...queryOverrides,
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});

export default createQueryClient;
