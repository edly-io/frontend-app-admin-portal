import { useEffect } from 'react';

const DEFAULT_DELAY_MS = 300;

/**
 * useEffect, but `effect` fires `delay`ms after the deps settle instead of
 * immediately — a pending run is cancelled if the deps change again first.
 * Like useEffect, `effect` may return a cleanup function; it runs before the
 * next debounced call and on unmount.
 */
const useDebouncedEffect = (effect, deps, delay = DEFAULT_DELAY_MS) => {
  useEffect(() => {
    let cleanup;
    const handle = setTimeout(() => { cleanup = effect(); }, delay);
    return () => {
      clearTimeout(handle);
      if (typeof cleanup === 'function') { cleanup(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export default useDebouncedEffect;
