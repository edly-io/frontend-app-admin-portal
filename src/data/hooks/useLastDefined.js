import { useRef } from 'react';

/**
 * The most recent non-undefined `value`, falling back to `initial`.
 *
 * The list pages only ever replaced their rows on success, so a page or
 * filter change that failed kept the last good rows on screen underneath the
 * alert. React Query drops `placeholderData` the moment a query errors
 * (it is gated on `status === 'pending'`), so that last good value is held
 * here instead.
 */
export const useLastDefined = (value, initial) => {
  const ref = useRef(initial);
  if (value !== undefined) { ref.current = value; }
  return ref.current;
};

export default useLastDefined;
