import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Container, DataTable, Alert, Spinner, Form, Button, Pagination,
  ModalDialog, ActionRow, Toast, useToggle,
} from '@openedx/paragon';

import { useUsers, useSetUserActive } from '../data/hooks/users';
import { useDebouncedValue } from '../data/hooks/useDebouncedValue';
import StatusBadge from '../components/StatusBadge';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

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

const UsersPage = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const {
    data, isFetching, error: queryError, errorUpdatedAt, dataUpdatedAt,
  } = useUsers({
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
    // Hold the request until the debounce has caught up. `status` and `page`
    // are not debounced, so a filter change mid-typing would otherwise fire a
    // request carrying the previous search term.
    enabled: search === debouncedSearch,
  });
  const setActive = useSetUserActive();

  const [dismissedReadErrorAt, setDismissedReadErrorAt] = useState(0);
  const [pending, setPending] = useState(null); // { user, activate }
  const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);
  const [toast, setToast] = useState('');

  // Whichever of the write and the read happened most recently wins the
  // single alert slot. A read "happening" means either outcome — success or
  // failure — so a successful reload retires a stale write error exactly
  // like a newer read failure would: both mean a read has landed since the
  // write, and the write is no longer the most current thing to report.
  const lastReadAt = Math.max(errorUpdatedAt || 0, dataUpdatedAt || 0);
  const writeSupersededByRead = lastReadAt > (setActive.submittedAt || 0);
  const showWriteError = setActive.isError && !writeSupersededByRead;
  const showReadError = !showWriteError && queryError && errorUpdatedAt > dismissedReadErrorAt;
  let error = null;
  if (showWriteError) {
    error = setActive.error;
  } else if (showReadError) {
    error = queryError;
  }

  const askConfirm = useCallback((user, activate) => {
    setPending({ user, activate });
    openConfirm();
  }, [openConfirm]);

  const doConfirm = () => {
    const { user, activate } = pending;
    setActive.mutate({ username: user.username, activate }, {
      onSuccess: () => {
        setToast(`${user.username} ${activate ? 'reactivated' : 'deactivated'}.`);
        closeConfirm();
        setPending(null);
      },
      onError: () => closeConfirm(),
    });
  };

  const columns = useMemo(() => [
    { Header: 'Username', accessor: 'username' },
    { Header: 'Name', accessor: 'name' },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Status', accessor: 'status', Cell: StatusCell },
    { Header: 'LMS Role', accessor: 'lms_role' },
    { Header: 'Enrollments', accessor: 'enrollment_count', Cell: EnrollmentsCell },
    {
      Header: 'Actions', id: 'actions', onAction: askConfirm, Cell: ActionsCell,
    },
  ], [askConfirm]);

  const pageCount = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const confirmLabel = pending?.activate ? 'Reactivate' : 'Deactivate';

  return (
    <Container size="xl" className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Users</h1>
        <Button as={Link} to="/users/new" variant="primary">Create user</Button>
      </div>

      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => {
            if (showWriteError) { setActive.reset(); } else { setDismissedReadErrorAt(errorUpdatedAt); }
          }}
        >
          {error.customAttributes?.httpErrorStatus === 403
            ? 'You do not have EDL admin access.'
            : 'Something went wrong. Please try again.'}
        </Alert>
      )}

      <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: '1rem' }}>
        <Form.Group className="mb-0">
          <Form.Label>Search</Form.Label>
          <Form.Control
            type="text"
            placeholder="name, username or email"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: '22rem' }}
          />
        </Form.Group>
        <Form.Group className="mb-0" controlId="status-filter">
          <Form.Label>Status</Form.Label>
          <Form.Control
            as="select"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Form.Control>
        </Form.Group>
      </div>

      {isFetching ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" screenReaderText="Loading users" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={data.results} itemCount={data.results.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content="No users found" />
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
            <Button variant="tertiary" onClick={closeConfirm} disabled={setActive.isPending}>Cancel</Button>
            <Button
              variant={pending?.activate ? 'primary' : 'danger'}
              onClick={doConfirm}
              disabled={setActive.isPending}
            >
              {setActive.isPending ? 'Working…' : confirmLabel}
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>

      <Toast onClose={() => setToast('')} show={!!toast}>{toast}</Toast>
    </Container>
  );
};

export default UsersPage;
