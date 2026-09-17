import React from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import CourseReportsPage from './CourseReportsPage';
import {
  getCourseReportDownloads, getCourseCertificates, triggerCourseReport, getCourseReports,
} from '../data/api';

jest.mock('../data/api', () => ({
  getCourseReportDownloads: jest.fn(),
  getCourseCertificates: jest.fn(),
  triggerCourseReport: jest.fn(),
  getCourseReports: jest.fn(),
}));

const COURSE_ID = 'course-v1:Org+A+2026';

const renderPage = () => renderWithProviders(
  <Routes>
    <Route path="/reporting/courses/:courseId" element={<CourseReportsPage />} />
  </Routes>,
  { route: `/reporting/courses/${encodeURIComponent(COURSE_ID)}` },
);

beforeEach(() => {
  jest.clearAllMocks();
  getCourseReportDownloads.mockResolvedValue({
    results: [{
      task_id: 't1',
      report_type: 'grade_csv',
      report_label: 'Grade Report',
      state: 'SUCCESS',
      created: '2026-05-04T09:07:00+00:00',
      download_url: 'https://s3/g.csv',
    }],
  });
  getCourseCertificates.mockResolvedValue({ count: 0, results: [] });
  triggerCourseReport.mockResolvedValue({ task_id: 't2', report_type: 'grade_csv' });
  getCourseReports.mockResolvedValue({
    count: 1,
    results: [{ course_id: COURSE_ID, display_name: 'Intro to Everything' }],
  });
});

describe('CourseReportsPage', () => {
  it('shows the decoded course id and existing downloads', async () => {
    renderPage();
    expect(await screen.findByText(COURSE_ID)).toBeInTheDocument();
    expect(screen.getByText('Grade Report')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute('href', 'https://s3/g.csv');
  });

  it('triggers a report with the decoded course id and refetches', async () => {
    renderPage();
    await screen.findByText('Grade Report');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    fireEvent.click(await screen.findByText('Profile Information'));
    await waitFor(() => expect(triggerCourseReport).toHaveBeenCalledWith(COURSE_ID, 'profile_info'));
    // Initial load = 1 call; a successful trigger refetches downloads.
    await waitFor(() => expect(getCourseReportDownloads).toHaveBeenCalledTimes(2));
  });

  it('shows immediate "Queuing…" feedback on click, before the request resolves', async () => {
    let resolveTrigger;
    triggerCourseReport.mockReturnValue(new Promise((resolve) => { resolveTrigger = resolve; }));
    renderPage();
    await screen.findByText('Grade Report');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    fireEvent.click(await screen.findByText('Profile Information'));

    expect(await screen.findByRole('button', { name: /Queuing/ })).toBeDisabled();

    resolveTrigger({ task_id: 't2', report_type: 'profile_info' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate report' })).not.toBeDisabled());
  });

  it('surfaces an already-running 400 error', async () => {
    triggerCourseReport.mockRejectedValue({
      customAttributes: { httpErrorStatus: 400 },
      response: { data: { detail: 'A report of this type is already running.' } },
    });
    renderPage();
    await screen.findByText('Grade Report');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    // 'Survey Results' only exists as a menu item (not in the downloads table).
    fireEvent.click(await screen.findByText('Survey Results'));
    expect(await screen.findByText('A report of this type is already running.')).toBeInTheDocument();
  });

  it('shows the course display name in the header alongside the id', async () => {
    renderPage();
    expect(await screen.findByText('Intro to Everything')).toBeInTheDocument();
    expect(screen.getByText(COURSE_ID)).toBeInTheDocument();
  });

  it('still renders the page with the id and no error alert when the name lookup fails', async () => {
    getCourseReports.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(COURSE_ID)).toBeInTheDocument();
    expect(screen.getByText('Grade Report')).toBeInTheDocument();
    expect(screen.queryByText('Could not load course reports.')).not.toBeInTheDocument();
  });

  it('paginates downloads to 10 rows with a table footer', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      task_id: `t${i}`,
      report_type: 'grade_csv',
      report_label: `Grade Report ${i}`,
      state: 'SUCCESS',
      created: '2026-05-04T09:07:00+00:00',
      download_url: `https://s3/g${i}.csv`,
    }));
    getCourseReportDownloads.mockResolvedValue({ results: rows });
    renderPage();
    await screen.findByText('Grade Report 0');
    expect(screen.getAllByText(/^Grade Report \d+$/)).toHaveLength(10);
    expect(screen.getAllByTestId('table-footer').length).toBeGreaterThan(0);
  });
});
