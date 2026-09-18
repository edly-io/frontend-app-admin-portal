import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  DataTable, Alert, Spinner, Form, Pagination, Badge,
} from '@openedx/paragon';

import { getCourseReports } from '../data/api';
import { formatDate } from '../utils/formatDate';
import useDebouncedEffect from '../hooks/useDebouncedEffect';
import usePageTitle from '../hooks/usePageTitle';
import EmptyState from '../components/EmptyState';

const PAGE_SIZE = 25;

const LIFECYCLE_VARIANTS = {
  running: 'success',
  upcoming: 'info',
  ended: 'light',
  no_dates: 'warning',
};
const LIFECYCLE_LABELS = {
  running: 'Running',
  upcoming: 'Upcoming',
  ended: 'Ended',
  no_dates: 'No dates',
};

const rowShape = PropTypes.shape({
  original: PropTypes.shape({
    course_id: PropTypes.string,
    display_name: PropTypes.string,
    lifecycle_state: PropTypes.string,
    created: PropTypes.string,
  }),
}).isRequired;

const CourseCell = ({ row }) => (
  <Link to={`/reporting/courses/${encodeURIComponent(row.original.course_id)}`}>
    {row.original.display_name}
  </Link>
);
CourseCell.propTypes = { row: rowShape };

const StateCell = ({ row }) => {
  const state = row.original.lifecycle_state;
  return <Badge variant={LIFECYCLE_VARIANTS[state] || 'light'}>{LIFECYCLE_LABELS[state] || state}</Badge>;
};
StateCell.propTypes = { row: rowShape };

const CreatedCell = ({ row }) => (
  <span className={row.original.created ? '' : 'text-muted'}>
    {row.original.created ? formatDate(row.original.created) : 'Not set'}
  </span>
);
CreatedCell.propTypes = { row: rowShape };

const ReportingCoursesPage = () => {
  usePageTitle('Courses');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRequestRef = useRef(0);

  const fetchCourses = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const params = { page };
      if (search) { params.search = search; }
      const result = await getCourseReports(params);
      if (requestId !== latestRequestRef.current) { return; }
      setData(result);
      setError(null);
    } catch (e) {
      if (requestId !== latestRequestRef.current) { return; }
      setError(e);
    } finally {
      if (requestId === latestRequestRef.current) { setLoading(false); }
    }
  }, [search, page]);

  useDebouncedEffect(fetchCourses, [fetchCourses]);

  useEffect(() => { setPage(1); }, [search]);

  const columns = useMemo(() => [
    { Header: 'Course Name', accessor: 'display_name', Cell: CourseCell },
    { Header: 'Key', accessor: 'course_id' },
    { Header: 'Creation Date', accessor: 'created', Cell: CreatedCell },
    { Header: 'Status', accessor: 'lifecycle_state', Cell: StateCell },
    { Header: '# of enrollments', accessor: 'enrollment_count' },
  ], []);

  const pageCount = Math.max(1, Math.ceil(data.count / PAGE_SIZE));

  return (
    <>
      <p className="text-muted">Select a course to generate and download reports.</p>

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
            placeholder="course name, id or org"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '22rem' }}
          />
        </Form.Group>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '20rem' }}>
          <Spinner animation="border" screenReaderText="Loading courses" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={data.results} itemCount={data.results.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content={<EmptyState message="No courses found" hint="Try a different course name, id or organization." />} />
          </DataTable>
          {pageCount > 1 && (
            <Pagination
              className="justify-content-center mt-3"
              paginationLabel="course pages"
              pageCount={pageCount}
              currentPage={page}
              onPageSelect={setPage}
            />
          )}
        </>
      )}
    </>
  );
};

export default ReportingCoursesPage;
