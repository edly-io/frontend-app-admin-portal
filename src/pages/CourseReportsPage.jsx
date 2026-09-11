import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Container, Card, Dropdown, DataTable, Alert, Spinner, Badge, Toast, Hyperlink,
} from '@openedx/paragon';

import {
  triggerCourseReport, getCourseReportDownloads, getCourseCertificates,
} from '../data/api';

// Report types the backend accepts, with display labels (mirrors REPORT_LABELS).
const REPORT_TYPES = [
  { slug: 'grade_csv', label: 'Grade Report' },
  { slug: 'problem_grade', label: 'Problem Grade Report' },
  { slug: 'profile_info', label: 'Profile Information' },
  { slug: 'may_enroll', label: 'Learners Who Can Enroll' },
  { slug: 'inactive_learner', label: 'Learners, Account Not Activated' },
  { slug: 'survey', label: 'Survey Results' },
  { slug: 'proctored_exam', label: 'Proctored Exam Results' },
  { slug: 'ora_data', label: 'ORA Data Report' },
  { slug: 'ora_summary', label: 'ORA Summary Report' },
  { slug: 'ora_submission_archive', label: 'ORA Submission Files Archive' },
  { slug: 'anon_ids', label: 'Student Anonymized IDs' },
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
  <span>{row.original.created ? new Date(row.original.created).toLocaleString() : '—'}</span>
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
      .catch(() => active && setError('Could not load course reports.'))
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
    setError('');
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
      <p className="text-muted"><code>{courseId}</code></p>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">Generate a report</h2>
            <Dropdown>
              <Dropdown.Toggle variant="primary" id="report-type-menu">Generate report</Dropdown.Toggle>
              <Dropdown.Menu>
                {REPORT_TYPES.map((r) => (
                  <Dropdown.Item key={r.slug} onClick={() => onTrigger(r.slug, r.label)}>
                    {r.label}
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
