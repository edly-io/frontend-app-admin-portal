import React from 'react';
import { Container } from '@openedx/paragon';

/**
 * Neutral 404 shown to anyone who is not an EDL admin, and on any access
 * error while confirming admin status.
 *
 * Deliberately generic: it must NOT reveal that an admin portal exists, name
 * the `edl_admin` group, or render the portal nav. The API is the real
 * security boundary (every endpoint is IsEdlAdmin-gated and 403s); this is the
 * matching client-side posture — a non-admin sees a plain "page not found",
 * indistinguishable from a URL that was never served.
 */
const NotFound = () => (
  <Container size="lg" className="py-5 text-center">
    <h1 className="display-3 mb-3">404</h1>
    <p className="lead text-muted mb-0">
      The page you were looking for could not be found.
    </p>
  </Container>
);

export default NotFound;
