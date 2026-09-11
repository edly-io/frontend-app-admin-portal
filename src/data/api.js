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

/* ---- Reporting ---- */

/** KPI row: learners, registrations (MoM + delta), courses, active enrollments. `params`: { force_refresh }. */
export async function getReportingSummary(params = {}) {
  const { data } = await client().get(`${apiBaseUrl()}/reporting/summary/`, { params });
  return data;
}

/** Monthly trend series. `params`: { months, force_refresh }. */
export async function getReportingTrends(params = {}) {
  const { data } = await client().get(`${apiBaseUrl()}/reporting/trends/`, { params });
  return data;
}

/** Non-time-series breakdowns (lean cut: course lifecycle). `params`: { force_refresh }. */
export async function getReportingBreakdowns(params = {}) {
  const { data } = await client().get(`${apiBaseUrl()}/reporting/breakdowns/`, { params });
  return data;
}

/** Paginated, annotated course-run list. `params`: { search, ordering, page }. */
export async function getCourseReports(params = {}) {
  const { data } = await client().get(`${apiBaseUrl()}/reporting/courses/`, { params });
  return data;
}

const courseReportsBase = (courseId) => `${apiBaseUrl()}/reporting/courses/${encodeURIComponent(courseId)}/reports`;

/** Queue an async report export for a course. Returns { task_id, report_type }. */
export async function triggerCourseReport(courseId, reportType) {
  const { data } = await client().post(`${courseReportsBase(courseId)}/trigger/`, { report_type: reportType });
  return data;
}

/** Recent report tasks (all types) for a course with fresh download URLs. */
export async function getCourseReportDownloads(courseId) {
  const { data } = await client().get(`${courseReportsBase(courseId)}/downloads/`);
  return data;
}

/** Issued certificates for a course. */
export async function getCourseCertificates(courseId) {
  const { data } = await client().get(`${courseReportsBase(courseId)}/certificates/`);
  return data;
}
