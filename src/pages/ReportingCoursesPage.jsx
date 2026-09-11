import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  DataTable, Alert, Spinner, Form, Pagination, Badge,
} from '@openedx/paragon';

import { getCourseReports } from '../data/api';

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

const ReportingCoursesPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (search) { params.search = search; }
      setData(await getCourseReports(params));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const handle = setTimeout(fetchCourses, 300); // debounce
    return () => clearTimeout(handle);
  }, [fetchCourses]);

  useEffect(() => { setPage(1); }, [search]);

  const columns = useMemo(() => [
    { Header: 'Course', accessor: 'display_name', Cell: CourseCell },
    { Header: 'Org', accessor: 'org' },
    { Header: 'Enrollments', accessor: 'enrollment_count' },
    { Header: 'State', accessor: 'lifecycle_state', Cell: StateCell },
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
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" screenReaderText="Loading courses" />
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={data.results} itemCount={data.results.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content="No courses found" />
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
