import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor, within,
} from '../test-utils';

import UsersPage from './UsersPage';
import { getUsers, resendInvite, setUserActive } from '../data/api';

jest.mock('../data/api', () => ({
  getUsers: jest.fn(),
  setUserActive: jest.fn(),
  resendInvite: jest.fn(),
}));

const USERS = {
  count: 2,
  results: [
    {
      id: 1, username: 'alice', name: 'Alice A', email: 'alice@e.com', is_active: true, status: 'active', lms_role: 'learner', enrollment_count: 3, date_joined: '2026-03-05T12:00:00Z', invite_expires_at: null, invite_expired: false,
    },
    {
      id: 2, username: 'bob', name: 'Bob B', email: 'bob@e.com', is_active: false, status: 'disabled', lms_role: 'staff', enrollment_count: null, date_joined: '2026-03-06T12:00:00Z', invite_expires_at: null, invite_expired: false,
    },
  ],
};

const renderPage = () => renderWithProviders(<UsersPage />);

beforeEach(() => {
  jest.clearAllMocks();
  getUsers.mockResolvedValue(USERS);
  setUserActive.mockResolvedValue({});
  resendInvite.mockResolvedValue({});
});

describe('UsersPage', () => {
  it('lists users returned by the API', async () => {
    renderPage();
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    // 'Active'/'Disabled' also appear as filter options, so scope to the table.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(within(table).getByText('Disabled')).toBeInTheDocument();
    // LMS Role column: header + per-row values.
    expect(within(table).getByText('LMS role')).toBeInTheDocument();
    expect(within(table).getByText('Learner')).toBeInTheDocument();
    expect(within(table).getByText('Staff')).toBeInTheDocument();
  });

  it('shows the enrollment count, or a dash when the backend could not compute it', async () => {
    renderPage();
    await screen.findByText('alice');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Enrollments')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
    // bob's null enrollment count renders as a dash.
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('passes the search term to the API', async () => {
    renderPage();
    await screen.findByText('alice');
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'ali' } });
    await waitFor(() => expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'ali' })));
  });

  it('passes the status filter to the API', async () => {
    renderPage();
    await screen.findByText('alice');
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'disabled' } });
    await waitFor(() => expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'disabled' })));
  });

  it('deactivates an active user after confirmation', async () => {
    renderPage();
    await screen.findByText('alice');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    // Modal opens
    expect(await screen.findByText('Deactivate alice?')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Deactivate' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(setUserActive).toHaveBeenCalledWith('alice', false));
  });

  it('offers reactivate for a disabled user', async () => {
    renderPage();
    await screen.findByText('bob');
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  describe('pending users and invite resend', () => {
    const PENDING = {
      count: 2,
      results: [
        {
          id: 3, username: 'carol', name: 'Carol C', email: 'carol@e.com', is_active: false, status: 'pending', lms_role: 'learner', enrollment_count: 0, date_joined: '2026-03-01T12:00:00Z', invite_expires_at: '2026-03-09T12:00:00Z', invite_expired: true,
        },
        {
          id: 4, username: 'dave', name: 'Dave D', email: 'dave@e.com', is_active: false, status: 'pending', lms_role: 'learner', enrollment_count: 0, date_joined: '2026-03-01T12:00:00Z', invite_expires_at: '2026-03-09T12:00:00Z', invite_expired: false,
        },
      ],
    };

    it('shows the resend button only when the invite has expired', async () => {
      getUsers.mockResolvedValue(PENDING);
      renderPage();
      await screen.findByText('carol');
      expect(screen.getAllByRole('button', { name: 'Resend Invitation' })).toHaveLength(1);
    });

    it('labels an expired pending user as Invitation expired', async () => {
      getUsers.mockResolvedValue(PENDING);
      renderPage();
      await screen.findByText('carol');
      expect(screen.getAllByText('Invitation expired')).toHaveLength(1);
      expect(screen.getAllByText('Pending invitation').length).toBeGreaterThan(0);
    });

    it('says Expires while the invite is still valid', async () => {
      getUsers.mockResolvedValue({ count: 1, results: [PENDING.results[1]] });
      renderPage();
      await screen.findByText('dave');
      expect(screen.getByText('Expires 03/09/2026')).toBeInTheDocument();
    });

    it('does not show the resend button for active or disabled users', async () => {
      renderPage();
      await screen.findByText('alice');
      expect(screen.queryByRole('button', { name: 'Resend Invitation' })).not.toBeInTheDocument();
    });

    it('resends after confirmation and shows the toast', async () => {
      getUsers.mockResolvedValue(PENDING);
      renderPage();
      await screen.findByText('carol');
      fireEvent.click(screen.getByRole('button', { name: 'Resend Invitation' }));
      expect(await screen.findByText('Resend carol?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
      await waitFor(() => expect(resendInvite).toHaveBeenCalledWith('carol'));
      expect(await screen.findByText('Invitation resent to carol@e.com.')).toBeInTheDocument();
      await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(2));
    });

    it('shows the expiry date under the status of pending users only', async () => {
      getUsers.mockResolvedValue({ count: 2, results: [PENDING.results[0], USERS.results[0]] });
      renderPage();
      await screen.findByText('carol');
      const table = screen.getByRole('table');
      expect(within(table).getByText('Created')).toBeInTheDocument();
      expect(within(table).getByText('Expired 03/09/2026')).toBeInTheDocument();
      expect(within(table).queryByText(/Expires/)).not.toBeInTheDocument();
      expect(within(table).getByText('03/05/2026')).toBeInTheDocument();
    });
  });
});
