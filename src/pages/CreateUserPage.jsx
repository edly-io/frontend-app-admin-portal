import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container, Form, Button, Alert, ActionRow,
} from '@openedx/paragon';

import { createUser } from '../data/api';

const FIELDS = ['username', 'email', 'name'];

const CreateUserPage = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', email: '', name: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [nonFieldError, setNonFieldError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setNonFieldError('');
    try {
      setResult(await createUser(values));
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data || {};
      if (status === 409 || status === 400) {
        // DRF field-keyed errors: { field: [messages] }
        const fe = {};
        Object.entries(body).forEach(([k, msgs]) => {
          if (FIELDS.includes(k)) { fe[k] = Array.isArray(msgs) ? msgs.join(' ') : String(msgs); }
        });
        setFieldErrors(fe);
        if (body.non_field_errors) {
          setNonFieldError([].concat(body.non_field_errors).join(' '));
        } else if (Object.keys(fe).length === 0) {
          setNonFieldError('Could not create the account. Please check the fields and try again.');
        }
      } else {
        setNonFieldError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          <Button variant="tertiary" onClick={() => { setResult(null); setValues({ username: '', email: '', name: '' }); }}>
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
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create user'}
          </Button>
        </ActionRow>
      </Form>
    </Container>
  );
};

export default CreateUserPage;
