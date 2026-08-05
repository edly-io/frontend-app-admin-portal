import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container, Form, Button, Alert, ActionRow, Card,
} from '@openedx/paragon';

import { getRoles, changeRole } from '../data/api';

const RolesPage = () => {
  const [roles, setRoles] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('allow');

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRoles()
      .then((data) => {
        setRoles(data.roles || []);
        if (data.roles?.length) { setRole(data.roles[0].role); }
      })
      .catch(() => setError('Could not load the roles catalog.'));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setFieldErrors({});
    try {
      const data = await changeRole({
        course_id: courseId, identifier, role, action,
      });
      setSuccess(`${data.action === 'allow' ? 'Granted' : 'Revoked'} “${data.role}” for ${data.username}.`);
    } catch (err) {
      const body = err?.response?.data || {};
      if (body.course_id || body.identifier || body.role) {
        setFieldErrors({
          courseId: [].concat(body.course_id || []).join(' '),
          identifier: [].concat(body.identifier || []).join(' '),
          role: [].concat(body.role || []).join(' '),
        });
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRole = roles.find((r) => r.role === role);

  return (
    <Container size="lg" className="py-4">
      <h1 className="mb-3">Staff &amp; roles</h1>
      <p className="text-muted">
        Assign course-scoped roles. Staff accounts are created with the same{' '}
        <Link to="/users/new">Create user</Link> form. Site Admin / Global Staff are not grantable here.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Card className="mb-4">
        <Card.Section title="Grantable roles">
          <ul className="mb-0">
            {roles.map((r) => (
              <li key={r.role}><strong>{r.role}</strong> — {r.description}</li>
            ))}
          </ul>
        </Card.Section>
      </Card>

      <Form onSubmit={onSubmit}>
        <Form.Group>
          <Form.Label>Course run ID</Form.Label>
          <Form.Control
            placeholder="course-v1:Org+Course+Run"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            isInvalid={!!fieldErrors.courseId}
          />
          {fieldErrors.courseId && <Form.Control.Feedback type="invalid">{fieldErrors.courseId}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group>
          <Form.Label>User (email or username)</Form.Label>
          <Form.Control
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            isInvalid={!!fieldErrors.identifier}
          />
          {fieldErrors.identifier && <Form.Control.Feedback type="invalid">{fieldErrors.identifier}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group>
          <Form.Label>Role</Form.Label>
          <Form.Control as="select" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
          </Form.Control>
          {selectedRole && <Form.Text>{selectedRole.description}</Form.Text>}
        </Form.Group>
        <Form.Group>
          <Form.Label>Action</Form.Label>
          <Form.RadioSet name="action" value={action} onChange={(e) => setAction(e.target.value)} isInline>
            <Form.Radio value="allow">Grant</Form.Radio>
            <Form.Radio value="revoke">Remove</Form.Radio>
          </Form.RadioSet>
        </Form.Group>
        <ActionRow>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !courseId.trim() || !identifier.trim() || !role}
          >
            {submitting ? 'Working…' : 'Apply'}
          </Button>
        </ActionRow>
      </Form>
    </Container>
  );
};

export default RolesPage;
