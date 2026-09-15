import { useMutation } from '@tanstack/react-query';

import { updateEnrollments } from '../api';

/** Bulk enroll/unenroll. Nothing cached reflects the result. */
export const useUpdateEnrollments = () => useMutation({
  mutationFn: ({ action, payload }) => updateEnrollments(action, payload),
});

export default useUpdateEnrollments;
