import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Container, DataTable, Alert, Spinner, Form, Button, Pagination,
  ModalDialog, ActionRow, Toast, useToggle,
} from '@openedx/paragon';

import { getUsers, setUserActive } from '../data/api';
import StatusBadge from '../components/StatusBadge';

const PAGE_SIZE = 25;

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
  }),
}).isRequired;

const StatusCell = ({ row }) => <StatusBadge status={row.original.status} />;
StatusCell.propTypes = { row: rowShape };

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

  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pending, setPending] = useState(null); // { user, activate }
  const [submitting, setSubmitting] = useState(false);
  const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);
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

  useEffect(() => {
    const handle = setTimeout(fetchUsers, 300); // debounce
    return () => clearTimeout(handle);
  }, [fetchUsers]);

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
    { Header: 'Name', accessor: 'name' },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Status', accessor: 'status', Cell: StatusCell },
    { Header: 'LMS Role', accessor: 'lms_role' },
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
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
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
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '22rem' }}
          />
        </Form.Group>
        <Form.Group className="mb-0" controlId="status-filter">
          <Form.Label>Status</Form.Label>
          <Form.Control as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Form.Control>
        </Form.Group>
      </div>

      {loading ? (
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

export default UsersPage;
