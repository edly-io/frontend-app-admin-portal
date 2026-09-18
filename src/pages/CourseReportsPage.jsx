import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import {
  Container, Dropdown, DataTable, Alert, Spinner, Badge, Toast, Hyperlink, Form,
} from '@openedx/paragon';

import {
  triggerCourseReport, getCourseReportDownloads, getCourseCertificates, getCourseReports,
} from '../data/api';
import { formatDateTime } from '../utils/formatDate';
import usePageTitle from '../hooks/usePageTitle';
import EmptyState from '../components/EmptyState';
import { TABLE_PAGE_SIZE } from '../constants/layout';

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

// H3: the page label sits on the back-link row rather than above the title, so
// the title block is name + id only and two heavy elements stop competing.
// The report descriptions used to sit behind a hover tooltip. Popper anchors a
// tooltip to the icon, which is inside the menu, so "left" laid it over the
// menu's own labels and "right" ran it off the viewport. Inline secondary text
// has no placement to get wrong, and unlike the old icon it is reachable by
// keyboard and read out by screen readers.
const MENU_ITEM_STYLE = { whiteSpace: 'normal', paddingTop: '.5rem', paddingBottom: '.5rem' };
// A hairline between options so eleven stacked label+description pairs read as
// separate choices rather than one block of prose.
const MENU_ITEM_DIVIDED_STYLE = { ...MENU_ITEM_STYLE, borderTop: '1px solid #E9E6E4' };
// Paragon wraps Form.Control in a decorator <div> that flex-grows, so a width
// or ml-auto passed to the control lands on that wrapper and fills the row.
// Constrain an outer element instead.
const SEARCH_STYLE = { width: '18rem', flex: '0 0 auto' };
const MENU_DESC_STYLE = { fontSize: '13px', lineHeight: 1.45, whiteSpace: 'normal' };

// Eleven two-line items is taller than a laptop viewport, so the menu scrolls
// rather than running off the bottom of the screen.
const MENU_STYLE = { width: '24rem', maxHeight: '60vh', overflowY: 'auto' };

