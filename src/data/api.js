import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

/** Base URL of the edl-panel REST API (served by the LMS plugin). */
export const apiBaseUrl = () => `${getConfig().LMS_BASE_URL}/edl-panel/api/v1`;

const client = () => getAuthenticatedHttpClient();

/** Identity of the current admin; also confirms the caller passed the gate. */
export async function getMe() {
  const { data } = await client().get(`${apiBaseUrl()}/me/`);
  return data;
}

/** Paginated user directory. `params`: { search, status, page, page_size }. */
export async function getUsers(params = {}) {
  const { data } = await client().get(`${apiBaseUrl()}/users/`, { params });
  return data;
}
