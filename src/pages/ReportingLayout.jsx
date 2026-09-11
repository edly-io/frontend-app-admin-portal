import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Container, Tabs, Tab } from '@openedx/paragon';

const ReportingLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = location.pathname.startsWith('/reporting/courses') ? 'courses' : 'dashboard';

  return (
    <Container size="xl" className="py-4">
      <h1 className="mb-3">Reporting</h1>
      <Tabs
        id="reporting-tabs"
        activeKey={activeKey}
        onSelect={(key) => navigate(key === 'courses' ? '/reporting/courses' : '/reporting')}
        className="mb-4"
      >
        <Tab eventKey="dashboard" title="Dashboard" />
        <Tab eventKey="courses" title="Courses" />
      </Tabs>
      <Outlet />
    </Container>
  );
};

export default ReportingLayout;
