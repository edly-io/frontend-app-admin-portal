import React, { useContext, useEffect, useState } from 'react';
import {
  Routes, Route, NavLink, Link,
} from 'react-router-dom';
import { getConfig } from '@edx/frontend-platform';
import { AppContext } from '@edx/frontend-platform/react';
import {
  Navbar, Container, Nav, Dropdown, Spinner,
} from '@openedx/paragon';

import { getMe } from './data/api';
import AccessDenied from './components/AccessDenied';
import UsersPage from './pages/UsersPage';
import CreateUserPage from './pages/CreateUserPage';
import EnrollPage from './pages/EnrollPage';
import RolesPage from './pages/RolesPage';

const Header = () => {
  const { authenticatedUser } = useContext(AppContext);
  const config = getConfig();
  return (
    <Navbar expand="lg" className="border-bottom mb-2" bg="white">
      <Container size="xl">
        <Navbar.Brand as={Link} to="/">{config.SITE_NAME || 'EDL Panel'}</Navbar.Brand>
        <Nav className="mr-auto">
          <Nav.Link as={NavLink} to="/" end>Users</Nav.Link>
          <Nav.Link as={NavLink} to="/enroll">Enrollment</Nav.Link>
          <Nav.Link as={NavLink} to="/staff">Staff &amp; roles</Nav.Link>
        </Nav>
        {authenticatedUser && (
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary" id="edl-user-menu">
              {authenticatedUser.username}
            </Dropdown.Toggle>
            <Dropdown.Menu alignRight>
              <Dropdown.Item href={config.LOGOUT_URL}>Sign out</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
      </Container>
    </Navbar>
  );
};

const App = () => {
  // 'loading' | 'ok' | 'denied'
  const [gate, setGate] = useState('loading');

  useEffect(() => {
    getMe()
      .then(() => setGate('ok'))
      // 403 => authenticated non-admin. Other errors: let pages surface them.
      .catch((e) => setGate(e?.response?.status === 403 ? 'denied' : 'ok'));
  }, []);

  if (gate === 'loading') {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" screenReaderText="Loading" />
      </div>
    );
  }

  if (gate === 'denied') {
    return <AccessDenied />;
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<UsersPage />} />
          <Route path="/users/new" element={<CreateUserPage />} />
          <Route path="/enroll" element={<EnrollPage />} />
          <Route path="/staff" element={<RolesPage />} />
        </Routes>
      </main>
    </>
  );
};

export default App;
