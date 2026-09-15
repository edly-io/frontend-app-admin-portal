/**
 * Cross-page tests for the data-fetching behaviour the React Query migration
 * had to preserve. Each of these was hand-rolled before the migration
 * (two-tier loading, conditional polling, debounce, race guards, the
 * dismissible single-error banner) and none of it was covered by the
 * per-page suites, which assert on rendered content rather than on when
 * requests are made and which failure is shown.
 */
import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor, act,
} from './test-utils';

import ReportingDashboardPage from './pages/ReportingDashboardPage';
import CourseReportsPage from './pages/CourseReportsPage';
import UsersPage from './pages/UsersPage';
import * as api from './data/api';

jest.mock('./data/api');
// recharts' ResponsiveContainer needs a real size; stub it to render children.
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  // eslint-disable-next-line react/prop-types
  const Stub = ({ children }) => <div>{children}</div>;
  return { ...Original, ResponsiveContainer: Stub };
});
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ courseId: 'course-v1:Org+A+2026' }),
}));

const SUMMARY = { total_learners: 100, running_courses: 15, generated_at: '2026-09-10T09:00:00+00:00' };
const TRENDS = { months: 12, enrollments: [], registrations: [] };
const BREAKDOWNS = { course_lifecycle: { running: 3 } };

beforeEach(() => {
  jest.clearAllMocks();
  api.getReportingSummary.mockResolvedValue(SUMMARY);
  api.getReportingTrends.mockResolvedValue(TRENDS);
  api.getReportingBreakdowns.mockResolvedValue(BREAKDOWNS);
  api.getCourseCertificates.mockResolvedValue({ results: [] });
  api.getUsers.mockResolvedValue({ count: 60, results: [{ username: 'alice', status: 'active' }] });
});

describe('dashboard trend-window change', () => {
  it('refetches ONLY trends and never shows the full-page spinner again', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');
    expect(api.getReportingSummary).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Trend window'), { target: { value: '6' } });

    await waitFor(() => expect(api.getReportingTrends).toHaveBeenCalledWith({ months: 6 }));
    // KPI values stay mounted: no full-page spinner, no unmounted charts.
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(api.getReportingSummary).toHaveBeenCalledTimes(1);
    expect(api.getReportingBreakdowns).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Loading reporting')).not.toBeInTheDocument();
  });

  it('keeps the last loaded values on screen when a refresh fails', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');

    api.getReportingSummary.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    fireEvent.click(screen.getByRole('button', { name: /refresh metrics/i }));

    expect(await screen.findByText(/Showing the last loaded values/)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('course-report polling', () => {
  const running = {
    results: [{
      task_id: 't1', report_label: 'Grade Report', state: 'IN_PROGRESS', created: null, download_url: null,
    }],
  };
  const done = {
    results: [{
      task_id: 't1', report_label: 'Grade Report', state: 'SUCCESS', created: null, download_url: 'u',
    }],
  };

  it('polls every 10s while a task runs and stops once it succeeds', async () => {
    jest.useFakeTimers();
    api.getCourseReportDownloads.mockResolvedValue(running);
    renderWithProviders(<CourseReportsPage />);
    await screen.findByText('IN_PROGRESS');
    expect(api.getCourseReportDownloads).toHaveBeenCalledTimes(1);

    api.getCourseReportDownloads.mockResolvedValue(done);
    await act(async () => { jest.advanceTimersByTime(10000); });
    await waitFor(() => expect(api.getCourseReportDownloads).toHaveBeenCalledTimes(2));
    await screen.findByText('SUCCESS');

    // Nothing is running any more: the interval must be gone.
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(api.getCourseReportDownloads).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe('users list', () => {
  it('keeps the previous rows under the alert when a filter change fails', async () => {
    renderWithProviders(<UsersPage />);
    await screen.findByText('alice');

    api.getUsers.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'disabled' } });

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('does not fire a request per keystroke', async () => {
    renderWithProviders(<UsersPage />);
    await screen.findByText('alice');
    expect(api.getUsers).toHaveBeenCalledTimes(1);

    const box = screen.getByPlaceholderText('name, username or email');
    fireEvent.change(box, { target: { value: 'a' } });
    fireEvent.change(box, { target: { value: 'al' } });
    fireEvent.change(box, { target: { value: 'ali' } });

    await waitFor(() => expect(api.getUsers).toHaveBeenCalledTimes(2));
    expect(api.getUsers).toHaveBeenLastCalledWith({ page: 1, page_size: 25, search: 'ali' });
  });
});

describe('error banner: most recent failure wins, and dismissal is per failure', () => {
  it('keeps the page on a failed trend-window change', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');

    api.getReportingTrends.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    fireEvent.change(screen.getByLabelText('Trend window'), { target: { value: '6' } });

    expect(await screen.findByText(/Showing the last loaded values/)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText(/Could not load reporting data/)).not.toBeInTheDocument();
  });

  it('replaces the whole page when the FIRST load fails', async () => {
    api.getReportingTrends.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    renderWithProviders(<ReportingDashboardPage />);
    expect(await screen.findByText(/Could not load reporting data/)).toBeInTheDocument();
  });

  it('does not leak force_refresh onto a trend-window change made mid-refresh', async () => {
    let releaseSummary;
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');

    api.getReportingSummary.mockReturnValue(new Promise((r) => { releaseSummary = r; }));
    fireEvent.click(screen.getByRole('button', { name: /refresh metrics/i }));
    await waitFor(() => expect(api.getReportingTrends)
      .toHaveBeenCalledWith({ months: 12, force_refresh: 1 }));

    // Still refreshing: summary has not resolved yet.
    fireEvent.change(screen.getByLabelText('Trend window'), { target: { value: '6' } });
    await waitFor(() => expect(api.getReportingTrends).toHaveBeenCalledWith({ months: 6 }));
    expect(api.getReportingTrends).not.toHaveBeenCalledWith({ months: 6, force_refresh: 1 });

    await act(async () => { releaseSummary(SUMMARY); });
  });

  it('re-shows a dismissed alert when the next filter fails too', async () => {
    renderWithProviders(<UsersPage />);
    await screen.findByText('alice');

    api.getUsers.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'disabled' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument());

    // A different filter is a different cache key, whose own error counter
    // restarts at zero. The alert must still appear.
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('clears a failed write once the list reloads, and never masks a newer read error', async () => {
    api.setUserActive.mockRejectedValue({ customAttributes: { httpErrorStatus: 500 } });
    renderWithProviders(<UsersPage />);
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const confirm = await screen.findAllByRole('button', { name: 'Deactivate' });
    fireEvent.click(confirm[confirm.length - 1]);
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();

    // A newer read failure must win over the older write failure.
    api.getUsers.mockRejectedValue({ customAttributes: { httpErrorStatus: 403 } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'disabled' } });
    expect(await screen.findByText('You do not have EDL admin access.')).toBeInTheDocument();

    // And a successful reload clears the write error, as the old single
    // `error` state did.
    api.getUsers.mockResolvedValue({ count: 1, results: [{ username: 'alice', status: 'active' }] });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
    await waitFor(() => expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument());
    expect(screen.queryByText('You do not have EDL admin access.')).not.toBeInTheDocument();
  });
});
