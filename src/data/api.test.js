import {
  apiBaseUrl, resendInvite, getOrganizations, getOrgAccess, setOrgAccess,
} from './api';

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
    post: (...args) => mockPost(...args),
  }),
}));

describe('admin-portal api client', () => {
  it('composes the API base URL from LMS_BASE_URL', () => {
    expect(apiBaseUrl()).toBe('http://lms.test/admin-portal/api/v1');
  });

  it('posts to the resend-invite endpoint with an encoded username', async () => {
    mockPost.mockResolvedValue({ data: { username: 'a b', invite_sent_at: '2026-01-01T00:00:00Z' } });
    const data = await resendInvite('a b');
    expect(mockPost).toHaveBeenCalledWith('http://lms.test/admin-portal/api/v1/users/a%20b/resend-invite/');
    expect(data.username).toBe('a b');
  });
});

it('calls organization access endpoints with encoded usernames', async () => {
  mockGet.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
  await getOrganizations();
  await getOrgAccess('a b');
  await setOrgAccess('a b', { visibility: true });
  expect(mockGet).toHaveBeenCalledWith('http://lms.test/admin-portal/api/v1/organizations/');
  expect(mockGet).toHaveBeenCalledWith('http://lms.test/admin-portal/api/v1/users/a%20b/org-access/');
  expect(mockPut).toHaveBeenCalledWith('http://lms.test/admin-portal/api/v1/users/a%20b/org-access/', { visibility: true });
});
