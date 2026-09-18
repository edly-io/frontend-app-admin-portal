import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Container, DataTable, Alert, Spinner, Form, Button, Pagination,
  ModalDialog, ActionRow, Toast, useToggle,
} from '@openedx/paragon';

import { getUsers, setUserActive } from '../data/api';
import StatusBadge from '../components/StatusBadge';
import useDebouncedEffect from '../hooks/useDebouncedEffect';
import usePageTitle from '../hooks/usePageTitle';
import EmptyState from '../components/EmptyState';
import CreateUserModal from '../components/CreateUserModal';

const PAGE_SIZE = 25;

/**
 * Platform service accounts. These are not people, and deactivating one breaks
 * the instance, so they never appear in the customer-facing directory.
 *
 * Filtering happens client-side because the endpoint has no exclude parameter.
 * The consequence is that `data.count`, and so the page count, still includes
 * them, which can leave a page of 25 showing fewer rows. Moving the filter into
 * `UsersView` would fix that and is the right long-term home for it.
 */
const SERVICE_ACCOUNTS = new Set([
  'login_service_user',
  'cms',
  'lms',
  'ecommerce_worker',
  'discovery_worker',
  'credentials_worker',
  'insights_worker',
  'veda_service_user',
  'retirement_service_worker',
  'staff_service_user',
]);
const isServiceAccount = (user) => SERVICE_ACCOUNTS.has(user.username);

// Hold roughly a full page of rows while loading so the page doesn't collapse
// and then jump when results land.
const TABLE_LOADING_MIN_HEIGHT = { minHeight: '20rem' };

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending invitation', value: 'pending' },
  { label: 'Disabled', value: 'disabled' },
];

const rowShape = PropTypes.shape({
  original: PropTypes.shape({
    username: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    status: PropTypes.string,
    lms_role: PropTypes.string,
    enrollment_count: PropTypes.number,
  }),
}).isRequired;

const StatusCell = ({ row }) => <StatusBadge status={row.original.status} />;
StatusCell.propTypes = { row: rowShape };

// Accounts created by services (cms, login_service_user) carry no profile name.
const NameCell = ({ row }) => (row.original.name
  ? <span>{row.original.name}</span>
  : <span className="text-muted">Not set</span>);
NameCell.propTypes = { row: rowShape };

// C7: the LMS sends lowercase role slugs; don't show the wire value.
const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', learner: 'Learner' };
const RoleCell = ({ row }) => {
  const role = row.original.lms_role;
  return <span>{ROLE_LABELS[role] || role}</span>;
};
RoleCell.propTypes = { row: rowShape };

// null means the backend couldn't compute it (standalone/non-LMS deployment).
const EnrollmentsCell = ({ row }) => (
  <span>{row.original.enrollment_count ?? '—'}</span>
);
EnrollmentsCell.propTypes = { row: rowShape };

