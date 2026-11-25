import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Container, DataTable, Alert, Spinner, Form, Button, Pagination,
  ModalDialog, ActionRow, Toast, useToggle, Badge, OverlayTrigger, Tooltip, Icon,
} from '@openedx/paragon';
import { InfoOutline } from '@openedx/paragon/icons';

import { getUsers, resendInvite, setUserActive } from '../data/api';
import StatusBadge from '../components/StatusBadge';
import useDebouncedEffect from '../hooks/useDebouncedEffect';
import usePageTitle from '../hooks/usePageTitle';
import EmptyState from '../components/EmptyState';
import CreateUserModal from '../components/CreateUserModal';
import { formatDate } from '../utils/formatDate';
import OrgAccessModal from '../components/OrgAccessModal';
import { ACTIONS_COLUMN_LABEL } from '../constants/table';

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
  'edl_portal_service',
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
  { label: 'Invitation expired', value: 'invitation_expired' },
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
    org_admin_orgs: PropTypes.arrayOf(PropTypes.string),
    org_admin_all_orgs: PropTypes.bool,
    org_visibility_orgs: PropTypes.arrayOf(PropTypes.string),
    date_joined: PropTypes.string,
    invite_expires_at: PropTypes.string,
    invite_expired: PropTypes.bool,
  }),
}).isRequired;

// Pending users show when their set-password link expires (or expired); null means no invite was recorded.
const StatusCell = ({ row }) => {
  const { status, invite_expired: expired, invite_expires_at: expiresAt } = row.original;
  return (
    // Tight line height keeps the stack no taller than the row's action buttons.
    <div style={{ lineHeight: 1.1 }}>
      <StatusBadge status={status} inviteExpired={expired} />
      {status === 'pending' && expiresAt && (
        <div className="text-muted" style={{ fontSize: '.6875rem' }}>
          {expired ? 'Expired' : 'Expires'} {formatDate(expiresAt)}
        </div>
      )}
    </div>
  );
};
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

const CreatedCell = ({ row }) => (
  <span>{row.original.date_joined ? formatDate(row.original.date_joined) : '—'}</span>
);
CreatedCell.propTypes = { row: rowShape };

const OrgListCell = ({ row }) => {
  const orgs = row.original.org_admin_orgs || [];
  return <>{row.original.org_admin_all_orgs && <Badge variant="info">All organizations</Badge>} {orgs.length ? orgs.join(', ') : !row.original.org_admin_all_orgs && <span className="text-muted">None</span>}</>;
};
OrgListCell.propTypes = { row: rowShape };

const OrgVisibilityCell = ({ row }) => (
  row.original.org_visibility_orgs?.length
    ? <span>Yes</span>
    : <span className="text-muted">No</span>
);
OrgVisibilityCell.propTypes = { row: rowShape };

// Column title with an info icon. The tooltip opens on hover and on keyboard
// focus, and its text is also the icon's screen reader label.
const HeaderWithHint = ({ label, hint, id }) => (
  <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{hint}</Tooltip>}>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <span className="d-inline-flex align-items-center" tabIndex={0} style={{ cursor: 'help' }}>
      {label}
      <Icon src={InfoOutline} size="xs" className="ml-1" screenReaderText={hint} />
    </span>
  </OverlayTrigger>
);
HeaderWithHint.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
};

