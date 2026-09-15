import { useQuery } from '@tanstack/react-query';

import { getMe } from '../api';
import { keys } from './keys';

/**
 * The admin gate. Resolved once per session and then frozen.
 *
 * The portal replaces itself with a neutral 404 on ANY error from this call,
 * so a background refetch that caught one transient 5xx would tear down a
 * working session mid-use. `staleTime`/`gcTime: Infinity` plus the disabled
 * refetch triggers reproduce the old one-shot `useEffect`.
 */
export const useMe = () => useQuery({
  queryKey: keys.me(),
  queryFn: () => getMe(),
  retry: false,
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

export default useMe;
