import React from 'react';
import { renderWithProviders, screen } from './test-utils';

import App from './App';
import { getMe, getUsers } from './data/api';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ SITE_NAME: 'EDL Panel', LOGOUT_URL: '/logout' }),
}));
jest.mock('@edx/frontend-platform/react', () => ({
  // eslint-disable-next-line global-require
  AppContext: require('react').createContext({ authenticatedUser: { username: 'admin' } }),
}));
jest.mock('./data/api', () => ({
  getMe: jest.fn(),
  getUsers: jest.fn(),
  setUserActive: jest.fn(),
}));

const renderApp = () => renderWithProviders(<App />);

beforeEach(() => {
  jest.clearAllMocks();
  getUsers.mockResolvedValue({ count: 0, results: [] });
});

describe('App gate (EDL-12)', () => {
  it('renders the panel nav for an EDL admin', async () => {
    getMe.mockResolvedValue({ username: 'admin', is_edl_admin: true });
    renderApp();
    expect(await screen.findByText('Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Staff & roles')).toBeInTheDocument();
  });

  it('shows Access denied on a 403 from me', async () => {
    getMe.mockRejectedValue({ response: { status: 403 } });
    renderApp();
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });
});