const ActionsCell = ({ row, column }) => {
  const user = row.original;
  if (user.status === 'disabled') {
    return (
      <ActionRow className="justify-content-center flex-nowrap">
        <Button size="sm" variant="outline-primary" onClick={() => column.onEdit(user)}>Edit access</Button>
        <Button size="sm" variant="outline-primary" onClick={() => column.onAction(user, 'reactivate')}>
          Reactivate
        </Button>
      </ActionRow>
    );
  }
  return (
    <ActionRow className="justify-content-center flex-nowrap">
      <Button size="sm" variant="outline-primary" onClick={() => column.onEdit(user)}>Edit access</Button>
      {user.invite_expired && (
        <Button size="sm" variant="outline-primary" className="text-nowrap" onClick={() => column.onAction(user, 'resend')}>
          Resend Invitation
        </Button>
      )}
      <Button size="sm" variant="outline-danger" className="text-nowrap" onClick={() => column.onAction(user, 'deactivate')}>
        Deactivate
      </Button>
    </ActionRow>
  );
};
ActionsCell.propTypes = {
  row: rowShape,
  column: PropTypes.shape({ onAction: PropTypes.func, onEdit: PropTypes.func }).isRequired,
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

  const [pending, setPending] = useState(null); // { user, action }
  const [submitting, setSubmitting] = useState(false);
  const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);
  const [isCreateOpen, openCreate, closeCreate] = useToggle(createOpen);
  const [toast, setToast] = useState('');
  // Bumped to force a reload when nothing else in the query changed.
  const [refreshKey, setRefreshKey] = useState(0);
  const latestRequestRef = useRef(0);
  const [accessUser, setAccessUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) { params.search = search; }
      if (status) { params.status = status; }
      const result = await getUsers(params);
      if (requestId !== latestRequestRef.current) { return; }
      setData(result);
      setError(null);
    } catch (e) {
      if (requestId === latestRequestRef.current) { setError(e); }
    } finally {
      if (requestId === latestRequestRef.current) { setLoading(false); }
    }
    // refreshKey only re-creates the callback so a reload can be forced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page, refreshKey]);

  useDebouncedEffect(fetchUsers, [fetchUsers]);

  // Reset to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // The directory lists newest first. Clear the filters and go to page 1 so the
  // new user is visible, then force a reload in case nothing else changed.
  const showNewUser = (user) => {
    setToast(`${user.username} created.`);
    setSearch('');
    setStatus('');
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const askConfirm = useCallback((user, action) => {
    setPending({ user, action });
    openConfirm();
  }, [openConfirm]);

  const doConfirm = async () => {
    setSubmitting(true);
    try {
      if (pending.action === 'resend') {
        await resendInvite(pending.user.username);
        setToast(`Invitation resent to ${pending.user.email}.`);
      } else {
        const activate = pending.action === 'reactivate';
        await setUserActive(pending.user.username, activate);
        setToast(`${pending.user.username} ${activate ? 'reactivated' : 'deactivated'}.`);
      }
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
    { Header: 'Created', accessor: 'date_joined', Cell: CreatedCell },
    { Header: 'LMS role', accessor: 'lms_role', Cell: RoleCell },
    { Header: 'Enrollments', accessor: 'enrollment_count', Cell: EnrollmentsCell },
    {
      Header: (
        <HeaderWithHint
          id="hint-org-admin"
          label="Org admin for"
          hint="Organizations where this user can create course runs, re-runs and libraries."
        />
      ),
      accessor: 'org_admin_orgs',
      Cell: OrgListCell,
    },
    {
      Header: (
        <HeaderWithHint
          id="hint-org-visibility"
          label="Has org visibility?"
          hint="Yes: sees and manages every course in the organizations listed under Org admin for, including new ones. No: sees only courses they are on the team of."
        />
      ),
      accessor: 'org_visibility_orgs',
      Cell: OrgVisibilityCell,
    },
    {
      Header: ACTIONS_COLUMN_LABEL, id: 'actions', onAction: askConfirm, onEdit: setAccessUser, Cell: ActionsCell,
    },
  ], [askConfirm]);

  const visibleUsers = useMemo(
    () => (data.results || []).filter((u) => !isServiceAccount(u)),
    [data.results],
  );
  const pageCount = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const CONFIRM_COPY = {
    reactivate: { label: 'Reactivate', variant: 'primary', body: 'This restores login and course access for the account.' },
    resend: { label: 'Resend', variant: 'primary', body: `This emails ${pending?.user.email} a new link to set a password. Older links stop working.` },
    deactivate: { label: 'Deactivate', variant: 'danger', body: 'This blocks login and course access. Enrollments, submissions and grades are retained — this is not account deletion.' },
  };
  const confirm = CONFIRM_COPY[pending?.action || 'deactivate'];
  const confirmLabel = confirm.label;

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
        <div className="d-flex flex-wrap align-items-center flex-grow-1 flex-md-grow-0 justify-content-end ml-auto" style={{ gap: '.75rem' }}>
          <Form.Control
            type="text"
            aria-label="Search users"
            placeholder="Search name, username or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-grow-1"
            style={{ minWidth: '12rem' }}
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

      {loading && !data.results.length ? (
        <div className="d-flex justify-content-center align-items-center" style={TABLE_LOADING_MIN_HEIGHT}>
          <Spinner animation="border" screenReaderText="Loading users" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={visibleUsers} itemCount={visibleUsers.length}>
            <div className="users-table-rows"><DataTable.Table /></div>
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

      <OrgAccessModal isOpen={!!accessUser} user={accessUser} onClose={() => setAccessUser(null)} onSaved={(user) => { setToast(`Access updated for ${user.username}.`); fetchUsers(); }} />
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => {
          closeCreate();
          // /users/new deep-links straight into the modal; closing it should
          // leave the admin on the directory, not on a URL with no dialog.
          if (createOpen) { navigate('/', { replace: true }); }
        }}
        onCreated={showNewUser}
      />

      <ModalDialog title="Confirm" isOpen={isConfirmOpen} onClose={closeConfirm} hasCloseButton={false}>
        <ModalDialog.Header>
          <ModalDialog.Title>{confirmLabel} {pending?.user.username}?</ModalDialog.Title>
        </ModalDialog.Header>
        <ModalDialog.Body>
          {confirm.body}
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <Button variant="tertiary" onClick={closeConfirm} disabled={submitting}>Cancel</Button>
            <Button
              variant={confirm.variant}
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
