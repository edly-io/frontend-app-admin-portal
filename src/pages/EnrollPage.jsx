import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Container, Form, Button, Alert, DataTable, Badge, ActionRow,
  ModalDialog, useToggle,
} from '@openedx/paragon';

import { updateEnrollments } from '../data/api';
import CourseIdField from '../components/CourseIdField';
import usePageTitle from '../hooks/usePageTitle';
import EmptyState from '../components/EmptyState';

/** "1 learner" / "3 learners" / "No learners added yet". */
const learnerCount = (n) => {
  if (n === 0) { return 'No learners added yet'; }
  return `${n} learner${n === 1 ? '' : 's'}`;
};

const parseIdentifiers = (raw) => raw
  .split(/[\n,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ResultCell = ({ row }) => (row.original.success
  ? <Badge variant="success">Succeeded</Badge>
  : <Badge variant="danger">{row.original.error_message || 'Failed'}</Badge>);
ResultCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      identifier: PropTypes.string,
      success: PropTypes.bool,
      error_message: PropTypes.string,
    }),
  }).isRequired,
};

const RESULT_COLUMNS = [
  { Header: 'Identifier', accessor: 'identifier' },
  { Header: 'Result', id: 'result', Cell: ResultCell },
];

const EnrollPage = () => {
  usePageTitle('Enrollment');
  const [courseId, setCourseId] = useState('');
  const [identifiersRaw, setIdentifiersRaw] = useState('');
  const [emailStudents, setEmailStudents] = useState(false);
  const [autoEnroll, setAutoEnroll] = useState(false);
  const [reason, setReason] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isUnenrollOpen, openUnenroll, closeUnenroll] = useToggle(false);
  const resultsRef = useRef(null);

  const identifiers = parseIdentifiers(identifiersRaw);

  // Bring the outcome into view — the form can push the results below the
  // fold, so on completion scroll straight to the summary banner.
  useEffect(() => {
    // Optional-chain scrollIntoView: it's absent in jsdom (tests) and older browsers.
    if (results) {
      resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  const run = async (action) => {
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    setResults(null);
    try {
      const data = await updateEnrollments(action, {
        course_id: courseId,
        identifiers,
        email_students: emailStudents,
        auto_enroll: autoEnroll,
        reason,
      });
      setResults({ action, ...data });
    } catch (err) {
      const body = err?.response?.data || {};
      if (body.course_id || body.identifiers) {
        setFieldErrors({
          courseId: [].concat(body.course_id || []).join(' '),
          identifiers: [].concat(body.identifiers || []).join(' '),
        });
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
      closeUnenroll();
    }
  };

  const canSubmit = courseId.trim() && identifiers.length > 0 && !submitting;

  return (
    <Container size="lg" className="py-4">
      <h1 className="mb-3">Enrollment</h1>
      <p className="text-muted mb-4">
        Enroll or unenroll one or many learners (email or username) in a published course run.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <CourseIdField
        controlId="enroll-course-id"
        value={courseId}
        onChange={setCourseId}
        isInvalid={!!fieldErrors.courseId}
        feedback={fieldErrors.courseId}
      />

      <Form.Group>
        <Form.Label>Learners</Form.Label>
        <Form.Control
          as="textarea"
          rows={5}
          placeholder="One email or username per line (or comma-separated)"
          value={identifiersRaw}
          onChange={(e) => setIdentifiersRaw(e.target.value)}
          isInvalid={!!fieldErrors.identifiers}
        />
        <Form.Text>{learnerCount(identifiers.length)}</Form.Text>
        {fieldErrors.identifiers && (
          <Form.Control.Feedback type="invalid">{fieldErrors.identifiers}</Form.Control.Feedback>
        )}
      </Form.Group>

      <Form.Switch checked={emailStudents} onChange={(e) => setEmailStudents(e.target.checked)} className="mr-3">
        Send notification email
      </Form.Switch>
      <Form.Switch checked={autoEnroll} onChange={(e) => setAutoEnroll(e.target.checked)} className="mb-2">
        Allow not-yet-registered emails (pending enrollment)
      </Form.Switch>

      <Form.Group>
        <Form.Label>Reason (optional)</Form.Label>
        <Form.Control
          placeholder="e.g. Course transfer, re-enrollment after refund"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Form.Group>

      {!canSubmit && !submitting && (
        <p className="text-muted small mb-2">
          Add a course run and at least one learner to continue.
        </p>
      )}

      <ActionRow>
        <Button variant="primary" disabled={!canSubmit} onClick={() => run('enroll')}>
          {submitting ? 'Working…' : 'Enroll'}
        </Button>
        <Button variant="outline-danger" disabled={!canSubmit} onClick={openUnenroll}>
          Unenroll
        </Button>
      </ActionRow>

      {results && (
        <div ref={resultsRef} className="mt-4">
          <Alert variant={results.failed_operations ? 'warning' : 'success'}>
            <Alert.Heading>
              {results.action === 'enroll' ? 'Enrollment' : 'Unenrollment'} complete
            </Alert.Heading>
            <span>
              <strong>{results.successful_operations}</strong>
              {' '}
              {results.action === 'enroll' ? 'enrolled' : 'unenrolled'} successfully
              {results.failed_operations ? (
                <>, <strong>{results.failed_operations}</strong> failed. See the table below.</>
              ) : '.'}
            </span>
          </Alert>
          <h2 className="h4">Per-learner results</h2>
          <DataTable
            columns={RESULT_COLUMNS}
            data={results.results || []}
            itemCount={(results.results || []).length}
          >
            <DataTable.Table />
            <DataTable.EmptyTable content={<EmptyState message="No results" />} />
          </DataTable>
        </div>
      )}

      <ModalDialog title="Confirm unenroll" isOpen={isUnenrollOpen} onClose={closeUnenroll} hasCloseButton={false}>
        <ModalDialog.Header>
          <ModalDialog.Title>
            Unenroll {identifiers.length} {identifiers.length === 1 ? 'learner' : 'learners'}?
          </ModalDialog.Title>
        </ModalDialog.Header>
        <ModalDialog.Body>
          They will be removed from the course roster. Submission and grade data is retained.
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <Button variant="tertiary" onClick={closeUnenroll} disabled={submitting}>Cancel</Button>
            <Button variant="danger" onClick={() => run('unenroll')} disabled={submitting}>
              {submitting ? 'Working…' : 'Unenroll'}
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>
    </Container>
  );
};

export default EnrollPage;
