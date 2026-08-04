import { apiBaseUrl } from './api';

jest.mock('@openedx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@openedx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ get: jest.fn() }),
}));

describe('edl-panel api client', () => {
  it('composes the API base URL from LMS_BASE_URL', () => {
    expect(apiBaseUrl()).toBe('http://lms.test/edl-panel/api/v1');
  });
});
