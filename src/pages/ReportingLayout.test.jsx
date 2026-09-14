import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, screen, fireEvent } from '../test-utils';

import ReportingLayout from './ReportingLayout';

// Paragon's Tabs measures overflow with ResizeObserver, which jsdom lacks.
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}

  unobserve() {}

  disconnect() {}
};

const DashboardStub = () => <div>dashboard content</div>;
const CoursesStub = () => <div>courses content</div>;

const renderLayout = (route) => renderWithProviders(
  <Routes>
    <Route path="/reporting" element={<ReportingLayout />}>
      <Route index element={<DashboardStub />} />
      <Route path="courses" element={<CoursesStub />} />
    </Route>
  </Routes>,
  { route },
);

describe('ReportingLayout', () => {
  it('shows the dashboard tab as active on /reporting', () => {
    renderLayout('/reporting');
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the courses tab as active on /reporting/courses', () => {
    renderLayout('/reporting/courses');
    expect(screen.getByText('courses content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Courses' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates to courses when the Courses tab is clicked', () => {
    renderLayout('/reporting');
    fireEvent.click(screen.getByRole('tab', { name: 'Courses' }));
    expect(screen.getByText('courses content')).toBeInTheDocument();
  });
});
