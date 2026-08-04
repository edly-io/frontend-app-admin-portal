import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { getConfig } from '@openedx/frontend-platform';
import { AppContext } from '@openedx/frontend-platform/react';
import {
  Navbar, Container, Dropdown,
} from '@openedx/paragon';

import PanelPage from './pages/PanelPage';

/**
 * Branded chrome built from Paragon so it shares the Open edX design system
 * (tokens/typography/components) with the other MFEs. The shared
 * @edx/frontend-component-header/footer can be swapped in later without
 * touching page code.
 */
function PanelHeader() {
  const { authenticatedUser } = React.useContext(AppContext);
  const config = getConfig();
  return (
    <Navbar expand="lg" className="border-bottom" aria-label="EDL Panel">
      <Container size="xl">
        <Navbar.Brand href={config.PUBLIC_PATH}>{config.SITE_NAME}</Navbar.Brand>
        {authenticatedUser && (
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary" id="edl-user-menu">
              {authenticatedUser.username}
            </Dropdown.Toggle>
            <Dropdown.Menu align="right">
              <Dropdown.Item href={config.LOGOUT_URL}>Sign out</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
      </Container>
    </Navbar>
  );
}

export default function App() {
  return (
    <>
      <PanelHeader />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<PanelPage />} />
        </Routes>
      </main>
    </>
  );
}