// Identity block: the course name never wraps and never dominates. A long name
// truncates with an ellipsis and carries the full string in a title attribute.
const COURSE_TITLE_STYLE = {
  fontSize: '26px',
  fontWeight: 600,
  lineHeight: 1.25,
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const COURSE_ID_STYLE = {
  fontFamily: 'monospace', fontSize: '13px', marginTop: '4px',
};
// One tier below the page title, and identical to each other.
const SECTION_LABEL_STYLE = { fontSize: '15px', fontWeight: 600, margin: 0 };

const CRUMB_STYLE = {
  fontSize: '.75rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
};

const RUNNING_STATES = new Set(['QUEUING', 'IN_PROGRESS']);

const STATE_VARIANTS = {
  SUCCESS: 'success',
  FAILURE: 'danger',
  REVOKED: 'light',
  QUEUING: 'info',
  IN_PROGRESS: 'info',
};

// Celery task states are wire values. Don't show them to admins.
const STATE_LABELS = {
  SUCCESS: 'Ready',
  FAILURE: 'Failed',
  REVOKED: 'Cancelled',
  QUEUING: 'Queued',
  IN_PROGRESS: 'Running',
};

const downloadRowShape = PropTypes.shape({
  original: PropTypes.shape({
    state: PropTypes.string,
    download_url: PropTypes.string,
    report_type: PropTypes.string,
    report_label: PropTypes.string,
  }),
}).isRequired;

const StateCell = ({ row }) => {
  const { state } = row.original;
  return <Badge variant={STATE_VARIANTS[state] || 'light'}>{STATE_LABELS[state] || state}</Badge>;
};
StateCell.propTypes = { row: downloadRowShape };

const DownloadCell = ({ row }) => {
  const { download_url: url, state } = row.original;
  if (url) {
    return <Hyperlink destination={url} target="_blank">Download</Hyperlink>;
  }
  if (state === 'FAILURE') {
    return <span className="text-muted">Try again by generating a new report.</span>;
  }
  if (RUNNING_STATES.has(state)) {
    return <span className="text-muted">Preparing…</span>;
  }
  return <span className="text-muted">Not available</span>;
};
DownloadCell.propTypes = { row: downloadRowShape };

const CreatedCell = ({ row }) => (
  <span>{row.original.created ? formatDateTime(row.original.created) : '—'}</span>
);
CreatedCell.propTypes = {
  row: PropTypes.shape({ original: PropTypes.shape({ created: PropTypes.string }) }).isRequired,
};

/**
 * Both report endpoints return their whole list in one response, so filtering
 * is a plain in-memory match. No request is made while typing.
 */
const matches = (needle, ...fields) => {
  const q = needle.trim().toLowerCase();
  if (!q) { return true; }
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
};

const CourseReportsPage = () => {
  const { courseId } = useParams();

  const [downloads, setDownloads] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [triggeringSlug, setTriggeringSlug] = useState(null);
  const [downloadSearch, setDownloadSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const timerRef = useRef(null);

  usePageTitle(courseName ? `${courseName} reports` : 'Course reports');

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

  // Course display name for the header. Best-effort: a failed lookup must not
  // surface as the page-level error alert.
  useEffect(() => {
    let active = true;
    setCourseName('');
    getCourseReports({ search: courseId, page: 1 })
      .then((data) => {
        if (!active) { return; }
        const match = (data.results || []).find((c) => c.course_id === courseId);
        setCourseName(match?.display_name || '');
      })
      .catch(() => {});
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

  const onTrigger = useCallback(async (slug, label) => {
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
  }, [courseId, triggeringSlug, fetchDownloads]);

  const downloadColumns = useMemo(() => [
    { Header: 'Report', accessor: 'report_label' },
    { Header: 'State', accessor: 'state', Cell: StateCell },
    { Header: 'Created', accessor: 'created', Cell: CreatedCell },
    { Header: 'Download', accessor: 'download_url', Cell: DownloadCell },
  ], []);

  // `autoResetPage: false` keeps the table's page across the 10s downloads
  // poll, which is what we want, but it also keeps it when the row set shrinks
  // under a narrowing search. The page then holds an index that no longer
  // exists: no rows render, EmptyTable stays out because itemCount is non-zero,
  // and the footer is hidden once the remaining rows fit one page, so there is
  // no control left to get back. Keying each table on its search term and page
  // count remounts it at page 1 whenever the pagination shape changes, while an
  // ordinary poll that leaves the shape alone still leaves the page put.
  const tableKey = (search, rowCount) => `${search}|${Math.ceil(rowCount / TABLE_PAGE_SIZE)}`;

  const visibleDownloads = useMemo(
    () => downloads.filter((r) => matches(downloadSearch, r.report_label, STATE_LABELS[r.state] || r.state)),
    [downloads, downloadSearch],
  );
  const visibleCertificates = useMemo(
    () => certificates.filter((c) => matches(certSearch, c.username, c.name, c.email, c.status, c.mode)),
    [certificates, certSearch],
  );

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
      <div className="d-flex align-items-center mb-3" style={{ gap: '.5rem' }}>
        <Link to="/reporting/courses">&larr; All courses</Link>
        <span className="text-muted" aria-hidden="true">·</span>
        <span className="text-muted" style={CRUMB_STYLE}>Course reports</span>
      </div>

      {/* H1: h2 sizing, not h1's 2.5rem. This slot holds a long course name,
          not the one-word label every other page puts in its h1. */}
      <div className="pb-3 mb-4" style={{ borderBottom: '1px solid #E9E6E4' }}>
        <h1 style={COURSE_TITLE_STYLE} title={courseName || courseId}>
          {courseName || courseId}
        </h1>
        {courseName && (
          <p className="text-muted mb-0" style={COURSE_ID_STYLE}>{courseId}</p>
        )}
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* F9: this was a full-width card holding one button. The action now sits
          on the section heading row instead of in a mostly empty box. */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={SECTION_LABEL_STYLE}>Generate a report</h2>
          <p className="text-muted small mb-0">
            Exports run in the background and appear under Downloads when ready.
          </p>
        </div>
        <div className="d-flex align-items-center" style={{ gap: '.75rem' }}>
          <div style={SEARCH_STYLE}>
            <Form.Control
              type="text"
              aria-label="Search generated reports"
              placeholder="Search downloads"
              value={downloadSearch}
              onChange={(e) => setDownloadSearch(e.target.value)}
            />
          </div>
          <Dropdown>
            <Dropdown.Toggle variant="primary" id="report-type-menu" disabled={!!triggeringSlug}>
              {triggeringSlug ? (
                <>
                  <Spinner animation="border" size="sm" screenReaderText="Queuing" className="mr-1" />
                  Queuing…
                </>
              ) : 'Generate report'}
            </Dropdown.Toggle>
            <Dropdown.Menu align="right" style={MENU_STYLE}>
              {REPORT_TYPES.map((r, i) => (
                <Dropdown.Item
                  key={r.slug}
                  disabled={!!triggeringSlug}
                  onClick={() => onTrigger(r.slug, r.label)}
                  className="flex-column align-items-start"
                  style={i === 0 ? MENU_ITEM_STYLE : MENU_ITEM_DIVIDED_STYLE}
                >
                  <span>{r.label}</span>
                  <span className="text-muted" style={MENU_DESC_STYLE}>{r.description}</span>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '20rem' }}>
          <Spinner animation="border" screenReaderText="Loading reports" />
        </div>
      ) : (
        <>
          <h2 className="mb-2" style={SECTION_LABEL_STYLE}>Downloads</h2>
          <DataTable
            key={tableKey(downloadSearch, visibleDownloads.length)}
            isPaginated
            initialState={{ pageIndex: 0, pageSize: TABLE_PAGE_SIZE }}
            initialTableOptions={{ autoResetPage: false }}
            columns={downloadColumns}
            data={visibleDownloads}
            itemCount={visibleDownloads.length}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content={downloadSearch
              ? <EmptyState message="No reports match the search criteria" hint="Clear the search to see every generated report." />
              : <EmptyState message="No reports yet" hint="Use Generate report above to create one." />}
            />
            {visibleDownloads.length > TABLE_PAGE_SIZE && <DataTable.TableFooter />}
          </DataTable>

          <div className="d-flex align-items-center justify-content-between mb-2 mt-5" style={{ gap: '1rem' }}>
            <h2 className="mb-0" style={SECTION_LABEL_STYLE}>Certificates</h2>
            <div style={SEARCH_STYLE}>
              <Form.Control
                type="text"
                aria-label="Search certificates"
                placeholder="Search learners"
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
              />
            </div>
          </div>
          <DataTable
            key={tableKey(certSearch, visibleCertificates.length)}
            isPaginated
            initialState={{ pageIndex: 0, pageSize: TABLE_PAGE_SIZE }}
            initialTableOptions={{ autoResetPage: false }}
            columns={certColumns}
            data={visibleCertificates}
            itemCount={visibleCertificates.length}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content={certSearch
              ? <EmptyState message="No certificates match the search criteria" hint="Clear the search to see every issued certificate." />
              : <EmptyState message="No certificates issued" hint="Certificates appear here once learners complete the course." />}
            />
            {visibleCertificates.length > TABLE_PAGE_SIZE && <DataTable.TableFooter />}
          </DataTable>
        </>
      )}

      <Toast onClose={() => setToast('')} show={!!toast}>{toast}</Toast>
    </Container>
  );
};

export default CourseReportsPage;
