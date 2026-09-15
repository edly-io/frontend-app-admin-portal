import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  DataTable, Alert, Spinner, Form, Pagination, Badge,
} from '@openedx/paragon';

import { useCourseReports } from '../data/hooks/reporting';
import { useDebouncedValue } from '../data/hooks/useDebouncedValue';
import { formatDate } from '../utils/formatDate';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

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
  <span>{row.original.created ? formatDate(row.original.created) : '—'}</span>
);
CreatedCell.propTypes = { row: rowShape };

const ReportingCoursesPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const {
    data, isFetching, error: queryError, errorUpdatedAt,
  } = useCourseReports({
    search: debouncedSearch,
    page,
    // Hold the request until the debounce has caught up: `page` is not
    // debounced, so paging mid-typing would otherwise fire a request carrying
    // the previous search term.
    enabled: search === debouncedSearch,
  });

  // Dismissal pins the WALL-CLOCK time of the error that was dismissed.
  // A per-query error counter restarts at zero for every cache key, so one
  // dismissed on one filter would swallow the next filter's first failure;
  // the error object itself is not reliable either, since the same instance
  // can be rejected twice. errorUpdatedAt is Date.now() at failure, so any
  // later failure anywhere is strictly greater.
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0);
  const error = queryError && errorUpdatedAt > dismissedErrorAt ? queryError : null;

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
        <Alert variant="danger" dismissible onClose={() => setDismissedErrorAt(errorUpdatedAt)}>
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: '22rem' }}
          />
        </Form.Group>
      </div>

      {isFetching ? (
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
