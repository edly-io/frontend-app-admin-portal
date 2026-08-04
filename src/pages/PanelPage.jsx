import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Container, DataTable, Alert, Spinner, Form, Badge,
} from '@openedx/paragon';

import { getMe, getUsers } from '../data/api';

const STATUS_VARIANTS = {
  active: 'success',
  pending: 'warning',
  disabled: 'danger',
};

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending invitation', value: 'pending' },
  { label: 'Disabled', value: 'disabled' },
];

function StatusBadge({ row }) {
  const status = row.original.status;
  return <Badge variant={STATUS_VARIANTS[status] || 'light'}>{status}</Badge>;
}

/**
 * EDL Panel home: confirms admin access via `me`, then shows the searchable,
 * filterable user directory. This is the EDL-11 shell; create / enroll /
 * deactivate / role UIs land in later stories.
 */
export default function PanelPage() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState({ count: 0, results: [] });

  useEffect(() => {
    getMe().then(setMe).catch((e) => setError(e));
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) { params.search = search; }
      if (status) { params.status = status; }
      setData(await getUsers(params));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const handle = setTimeout(fetchUsers, 300); // debounce search/filter
    return () => clearTimeout(handle);
  }, [fetchUsers]);

  const columns = useMemo(() => [
    { Header: 'Username', accessor: 'username' },
    { Header: 'Name', accessor: 'name' },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Status', accessor: 'status', Cell: StatusBadge },
  ], []);

  return (
    <Container size="xl" className="py-4">
      <h1 className="mb-1">Users</h1>
      {me && <p className="text-muted small">Signed in as {me.username}</p>}

      {error && (
        <Alert variant="danger">
          {error.customAttributes?.httpErrorStatus === 403
            ? 'You do not have EDL admin access.'
            : 'Something went wrong loading users. Please try again.'}
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-3 mb-3">
        <Form.Group className="mb-0">
          <Form.Control
            type="text"
            placeholder="Search by name, username or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
        </Form.Group>
        <Form.Group className="mb-0">
          <Form.Control as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Form.Control>
        </Form.Group>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" screenReaderText="Loading users" />
        </div>
      ) : (
        <DataTable
          isPaginated
          itemCount={data.count}
          data={data.results}
          columns={columns}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No users found" />
        </DataTable>
      )}
    </Container>
  );
}
