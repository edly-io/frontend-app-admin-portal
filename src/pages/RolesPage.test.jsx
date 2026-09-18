import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import RolesPage from './RolesPage';
import { getRoles, changeRole, getCourseReports } from '../data/api';

jest.mock('../data/api', () => ({
  getRoles: jest.fn(), changeRole: jest.fn(), getCourseReports: jest.fn(),
}));

const ROLES = {
  roles: [
    { role: 'instructor', description: 'Course Admin. Full control.' },
    { role: 'staff', description: 'Course Staff. Manage content.' },
    { role: 'limited_staff', description: 'Limited Staff. LMS only.' },
  ],
};

const renderPage = () => renderWithProviders(<RolesPage />);

beforeEach(() => {
  jest.clearAllMocks();
  getRoles.mockResolvedValue(ROLES);
  getCourseReports.mockResolvedValue({ results: [] });
  changeRole.mockResolvedValue({ username: 'bob', role: 'instructor', action: 'allow' });
});

describe('RolesPage', () => {
  it('renders the grantable-role catalog with descriptions', async () => {
    renderPage();
    expect(await screen.findByText(/Manage content\./)).toBeInTheDocument();
    expect(screen.getByText(/LMS only\./)).toBeInTheDocument();
    // The backend prefixes limited_staff's description with the same words we
    // already use as its label; the row must not read "Limited Staff: Limited
    // Staff. LMS only."
    expect(screen.queryByText(/Limited Staff\. LMS only\./)).not.toBeInTheDocument();
  });

  it('grants a role and confirms success', async () => {
    renderPage();
    await screen.findByText(/Full control\./);
    fireEvent.change(screen.getByLabelText('Course run ID'), { target: { value: 'course-v1:Org+Course+Run' } });
    fireEvent.change(screen.getByLabelText('User (email or username)'), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(changeRole).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'bob', role: 'instructor', action: 'allow',
    })));
    expect(await screen.findByText(/Granted .*instructor.* for bob/)).toBeInTheDocument();
  });
});
