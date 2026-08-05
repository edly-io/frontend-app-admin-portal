import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import RolesPage from './RolesPage';
import { getRoles, changeRole } from '../data/api';

jest.mock('../data/api', () => ({ getRoles: jest.fn(), changeRole: jest.fn() }));

const ROLES = {
  roles: [
    { role: 'instructor', description: 'Course Admin — full control.' },
    { role: 'staff', description: 'Course Staff — manage content.' },
    { role: 'limited_staff', description: 'Limited Staff — LMS only.' },
  ],
};

const renderPage = () => renderWithProviders(<RolesPage />);

beforeEach(() => {
  jest.clearAllMocks();
  getRoles.mockResolvedValue(ROLES);
  changeRole.mockResolvedValue({ username: 'bob', role: 'instructor', action: 'allow' });
});

describe('RolesPage', () => {
  it('renders the grantable-role catalog with descriptions', async () => {
    renderPage();
    // Descriptions unique to non-selected roles (the selected role's description
    // also renders in the form's help text).
    expect(await screen.findByText(/manage content\./)).toBeInTheDocument();
    expect(screen.getByText(/LMS only\./)).toBeInTheDocument();
  });

  it('grants a role and confirms success', async () => {
    renderPage();
    await screen.findByText('Course Admin — full control.');
    fireEvent.change(screen.getByLabelText('Course run ID'), { target: { value: 'course-v1:Org+Course+Run' } });
    fireEvent.change(screen.getByLabelText('User (email or username)'), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(changeRole).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'bob', role: 'instructor', action: 'allow',
    })));
    expect(await screen.findByText(/Granted .*instructor.* for bob/)).toBeInTheDocument();
  });
});
