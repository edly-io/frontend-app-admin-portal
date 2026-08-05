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

  it('shows a neutral 404 (not the portal) on a 403 from me', async () => {
    getMe.mockRejectedValue({ response: { status: 403 } });
    renderApp();
    expect(await screen.findByText('404')).toBeInTheDocument();
    // The portal must not be discoverable: no nav, no group hint.
    expect(screen.queryByText('Enrollment')).not.toBeInTheDocument();
    expect(screen.queryByText(/edl_admin/i)).not.toBeInTheDocument();
  });

  it('fails closed on a non-403 error (e.g. 404/network) instead of showing the portal', async () => {
    getMe.mockRejectedValue({ response: { status: 404 } });
    renderApp();
    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.queryByText('Enrollment')).not.toBeInTheDocument();
  });
});
