import { useEffect, useState } from 'react';

/** `value`, but only after it has stopped changing for `delayMs`. */
export const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
};

export default useDebouncedValue;
