import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';
import OrgAccessModal from './OrgAccessModal';
import { getOrganizations, getOrgAccess, setOrgAccess } from '../data/api';

jest.mock('../data/api', () => ({
  getOrganizations: jest.fn(), getOrgAccess: jest.fn(), setOrgAccess: jest.fn(),
}));
const base = {
  username: 'alice',
  editable: true,
  org_admin: false,
  organizations: [],
  visibility: false,
  global_creator: false,
  partial_visibility_orgs: [],
};
const user = { username: 'alice', name: 'Alice', email: 'alice@e.com' };
const ADMIN = 'Enabling this will allow the user to create re-runs.';
const VISIBILITY = 'Enabling this will allow the user to see and manage all courses in the selected orgs.';
const renderModal = (onSaved = jest.fn()) => renderWithProviders(
  <OrgAccessModal isOpen user={user} onClose={jest.fn()} onSaved={onSaved} />,
);
const pick = (name) => {
  fireEvent.focus(screen.getByRole('combobox', { name: 'Search organizations' }));
  fireEvent.click(screen.getByRole('option', { name }));
};
beforeEach(() => {
  jest.clearAllMocks();
  getOrgAccess.mockResolvedValue(base);
  getOrganizations.mockResolvedValue({ results: [{ short_name: 'OrgA', name: 'Org A' }, { short_name: 'OrgB', name: 'Org B' }] });
  setOrgAccess.mockResolvedValue(base);
});
it('loads access, enables visibility on the first selection and saves', async () => {
  const onSaved = jest.fn();
  renderModal(onSaved);
  expect(screen.getByText('Loading access')).toBeInTheDocument();
  const admin = await screen.findByRole('switch', { name: ADMIN });
  expect(screen.getByRole('switch', { name: VISIBILITY })).toBeDisabled();
  fireEvent.click(admin);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  pick('OrgA (Org A)');
  expect(screen.getByRole('switch', { name: VISIBILITY })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(setOrgAccess).toHaveBeenCalledWith('alice', {
    org_admin: true, organizations: ['OrgA'], visibility: true, confirm_downgrade: false,
  }));
  expect(onSaved).toHaveBeenCalledWith(user);
});
it('shows the saved organizations as chips, searches and removes', async () => {
  getOrgAccess.mockResolvedValue({
    ...base, org_admin: true, organizations: ['OrgA', 'OrgB'], visibility: true,
  });
  renderModal();
  expect(await screen.findByLabelText('Remove OrgA')).toBeInTheDocument();
  expect(screen.getByLabelText('Remove OrgB')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Remove OrgB'));
  expect(screen.queryByLabelText('Remove OrgB')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Remove OrgA')).toBeInTheDocument();
  const search = screen.getByRole('combobox', { name: 'Search organizations' });
  fireEvent.focus(search);
  expect(screen.queryByRole('option', { name: 'OrgA (Org A)' })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(screen.getByText('No organizations match your search.')).toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'org b' } });
  expect(screen.getByRole('option', { name: 'OrgB (Org B)' })).toBeInTheDocument();
});
it('requires acknowledgement for mixed rows and does not send it', async () => {
  getOrgAccess.mockResolvedValue({
    ...base, org_admin: true, organizations: ['OrgA', 'OrgB'], partial_visibility_orgs: ['OrgB'],
  });
  renderModal();
  expect(await screen.findByText(/Org visibility is only partly set for: OrgB/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'I understand' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(setOrgAccess).toHaveBeenCalledWith('alice', {
    org_admin: true, organizations: ['OrgA', 'OrgB'], visibility: false, confirm_downgrade: false,
  }));
});
it('allows resolving mixed rows by enabling visibility', async () => {
  getOrgAccess.mockResolvedValue({
    ...base, org_admin: true, organizations: ['OrgA', 'OrgB'], partial_visibility_orgs: ['OrgB'],
  });
  renderModal();
  fireEvent.click(await screen.findByRole('switch', { name: VISIBILITY }));
  expect(screen.queryByRole('checkbox', { name: 'I understand' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});
it('confirms a global creator downgrade', async () => {
  getOrgAccess.mockResolvedValue({ ...base, org_admin: true, global_creator: true });
  renderModal();
  expect(await screen.findByRole('checkbox', { name: 'All organizations' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  pick('OrgA (Org A)');
  expect(screen.getByText(/Saving limits them to: OrgA/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(setOrgAccess).toHaveBeenCalledWith('alice', expect.objectContaining({ confirm_downgrade: true })));
});
it('shows read-only reason', async () => {
  getOrgAccess.mockResolvedValue({ ...base, editable: false, not_editable_reason: 'inactive' });
  renderModal();
  expect(await screen.findByText('Activate this account before giving org access.')).toBeInTheDocument();
  expect(screen.queryByRole('switch', { name: ADMIN })).not.toBeInTheDocument();
});
it('shows the server error and reloads after a server failure', async () => {
  setOrgAccess.mockRejectedValue({ response: { status: 503, data: { detail: 'Service account is not set up.' } } });
  renderModal();
  fireEvent.click(await screen.findByRole('switch', { name: ADMIN }));
  pick('OrgA (Org A)');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Service account is not set up.')).toBeInTheDocument();
  await waitFor(() => expect(getOrgAccess).toHaveBeenCalledTimes(2));
});
it('removes global creation with confirmation', async () => {
  getOrgAccess.mockResolvedValue({ ...base, org_admin: true, global_creator: true });
  renderModal();
  fireEvent.click(await screen.findByRole('switch', { name: ADMIN }));
  expect(screen.getByText(/Saving removes that/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(setOrgAccess).toHaveBeenCalledWith('alice', {
    org_admin: false, organizations: [], visibility: false, confirm_downgrade: true,
  }));
});
it('prevents duplicate submissions while saving', async () => {
  setOrgAccess.mockReturnValue(new Promise(() => {}));
  renderModal();
  fireEvent.click(await screen.findByRole('switch', { name: ADMIN }));
  pick('OrgA (Org A)');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
  expect(setOrgAccess).toHaveBeenCalledTimes(1);
});
it('retries a failed load', async () => {
  getOrgAccess.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(base);
  renderModal();
  expect(await screen.findByText("Could not load this user's access. Please try again.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('switch', { name: ADMIN })).toBeInTheDocument();
});
it('titles the modal Permissions, shows the email and no replace notice', async () => {
  renderModal();
  expect(await screen.findByText('Permissions for Alice')).toBeInTheDocument();
  expect(screen.getByText('alice@e.com')).toBeInTheDocument();
  expect(screen.queryByText('alice')).not.toBeInTheDocument();
  expect(screen.queryByText(/Saving replaces/)).not.toBeInTheDocument();
  expect(screen.getByText('Turn on Org admin and choose an organization first.')).toBeInTheDocument();
});
