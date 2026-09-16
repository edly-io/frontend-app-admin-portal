import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { createUser, getUsers, setUserActive } from '../api';
import { EMPTY_PAGE } from './emptyPage';
import { keys } from './keys';
import { useLastDefined } from './useLastDefined';

/**
 * One page of the user directory.
 *
 * `enabled` is the caller's debounce gate: `page` and `status` are not
 * debounced, so without it a filter change mid-typing would fire a request
 * carrying the previous search term.
 */
export const useUsers = ({
  search, status, page, pageSize, enabled,
}) => {
  const query = useQuery({
    queryKey: keys.users.list({
      search, status, page, pageSize,
    }),
    queryFn: () => getUsers({
      page,
      page_size: pageSize,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    }),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    data: useLastDefined(query.data, EMPTY_PAGE),
    isPending: query.isPending,
    // A page or filter change refetches under the rows already on screen
    // (keepPreviousData), so the caller flags it beside the filters instead of
    // replacing the table with the full-page spinner.
    isRefetching: query.isRefetching,
    error: query.error,
    // Timestamps, so the caller can tell which of a failed read and a failed
    // write happened last, and whether a successful read has landed since.
    errorUpdatedAt: query.errorUpdatedAt,
    dataUpdatedAt: query.dataUpdatedAt,
  };
};

/** Deactivate/reactivate one account, then refresh the directory. */
export const useSetUserActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, activate }) => setUserActive(username, activate),
    // Deliberately NOT returned: the old code fired its refetch without
    // awaiting it, so the confirmation modal closed as soon as the write
    // landed rather than waiting for the table to come back.
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: keys.users.all }); },
  });
};

/** Create one account. The directory it lands in is cached, so invalidate it. */
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createUser(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: keys.users.all }); },
  });
};
