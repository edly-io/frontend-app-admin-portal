import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Container, Card, Dropdown, DataTable, Alert, Spinner, Badge, Toast, Hyperlink,
  OverlayTrigger, Tooltip, Icon,
} from '@openedx/paragon';
import { InfoOutline } from '@openedx/paragon/icons';

import {
  useCourseCertificates, useCourseReportDownloads, useTriggerCourseReport,
} from '../data/hooks/courseReports';
import { useDismissibleQueryError } from '../data/hooks/useDismissibleQueryError';
import { formatDateTime } from '../utils/formatDate';

// Report types the backend accepts, with display labels (mirrors REPORT_LABELS)
// and a short description of what each report contains.
const REPORT_TYPES = [
  {
    slug: 'grade_csv',
    label: 'Grade Report',
    description: 'Generates a CSV grade report for all currently enrolled students.',
  },
  {
    slug: 'problem_grade',
    label: 'Problem Grade Report',
    description: 'Generates a CSV of student answers to a selected problem, section, or chapter (limited to 5,000 responses).',
  },
  {
    slug: 'profile_info',
    label: 'Profile Information',
    description: 'Generates a CSV of all enrolled students with profile info such as email and username.',
  },
  {
    slug: 'may_enroll',
    label: 'Learners Who Can Enroll',
    description: "Generates a CSV of learners who can enroll in the course but haven't yet done so.",
  },
  {
    slug: 'inactive_learner',
    label: 'Learners, Account Not Activated',
    description: "Generates a CSV of learners who are enrolled but haven't activated their account.",
  },
  {
    slug: 'survey',
    label: 'Survey Results',
    description: 'Generates a CSV of survey results submitted by learners.',
  },
  {
    slug: 'proctored_exam',
    label: 'Proctored Exam Results',
    description: 'Generates a CSV of proctored exam results for the course.',
  },
  {
    slug: 'ora_data',
    label: 'ORA Data Report',
    description: 'Generates a CSV of open response assessment (ORA) data for the course.',
  },
  {
    slug: 'ora_summary',
    label: 'ORA Summary Report',
    description: 'Generates a CSV summary of open response assessment (ORA) results.',
  },
  {
    slug: 'ora_submission_archive',
    label: 'ORA Submission Files Archive',
    description: 'Generates a ZIP file containing all ORA submission texts and attachments.',
  },
  {
    slug: 'anon_ids',
    label: 'Student Anonymized IDs',
    description: 'Downloads a CSV of anonymized student IDs.',
  },
];

const STATE_VARIANTS = {
  SUCCESS: 'success',
  FAILURE: 'danger',
  REVOKED: 'light',
  QUEUING: 'info',
  IN_PROGRESS: 'info',
};

const downloadRowShape = PropTypes.shape({
  original: PropTypes.shape({
    state: PropTypes.string,
    download_url: PropTypes.string,
  }),
}).isRequired;

const StateCell = ({ row }) => {
  const { state } = row.original;
  return <Badge variant={STATE_VARIANTS[state] || 'light'}>{state}</Badge>;
};
StateCell.propTypes = { row: downloadRowShape };

const DownloadCell = ({ row }) => {
  const url = row.original.download_url;
  return url ? <Hyperlink destination={url} target="_blank">Download</Hyperlink> : <span>—</span>;
};
DownloadCell.propTypes = { row: downloadRowShape };

const CreatedCell = ({ row }) => (
  <span>{row.original.created ? formatDateTime(row.original.created) : '—'}</span>
);
CreatedCell.propTypes = {
  row: PropTypes.shape({ original: PropTypes.shape({ created: PropTypes.string }) }).isRequired,
};

