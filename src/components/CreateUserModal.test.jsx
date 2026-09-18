import React from 'react';
import {
  renderWithProviders, screen, fireEvent, act,
} from '../test-utils';

import CreateUserModal from './CreateUserModal';
import { createUser } from '../data/api';

jest.mock('../data/api', () => ({ createUser: jest.fn() }));

const renderModal = (props = {}) => renderWithProviders(
  <CreateUserModal isOpen onClose={() => {}} {...props} />,
);

const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'learner1' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'learner1@e.com' } });
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Learner One' } });
};

beforeEach(() => jest.clearAllMocks());

describe('CreateUserModal', () => {
  it('submits and shows the set-password-link result (link mode)', async () => {
    createUser.mockResolvedValue({ username: 'learner1', email: 'learner1@e.com', status: 'pending' });
    renderModal();
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
    renderModal();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('GenPw123456!')).toBeInTheDocument();
  });

  it('renders a duplicate-username error inline (409)', async () => {
    createUser.mockRejectedValue({ response: { status: 409, data: { username: ['An account with this username already exists.'] } } });
    renderModal();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('An account with this username already exists.')).toBeInTheDocument();
  });

  it('reports the new account to its parent so the directory can refresh', async () => {
    const created = { username: 'learner1', email: 'learner1@e.com', status: 'pending' };
    createUser.mockResolvedValue(created);
    const onCreated = jest.fn();
    renderModal({ onCreated });
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('learner1 created')).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('does not carry a mid-request result into the next open', async () => {
    let resolveCreate;
    createUser.mockImplementation(() => new Promise((res) => { resolveCreate = res; }));
    const created = { username: 'learner1', email: 'learner1@e.com', status: 'pending' };
    const onCreated = jest.fn();

    renderModal({ onCreated });
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    // The admin closes the dialog before the request lands.
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await act(async () => { resolveCreate(created); });

    // The account exists, so the directory is still told about it.
    expect(onCreated).toHaveBeenCalledWith(created);

    // The reset form is what the next open shows: no stale success panel.
    expect(screen.queryByText('learner1 created')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('');
  });
});
