import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Container, Form, Button, Alert, DataTable, Badge, ActionRow,
  ModalDialog, useToggle,
} from '@openedx/paragon';

import { useUpdateEnrollments } from '../data/hooks/enrollments';
import CourseIdField from '../components/CourseIdField';
import { extractFieldErrors } from '../utils/extractFieldErrors';

const parseIdentifiers = (raw) => raw
  .split(/[\n,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ResultCell = ({ row }) => (row.original.success
  ? <Badge variant="success">success</Badge>
  : <Badge variant="danger">{row.original.error_message || 'failed'}</Badge>);
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
  const enroll = useUpdateEnrollments();

  const [courseId, setCourseId] = useState('');
  const [identifiersRaw, setIdentifiersRaw] = useState('');
  const [emailStudents, setEmailStudents] = useState(false);
  const [autoEnroll, setAutoEnroll] = useState(false);
  const [reason, setReason] = useState('');

  const [isUnenrollOpen, openUnenroll, closeUnenroll] = useToggle(false);
  const resultsRef = useRef(null);

  const identifiers = parseIdentifiers(identifiersRaw);
  const submitting = enroll.isPending;

  // A new mutate clears both the field errors and the generic banner below,
  // as the old reset did.
  const { hasFieldErrors, fieldErrors } = extractFieldErrors(enroll.error, {
    courseId: 'course_id',
    identifiers: 'identifiers',
  });
  const error = enroll.error && !hasFieldErrors ? 'Something went wrong. Please try again.' : '';

  // Memoised so the scroll-into-view effect below fires once per completed
  // run rather than on every render.
  const results = useMemo(
    () => (enroll.isSuccess ? { action: enroll.variables.action, ...enroll.data } : null),
    [enroll.isSuccess, enroll.variables, enroll.data],
  );

  // Bring the outcome into view — the form can push the results below the
  // fold, so on completion scroll straight to the summary banner.
  useEffect(() => {
    // Optional-chain scrollIntoView: it's absent in jsdom (tests) and older browsers.
    if (results) {
      resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  const run = (action) => {
    enroll.mutate({
      action,
      payload: {
        course_id: courseId,
        identifiers,
        email_students: emailStudents,
        auto_enroll: autoEnroll,
        reason,
      },
    }, {
      // The confirm dialog closed in the old handler's `finally`, so it has
      // to close on failure too.
      onSettled: () => closeUnenroll(),
    });
  };

  const canSubmit = courseId.trim() && identifiers.length > 0 && !submitting;

  return (
    <Container size="lg" className="py-4">
      <h1 className="mb-3">Enrollment</h1>
      <p className="text-muted">
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
        <Form.Text>{identifiers.length} identifier(s)</Form.Text>
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
        <Form.Control value={reason} onChange={(e) => setReason(e.target.value)} />
      </Form.Group>

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
                <>, <strong>{results.failed_operations}</strong> failed — see the table below.</>
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
            <DataTable.EmptyTable content="No results" />
          </DataTable>
        </div>
      )}

      <ModalDialog title="Confirm unenroll" isOpen={isUnenrollOpen} onClose={closeUnenroll} hasCloseButton={false}>
        <ModalDialog.Header>
          <ModalDialog.Title>Unenroll {identifiers.length} learner(s)?</ModalDialog.Title>
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
