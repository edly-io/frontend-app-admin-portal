import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Container, Card, Dropdown, DataTable, Alert, Spinner, Badge, Toast, Hyperlink,
  OverlayTrigger, Tooltip, Icon,
} from '@openedx/paragon';
import { InfoOutline } from '@openedx/paragon/icons';

import {
  triggerCourseReport, getCourseReportDownloads, getCourseCertificates,
} from '../data/api';
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

const RUNNING_STATES = new Set(['QUEUING', 'IN_PROGRESS']);

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

  const [downloads, setDownloads] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [triggeringSlug, setTriggeringSlug] = useState(null);
  const timerRef = useRef(null);

  const fetchDownloads = useCallback(async () => {
    const data = await getCourseReportDownloads(courseId);
    setDownloads(data.results || []);
    return data.results || [];
  }, [courseId]);

  // Initial load: downloads + certificates.
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getCourseReportDownloads(courseId), getCourseCertificates(courseId)])
      .then(([dl, certs]) => {
        if (!active) { return; }
        setDownloads(dl.results || []);
        setCertificates(certs.results || []);
        setError('');
      })
      .catch((err) => {
        if (!active) { return; }
        setError(err?.customAttributes?.httpErrorStatus === 403
          ? 'You do not have EDL admin access.'
          : 'Could not load course reports.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId]);

  // Poll every 10s while any task is still running; stop when nothing is.
  useEffect(() => {
    const anyRunning = downloads.some((row) => RUNNING_STATES.has(row.state));
    if (!anyRunning) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return undefined;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => { fetchDownloads().catch(() => {}); }, 10000);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [downloads, fetchDownloads]);

  const onTrigger = async (slug, label) => {
    if (triggeringSlug) { return; } // one in flight at a time; the menu is disabled anyway
    setError('');
    setTriggeringSlug(slug);
    try {
      await triggerCourseReport(courseId, slug);
      setToast(`${label} queued.`);
      await fetchDownloads();
    } catch (err) {
      const status = err?.customAttributes?.httpErrorStatus;
      const detail = err?.response?.data?.detail;
      if (status === 400 && detail) {
        setError(detail);
      } else {
        setError('Could not queue the report. Please try again.');
      }
    } finally {
      setTriggeringSlug(null);
    }
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

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0 pl-2">Generate a report</h2>
            <Dropdown>
              <Dropdown.Toggle variant="primary" id="report-type-menu" disabled={!!triggeringSlug}>
                {triggeringSlug ? (
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
                    disabled={!!triggeringSlug}
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
