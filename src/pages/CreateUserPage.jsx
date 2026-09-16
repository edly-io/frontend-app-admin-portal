import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container, Form, Button, Alert, ActionRow,
} from '@openedx/paragon';

import { useCreateUser } from '../data/hooks/users';
import { extractFieldErrors } from '../utils/extractFieldErrors';

// This form's field names are the ones DRF answers with.
const FIELD_MAP = { username: 'username', email: 'email', name: 'name' };

const CreateUserPage = () => {
  const navigate = useNavigate();
  const createUser = useCreateUser();
  const [values, setValues] = useState({ username: '', email: '', name: '' });

  const setField = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    createUser.mutate(values);
  };

  // A new mutate clears both of these on its own, which is what the explicit
  // reset at the top of the old handler did.
  const err = createUser.error;
  // Only a rejected submission carries per-field messages; any other failure
  // (and any other body) is reported as one generic banner.
  const status = err?.response?.status;
  const isRejectedSubmission = status === 400 || status === 409;
  const { hasFieldErrors, fieldErrors } = extractFieldErrors(
    isRejectedSubmission ? err : null,
    FIELD_MAP,
  );

  let nonFieldError = '';
  if (isRejectedSubmission) {
    const nonFieldMessages = [].concat(err.response.data?.non_field_errors || []).join(' ');
    if (nonFieldMessages) {
      nonFieldError = nonFieldMessages;
    } else if (!hasFieldErrors) {
      nonFieldError = 'Could not create the account. Please check the fields and try again.';
    }
  } else if (err) {
    nonFieldError = 'Something went wrong. Please try again.';
  }

  const result = createUser.data;
  if (result) {
    return (
      <Container size="md" className="py-4">
        <h1 className="mb-3">User created</h1>
        <Alert variant="success">
          <Alert.Heading>{result.username} created</Alert.Heading>
          <p>Email: {result.email} · Status: {result.status}</p>
          {result.password ? (
            <p className="mb-0">
              One-time password (copy it now — it won&apos;t be shown again):{' '}
              <code>{result.password}</code>
            </p>
          ) : (
            <p className="mb-0">A set-password link has been emailed to the learner.</p>
          )}
        </Alert>
        <ActionRow>
          <Button
            variant="tertiary"
            onClick={() => { createUser.reset(); setValues({ username: '', email: '', name: '' }); }}
          >
            Create another
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>Back to users</Button>
        </ActionRow>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-4">
      <h1 className="mb-3">Create user</h1>
      <p className="text-muted">Creates one learner/staff account. Duplicate email or username is rejected inline.</p>

      {nonFieldError && <Alert variant="danger">{nonFieldError}</Alert>}

      <Form onSubmit={onSubmit}>
        <Form.Group controlId="username">
          <Form.Label>Username</Form.Label>
          <Form.Control value={values.username} onChange={setField('username')} isInvalid={!!fieldErrors.username} />
          {fieldErrors.username && <Form.Control.Feedback type="invalid">{fieldErrors.username}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group controlId="email">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" value={values.email} onChange={setField('email')} isInvalid={!!fieldErrors.email} />
          {fieldErrors.email && <Form.Control.Feedback type="invalid">{fieldErrors.email}</Form.Control.Feedback>}
        </Form.Group>
        <Form.Group controlId="name">
          <Form.Label>Full name</Form.Label>
          <Form.Control value={values.name} onChange={setField('name')} isInvalid={!!fieldErrors.name} />
          {fieldErrors.name && <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>}
        </Form.Group>
        <ActionRow>
          <Button as={Link} to="/" variant="tertiary">Cancel</Button>
          <Button type="submit" variant="primary" disabled={createUser.isPending}>
            {createUser.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </ActionRow>
      </Form>
    </Container>
  );
};

export default CreateUserPage;
