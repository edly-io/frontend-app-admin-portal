import { apiBaseUrl, resendInvite } from './api';

const mockPost = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ get: jest.fn(), post: (...args) => mockPost(...args) }),
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
