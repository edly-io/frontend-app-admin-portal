import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ModalDialog, Form, Button, Alert, ActionRow,
} from '@openedx/paragon';

import { createUser } from '../data/api';

const FIELDS = ['username', 'email', 'name'];
const BLANK = { username: '', email: '', name: '' };

/**
 * Create one learner/staff account.
 *
 * This is a modal rather than its own page so the directory stays visible
 * behind it: the admin keeps their search, filter and scroll position, and on
 * success the new account appears in the list they were already looking at.
 */
const CreateUserModal = ({ isOpen, onClose, onCreated = () => {} }) => {
  const [values, setValues] = useState(BLANK);
  const [fieldErrors, setFieldErrors] = useState({});
  const [nonFieldError, setNonFieldError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Closing the modal abandons any create that is still in flight. The
  // component stays mounted behind ModalLayer, so without this the resolving
  // request would write its result onto the form we just reset and the next
  // open would show the previous success panel or error.
  const submission = useRef(0);

  const setField = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const reset = () => {
    setValues(BLANK);
    setFieldErrors({});
    setNonFieldError('');
    setResult(null);
  };

  const close = () => {
    submission.current += 1;
    reset();
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const token = submission.current;
    setSubmitting(true);
    setFieldErrors({});
    setNonFieldError('');
    try {
      const created = await createUser(values);
      // The account exists either way, so the directory still refreshes.
      onCreated(created);
      if (submission.current !== token) { return; }
      setResult(created);
    } catch (err) {
      if (submission.current !== token) { return; }
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

  return (
    <ModalDialog title="Create user" isOpen={isOpen} onClose={close} hasCloseButton>
      <ModalDialog.Header>
        <ModalDialog.Title>{result ? `${result.username} created` : 'Create user'}</ModalDialog.Title>
      </ModalDialog.Header>

      {result ? (
        <>
          <ModalDialog.Body>
            <Alert variant="success" className="mb-0">
              <p>Email: {result.email} · Status: {result.status}</p>
              {result.password ? (
                <p className="mb-0">
                  One-time password (copy it now, it won&apos;t be shown again):{' '}
                  <code>{result.password}</code>
                </p>
              ) : (
                <p className="mb-0">A set-password link has been emailed to the learner.</p>
              )}
            </Alert>
          </ModalDialog.Body>
          <ModalDialog.Footer>
            <ActionRow>
              <Button variant="tertiary" onClick={reset}>Create another</Button>
              <Button variant="primary" onClick={close}>Done</Button>
            </ActionRow>
          </ModalDialog.Footer>
        </>
      ) : (
        <Form onSubmit={onSubmit}>
          <ModalDialog.Body>
            <p className="text-muted">
              Creates one learner/staff account. Duplicate email or username is rejected inline.
            </p>

            {nonFieldError && <Alert variant="danger">{nonFieldError}</Alert>}

            <Form.Group controlId="username">
              <Form.Label>Username</Form.Label>
              <Form.Control placeholder="jsmith" value={values.username} onChange={setField('username')} isInvalid={!!fieldErrors.username} />
              {fieldErrors.username && <Form.Control.Feedback type="invalid">{fieldErrors.username}</Form.Control.Feedback>}
            </Form.Group>
            <Form.Group controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control placeholder="name@school.edu" type="email" value={values.email} onChange={setField('email')} isInvalid={!!fieldErrors.email} />
              {fieldErrors.email && <Form.Control.Feedback type="invalid">{fieldErrors.email}</Form.Control.Feedback>}
            </Form.Group>
            <Form.Group controlId="name">
              <Form.Label>Full name</Form.Label>
              <Form.Control placeholder="Jane Smith" value={values.name} onChange={setField('name')} isInvalid={!!fieldErrors.name} />
              {fieldErrors.name && <Form.Control.Feedback type="invalid">{fieldErrors.name}</Form.Control.Feedback>}
            </Form.Group>
          </ModalDialog.Body>
          <ModalDialog.Footer>
            <ActionRow>
              <Button variant="tertiary" onClick={close} disabled={submitting}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create user'}
              </Button>
            </ActionRow>
          </ModalDialog.Footer>
        </Form>
      )}
    </ModalDialog>
  );
};

CreateUserModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
};

export default CreateUserModal;
