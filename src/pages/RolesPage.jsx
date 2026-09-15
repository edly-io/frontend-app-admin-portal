import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container, Form, Button, Alert, ActionRow, Card,
} from '@openedx/paragon';

import { useRoles, useChangeRole } from '../data/hooks/roles';
import CourseIdField from '../components/CourseIdField';

// Role slugs are the wire values (submitted as-is); this is display-only.
const ROLE_LABELS = {
  instructor: 'Instructor',
  staff: 'Staff',
  limited_staff: 'Limited Staff',
};
const humanizeRole = (role) => ROLE_LABELS[role] || role;

const RolesPage = () => {
  const rolesQuery = useRoles();
  const changeRole = useChangeRole();

  const [courseId, setCourseId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [roleOverride, setRoleOverride] = useState('');
  const [action, setAction] = useState('allow');
  const [dismissedRolesErrorAt, setDismissedRolesErrorAt] = useState(0);

  const roles = rolesQuery.data?.roles || [];
  // Derived, not synced: the select defaults to the first role the catalog
  // returns until the user picks one.
  const role = roleOverride || roles[0]?.role || '';

  // DRF answers a bad grant with field-keyed errors; anything else is a
  // generic failure banner.
  const body = changeRole.error?.response?.data || {};
  const hasFieldErrors = !!(body.course_id || body.identifier || body.role);
  const fieldErrors = hasFieldErrors ? {
    courseId: [].concat(body.course_id || []).join(' '),
    identifier: [].concat(body.identifier || []).join(' '),
    role: [].concat(body.role || []).join(' '),
  } : {};

  let error = '';
  if (changeRole.error && !hasFieldErrors) {
    error = 'Something went wrong. Please try again.';
  } else if (rolesQuery.error && rolesQuery.errorUpdatedAt > dismissedRolesErrorAt) {
    error = 'Could not load the roles catalog.';
  }

  const granted = changeRole.isSuccess ? changeRole.data : null;
  const success = granted
    ? `${granted.action === 'allow' ? 'Granted' : 'Revoked'} “${granted.role}” for ${granted.username}.`
    : '';

  const onSubmit = (e) => {
    e.preventDefault();
    // The old handler cleared every banner before submitting. A new mutate
    // clears its own error and success; the catalog error is dismissed here.
    setDismissedRolesErrorAt(rolesQuery.errorUpdatedAt);
    changeRole.mutate({
      course_id: courseId, identifier, role, action,
    });
  };

  const selectedRole = roles.find((r) => r.role === role);

  return (
    <Container size="lg" className="py-4">
      <h1 className="mb-3">Staff &amp; Roles</h1>
      <p className="text-muted">
        Assign course-scoped roles. Staff accounts are created with the same{' '}
        <Link to="/users/new">Create user</Link> form. Site Admin / Global Staff are not grantable here.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success" dismissible onClose={() => changeRole.reset()}>
          {success}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Section title="Grantable roles">
          <ul className="mb-0">
            {roles.map((r) => (
              <li key={r.role}><strong>{humanizeRole(r.role)}</strong>: {r.description}</li>
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
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            isInvalid={!!fieldErrors.identifier}
          />
          {fieldErrors.identifier && <Form.Control.Feedback type="invalid">{fieldErrors.identifier}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group>
          <Form.Label>Role</Form.Label>
          <Form.Control as="select" value={role} onChange={(e) => setRoleOverride(e.target.value)}>
            {roles.map((r) => <option key={r.role} value={r.role}>{humanizeRole(r.role)}</option>)}
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
            disabled={changeRole.isPending || !courseId.trim() || !identifier.trim() || !role}
          >
            {changeRole.isPending ? 'Working…' : 'Apply'}
          </Button>
        </ActionRow>
      </Form>
    </Container>
  );
};

export default RolesPage;
