import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

/** Base URL of the admin-portal REST API (served by the LMS plugin). */
export const apiBaseUrl = () => `${getConfig().LMS_BASE_URL}/admin-portal/api/v1`;

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

/** Create a single learner/staff account. `payload`: { username, email, name }. */
export async function createUser(payload) {
  const { data } = await client().post(`${apiBaseUrl()}/users/`, payload);
  return data;
}

/** Deactivate (active=false) or reactivate (active=true) a user by username. */
export async function setUserActive(username, active) {
  const action = active ? 'reactivate' : 'deactivate';
  const { data } = await client().post(
    `${apiBaseUrl()}/users/${encodeURIComponent(username)}/${action}/`,
  );
  return data;
}

/**
 * Enroll or unenroll identifiers in a course run.
 * `action`: 'enroll' | 'unenroll'.
 * `payload`: { course_id, identifiers: [], email_students, auto_enroll, reason }.
 */
export async function updateEnrollments(action, payload) {
  const { data } = await client().post(`${apiBaseUrl()}/enrollments/${action}/`, payload);
  return data;
}

/** Catalog of grantable course-scoped roles with descriptions. */
export async function getRoles() {
  const { data } = await client().get(`${apiBaseUrl()}/roles/`);
  return data;
}

/** Grant/revoke a course role. `payload`: { course_id, identifier, role, action }. */
export async function changeRole(payload) {
  const { data } = await client().post(`${apiBaseUrl()}/roles/`, payload);
  return data;
}
