import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container, Form, Button, Alert, ActionRow, Card,
} from '@openedx/paragon';

import { getRoles, changeRole } from '../data/api';
import CourseIdField from '../components/CourseIdField';
import usePageTitle from '../hooks/usePageTitle';

// Role slugs are the wire values (submitted as-is); this is display-only.
const ROLE_LABELS = {
  instructor: 'Instructor',
  staff: 'Staff',
  limited_staff: 'Limited Staff',
};
const humanizeRole = (role) => ROLE_LABELS[role] || role;

/**
 * Backend descriptions are prefixed with their own role name ("Course Admin.
 * Full control..."), which for limited_staff matches our label exactly and
 * renders as "Limited Staff: Limited Staff. ...". Drop the prefix when it
 * repeats the label we already show.
 */
const describeRole = (role, description = '') => {
  const label = humanizeRole(role);
  return description.startsWith(`${label}.`)
    ? description.slice(label.length + 1).trim()
    : description;
};

const RolesPage = () => {
  usePageTitle('Staff & Roles');
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

  return (
    <Container size="lg" className="py-4">
      <h1 className="mb-3">Staff &amp; Roles</h1>
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
              <li key={r.role}><strong>{humanizeRole(r.role)}</strong>: {describeRole(r.role, r.description)}</li>
            ))}
          </ul>
        </Card.Section>
      </Card>

      <Form onSubmit={onSubmit}>
        <CourseIdField
          controlId="role-course-id"
          value={courseId}
          onChange={setCourseId}
          isInvalid={!!fieldErrors.courseId}
          feedback={fieldErrors.courseId}
        />
        <Form.Group controlId="role-identifier">
          <Form.Label>User (email or username)</Form.Label>
          <Form.Control
            placeholder="name@school.edu or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            isInvalid={!!fieldErrors.identifier}
          />
          {fieldErrors.identifier && <Form.Control.Feedback type="invalid">{fieldErrors.identifier}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group>
          <Form.Label>Role</Form.Label>
          <Form.Control as="select" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.role} value={r.role}>{humanizeRole(r.role)}</option>)}
          </Form.Control>

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
