import React from 'react';
import { Container, Alert } from '@openedx/paragon';

/** EDL-12: shown when the current user is authenticated but not an EDL admin. */
const AccessDenied = () => (
  <Container size="lg" className="py-5">
    <Alert variant="danger">
      <Alert.Heading>Access denied</Alert.Heading>
      <p className="mb-0">
        You do not have EDL admin access. Ask a platform administrator to add
        your account to the <code>edl_admin</code> group.
      </p>
    </Alert>
  </Container>
);

export default AccessDenied;