const ActionsCell = ({ row, column }) => {
  const user = row.original;
  if (user.status === 'disabled') {
    return (
      <Button size="sm" variant="outline-primary" onClick={() => column.onAction(user, true)}>
        Reactivate
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline-danger" onClick={() => column.onAction(user, false)}>
      Deactivate
    </Button>
  );
};
ActionsCell.propTypes = {
  row: rowShape,
  column: PropTypes.shape({ onAction: PropTypes.func }).isRequired,
};

const UsersPage = ({ createOpen = false }) => {
  usePageTitle('Users');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pending, setPending] = useState(null); // { user, activate }
  const [submitting, setSubmitting] = useState(false);
  const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);
  const [isCreateOpen, openCreate, closeCreate] = useToggle(createOpen);
  const [toast, setToast] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) { params.search = search; }
      if (status) { params.status = status; }
      setData(await getUsers(params));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useDebouncedEffect(fetchUsers, [fetchUsers]);

  // Reset to page 1 whenever the filters change.
  useEffect(() => { setPage(1); }, [search, status]);

  const askConfirm = useCallback((user, activate) => {
    setPending({ user, activate });
    openConfirm();
  }, [openConfirm]);

  const doConfirm = async () => {
    setSubmitting(true);
    try {
      await setUserActive(pending.user.username, pending.activate);
      setToast(`${pending.user.username} ${pending.activate ? 'reactivated' : 'deactivated'}.`);
      closeConfirm();
      setPending(null);
      fetchUsers();
    } catch (e) {
      setError(e);
      closeConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(() => [
    { Header: 'Username', accessor: 'username' },
    { Header: 'Name', accessor: 'name', Cell: NameCell },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Status', accessor: 'status', Cell: StatusCell },
    { Header: 'LMS role', accessor: 'lms_role', Cell: RoleCell },
    { Header: 'Enrollments', accessor: 'enrollment_count', Cell: EnrollmentsCell },
    {
      Header: 'Actions', id: 'actions', onAction: askConfirm, Cell: ActionsCell,
    },
  ], [askConfirm]);

  const visibleUsers = useMemo(
    () => (data.results || []).filter((u) => !isServiceAccount(u)),
    [data.results],
  );
  const pageCount = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const confirmLabel = pending?.activate ? 'Reactivate' : 'Deactivate';

  return (
    <Container size="xl" className="py-4">

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error.customAttributes?.httpErrorStatus === 403
            ? 'You do not have EDL admin access.'
            : 'Something went wrong. Please try again.'}
        </Alert>
      )}

      {/* Title left, controls right, one row. The field labels move into
          placeholders with an aria-label behind them: stacked labels beside an
          h1 make the row tall and push the controls off the title's baseline,
          and placeholder-only is the usual shape for an inline toolbar. The row
          wraps to two lines below ~900px rather than crushing the inputs. */}
      <div
        className="d-flex flex-wrap align-items-center justify-content-between mb-3"
        style={{ gap: '1rem' }}
      >
        <h1 className="mb-0">Users</h1>
        <div className="d-flex flex-wrap align-items-center" style={{ gap: '.75rem' }}>
          <Form.Control
            type="text"
            aria-label="Search users"
            placeholder="Search name, username or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '18rem' }}
          />
          <Form.Control
            as="select"
            id="status-filter"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto' }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Form.Control>
          <Button variant="primary" onClick={openCreate}>Create user</Button>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={TABLE_LOADING_MIN_HEIGHT}>
          <Spinner animation="border" screenReaderText="Loading users" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={visibleUsers} itemCount={visibleUsers.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content={<EmptyState message="No users found" hint="Try a different name, username or email, or clear the status filter." />} />
          </DataTable>
          {pageCount > 1 && (
            <Pagination
              className="justify-content-center mt-3"
              paginationLabel="user directory pages"
              pageCount={pageCount}
              currentPage={page}
              onPageSelect={setPage}
            />
          )}
        </>
      )}

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => {
          closeCreate();
          // /users/new deep-links straight into the modal; closing it should
          // leave the admin on the directory, not on a URL with no dialog.
          if (createOpen) { navigate('/', { replace: true }); }
        }}
        onCreated={(user) => { setToast(`${user.username} created.`); fetchUsers(); }}
      />

      <ModalDialog title="Confirm" isOpen={isConfirmOpen} onClose={closeConfirm} hasCloseButton={false}>
        <ModalDialog.Header>
          <ModalDialog.Title>{confirmLabel} {pending?.user.username}?</ModalDialog.Title>
        </ModalDialog.Header>
        <ModalDialog.Body>
          {pending?.activate
            ? 'This restores login and course access for the account.'
            : 'This blocks login and course access. Enrollments, submissions and grades are retained — this is not account deletion.'}
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <Button variant="tertiary" onClick={closeConfirm} disabled={submitting}>Cancel</Button>
            <Button
              variant={pending?.activate ? 'primary' : 'danger'}
              onClick={doConfirm}
              disabled={submitting}
            >
              {submitting ? 'Working…' : confirmLabel}
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>

      <Toast onClose={() => setToast('')} show={!!toast}>{toast}</Toast>
    </Container>
  );
};

UsersPage.propTypes = {
  createOpen: PropTypes.bool,
};

export default UsersPage;