const CourseReportsPage = () => {
  const { courseId } = useParams();

  const [toast, setToast] = useState('');

  const downloadsQuery = useCourseReportDownloads(courseId);
  const certificatesQuery = useCourseCertificates(courseId);
  const trigger = useTriggerCourseReport(courseId, {
    onQueued: ({ label }) => setToast(`${label} queued.`),
  });
  // One dismissal timestamp per query — otherwise dismissing (or just
  // leaving active) one query's failure would hide a different query's
  // failure forever, since a single shared timestamp can't tell them apart.
  const downloadsErr = useDismissibleQueryError(downloadsQuery);
  const certificatesErr = useDismissibleQueryError(certificatesQuery);

  const downloads = downloadsQuery.data || [];
  const certificates = certificatesQuery.data || [];
  const loading = downloadsQuery.isPending || certificatesQuery.isPending;

  // Only a failed FIRST load is surfaced. The old code swallowed poll errors
  // (`.catch(() => {})`), so a lost background refresh must stay silent while
  // the table it would have updated is still on screen. Among currently-
  // failing, not-yet-dismissed queries, surface whichever failed most
  // recently, so a second query failing later isn't masked by an earlier one
  // that's still erroring.
  const failedLoad = [
    { query: downloadsQuery, err: downloadsErr },
    { query: certificatesQuery, err: certificatesErr },
  ]
    .filter(({ query, err }) => err.error && query.data === undefined)
    .sort((a, b) => b.err.errorUpdatedAt - a.err.errorUpdatedAt)[0];
  const loadError = failedLoad?.err.error ?? null;

  const dismissLoadError = () => failedLoad?.err.dismiss();

  let error = '';
  if (trigger.error) {
    const status = trigger.error?.customAttributes?.httpErrorStatus;
    const detail = trigger.error?.response?.data?.detail;
    error = status === 400 && detail ? detail : 'Could not queue the report. Please try again.';
  } else if (loadError) {
    error = loadError.customAttributes?.httpErrorStatus === 403
      ? 'You do not have EDL admin access.'
      : 'Could not load course reports.';
  }

  const onTrigger = (slug, label) => {
    if (trigger.isPending) { return; } // one in flight at a time; the menu is disabled anyway
    // The old handler cleared the whole alert before firing. A new mutate
    // clears its own error; the load error has to be dismissed explicitly.
    dismissLoadError();
    trigger.mutate({ slug, label });
  };

  const downloadColumns = useMemo(() => [
    { Header: 'Report', accessor: 'report_label' },
    { Header: 'State', accessor: 'state', Cell: StateCell },
    { Header: 'Created', accessor: 'created', Cell: CreatedCell },
    { Header: 'Download', accessor: 'download_url', Cell: DownloadCell },
  ], []);

  const certColumns = useMemo(() => [
    { Header: 'Username', accessor: 'username' },
    { Header: 'Name', accessor: 'name' },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Mode', accessor: 'mode' },
    { Header: 'Status', accessor: 'status' },
    { Header: 'Grade', accessor: 'grade' },
  ], []);

  return (
    <Container size="xl" className="py-4">
      <div className="mb-2">
        <Link to="/reporting/courses">&larr; All courses</Link>
      </div>
      <h1 className="mb-1">Course reports</h1>
      <p className="text-muted">
        <span style={{ fontFamily: 'monospace' }}>{courseId}</span>
      </p>

      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => { if (trigger.error) { trigger.reset(); } else { dismissLoadError(); } }}
        >
          {error}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0 pl-2">Generate a report</h2>
            <Dropdown>
              <Dropdown.Toggle variant="primary" id="report-type-menu" disabled={trigger.isPending}>
                {trigger.isPending ? (
                  <>
                    <Spinner animation="border" size="sm" screenReaderText="Queuing" className="mr-1" />
                    Queuing…
                  </>
                ) : 'Generate report'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {REPORT_TYPES.map((r) => (
                  <Dropdown.Item
                    key={r.slug}
                    disabled={trigger.isPending}
                    onClick={() => onTrigger(r.slug, r.label)}
                    className="d-flex align-items-center justify-content-between"
                  >
                    <span>{r.label}</span>
                    <OverlayTrigger
                      placement="right"
                      overlay={<Tooltip id={`report-tooltip-${r.slug}`}>{r.description}</Tooltip>}
                    >
                      <span
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon src={InfoOutline} size="xs" className="ml-2 text-muted" />
                      </span>
                    </OverlayTrigger>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" screenReaderText="Loading reports" />
        </div>
      ) : (
        <>
          <h2 className="h5 mb-2">Downloads</h2>
          <DataTable columns={downloadColumns} data={downloads} itemCount={downloads.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content="No reports generated yet" />
          </DataTable>

          <h2 className="h5 mb-2 mt-4">Certificates</h2>
          <DataTable columns={certColumns} data={certificates} itemCount={certificates.length}>
            <DataTable.Table />
            <DataTable.EmptyTable content="No certificates issued" />
          </DataTable>
        </>
      )}

      <Toast onClose={() => setToast('')} show={!!toast}>{toast}</Toast>
    </Container>
  );
};

export default CourseReportsPage;
