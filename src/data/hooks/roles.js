import { useMutation, useQuery } from '@tanstack/react-query';

import { changeRole, getRoles } from '../api';
import { keys } from './keys';

/** Catalog of grantable course-scoped roles. Static for the session. */
export const useRoles = () => useQuery({
  queryKey: keys.roles(),
  queryFn: () => getRoles(),
});

/** Grant/revoke one course role. Nothing cached reflects the result. */
export const useChangeRole = () => useMutation({
  mutationFn: (payload) => changeRole(payload),
});
