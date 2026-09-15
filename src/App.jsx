import React, { useContext, useEffect } from 'react';
import {
  Routes, Route, NavLink,
} from 'react-router-dom';
import { getConfig } from '@edx/frontend-platform';
import { AppContext } from '@edx/frontend-platform/react';
import {
  Navbar, Container, Nav, Dropdown, Spinner,
} from '@openedx/paragon';

import { useMe } from './data/hooks/me';
import NotFound from './components/NotFound';
import UsersPage from './pages/UsersPage';
import CreateUserPage from './pages/CreateUserPage';
import EnrollPage from './pages/EnrollPage';
import RolesPage from './pages/RolesPage';
import ReportingLayout from './pages/ReportingLayout';
import ReportingDashboardPage from './pages/ReportingDashboardPage';
import ReportingCoursesPage from './pages/ReportingCoursesPage';
import CourseReportsPage from './pages/CourseReportsPage';

const Header = () => {
  const { authenticatedUser } = useContext(AppContext);
  const config = getConfig();
  return (
    <Navbar expand="lg" className="border-bottom mb-2" bg="white">
      <Container size="xl">
        <Navbar.Brand as={NavLink} to="/">
          <img className="logo-image" src={config.LOGO_URL} alt={config.SITE_NAME || 'Open edX'} height="40" />
        </Navbar.Brand>
        <Nav className="mr-auto">
          <Nav.Link as={NavLink} to="/" end>Users</Nav.Link>
          <Nav.Link as={NavLink} to="/enroll">Enrollment</Nav.Link>
          <Nav.Link as={NavLink} to="/staff">Staff &amp; Roles</Nav.Link>
          <Nav.Link as={NavLink} to="/reporting">Reports</Nav.Link>
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
  const { isPending, isError } = useMe();

  // 'loading' | 'ok' | 'blocked'
  // Fail CLOSED. /me/ is IsEdlAdmin-gated, so a 403 means "not an admin".
  // We also treat EVERY other error (401, 404, network/CORS, 5xx) as
  // blocked rather than falling through to 'ok' — otherwise a non-admin
  // (or anyone hitting a transient error) would see the portal shell. The
  // portal must not be discoverable by non-admins.
  let gate = 'ok';
  if (isPending) {
    gate = 'loading';
  } else if (isError) {
    gate = 'blocked';
  }

  useEffect(() => {
    // Keep the tab title neutral until we've confirmed admin access, so a
    // blocked user never even sees "Admin Portal" in the tab.
    if (gate === 'ok') {
      document.title = 'Admin Portal';
    } else if (gate === 'blocked') {
      document.title = 'Page not found';
    }
  }, [gate]);

  if (gate === 'loading') {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" screenReaderText="Loading" />
      </div>
    );
  }

  if (gate === 'blocked') {
    return <NotFound />;
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
          <Route path="/reporting" element={<ReportingLayout />}>
            <Route index element={<ReportingDashboardPage />} />
            <Route path="courses" element={<ReportingCoursesPage />} />
          </Route>
          <Route path="/reporting/courses/:courseId" element={<CourseReportsPage />} />
        </Routes>
      </main>
    </>
  );
};

export default App;
