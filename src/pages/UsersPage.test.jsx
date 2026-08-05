import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor, within,
} from '../test-utils';

import UsersPage from './UsersPage';
import { getUsers, setUserActive } from '../data/api';

jest.mock('../data/api', () => ({
  getUsers: jest.fn(),
  setUserActive: jest.fn(),
}));

const USERS = {
  count: 2,
  results: [
    {
      id: 1, username: 'alice', name: 'Alice A', email: 'alice@e.com', is_active: true, status: 'active',
    },
    {
      id: 2, username: 'bob', name: 'Bob B', email: 'bob@e.com', is_active: false, status: 'disabled',
    },
  ],
};

const renderPage = () => renderWithProviders(<UsersPage />);

beforeEach(() => {
  jest.clearAllMocks();
  getUsers.mockResolvedValue(USERS);
  setUserActive.mockResolvedValue({});
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
  });

  it('passes the search term to the API', async () => {
    renderPage();
    await screen.findByText('alice');
    fireEvent.change(screen.getByPlaceholderText('name, username or email'), { target: { value: 'ali' } });
    await waitFor(() => expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'ali' })));
  });

  it('passes the status filter to the API', async () => {
    renderPage();
    await screen.findByText('alice');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'disabled' } });
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
});
