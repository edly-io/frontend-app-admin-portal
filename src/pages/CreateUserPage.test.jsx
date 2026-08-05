import React from 'react';
import { renderWithProviders, screen, fireEvent } from '../test-utils';

import CreateUserPage from './CreateUserPage';
import { createUser } from '../data/api';

jest.mock('../data/api', () => ({ createUser: jest.fn() }));

const renderPage = () => renderWithProviders(<CreateUserPage />);

const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'learner1' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'learner1@e.com' } });
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Learner One' } });
};

beforeEach(() => jest.clearAllMocks());

describe('CreateUserPage', () => {
  it('submits and shows the set-password-link result (link mode)', async () => {
    createUser.mockResolvedValue({ username: 'learner1', email: 'learner1@e.com', status: 'pending' });
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText('learner1 created')).toBeInTheDocument();
    expect(screen.getByText(/set-password link has been emailed/i)).toBeInTheDocument();
    expect(createUser).toHaveBeenCalledWith({ username: 'learner1', email: 'learner1@e.com', name: 'Learner One' });
  });

  it('shows a one-time password in copy mode', async () => {
    createUser.mockResolvedValue({
      username: 'learner1', email: 'learner1@e.com', status: 'active', password: 'GenPw123456!',
    });
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('GenPw123456!')).toBeInTheDocument();
  });

  it('renders a duplicate-username error inline (409)', async () => {
    createUser.mockRejectedValue({ response: { status: 409, data: { username: ['An account with this username already exists.'] } } });
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('An account with this username already exists.')).toBeInTheDocument();
  });
});
