import { useState } from 'react';

/**
 * Tracks a single dismissible error banner for one read: `error` clears when
 * dismissed and reappears only once a newer failure (a later `errorUpdatedAt`)
 * lands, so a background refetch failing again after dismissal still surfaces.
 *
 * Accepts either a React Query result or a plain `{ error, errorUpdatedAt }`
 * shape, so callers that already destructure those two fields out of a hook
 * (rather than passing the query object itself) can use it too.
 */
export const useDismissibleQueryError = ({ error, errorUpdatedAt }) => {
  const [dismissedAt, setDismissedAt] = useState(0);
  const visibleError = error && errorUpdatedAt > dismissedAt ? error : null;
  return {
    error: visibleError,
    errorUpdatedAt,
    dismiss: () => setDismissedAt(errorUpdatedAt),
  };
};

export default useDismissibleQueryError;
