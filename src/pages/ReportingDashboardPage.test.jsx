import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import ReportingDashboardPage from './ReportingDashboardPage';
import { getReportingSummary, getReportingTrends, getReportingBreakdowns } from '../data/api';

jest.mock('../data/api', () => ({
  getReportingSummary: jest.fn(),
  getReportingTrends: jest.fn(),
  getReportingBreakdowns: jest.fn(),
}));

// recharts' ResponsiveContainer needs a real size; stub it to render children.
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  // eslint-disable-next-line react/prop-types
  const Stub = ({ children }) => <div>{children}</div>;
  return { ...Original, ResponsiveContainer: Stub };
});

const SUMMARY = {
  total_learners: 100,
  new_registrations_this_month: 12,
  new_registrations_previous_month: 8,
  new_registrations_delta_pct: 50.0,
  total_courses: 20,
  running_courses: 15,
  active_enrollments: 42,
  generated_at: '2026-09-10T09:00:00+00:00',
};
const TRENDS = {
  months: 12,
  enrollments: [{ period: '2026-09', value: 5 }],
  registrations: [{ period: '2026-09', value: 3 }],
};
const BREAKDOWNS = {
  course_lifecycle: {
    no_dates: 1, upcoming: 2, running: 3, ended: 4,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  getReportingSummary.mockResolvedValue(SUMMARY);
  getReportingTrends.mockResolvedValue(TRENDS);
  getReportingBreakdowns.mockResolvedValue(BREAKDOWNS);
});

describe('ReportingDashboardPage', () => {
  it('renders KPI values from the summary endpoint', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    expect(await screen.findByText('100')).toBeInTheDocument(); // total learners
    expect(screen.getByText('Total learners')).toBeInTheDocument();
    expect(screen.getByText('Running courses')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('requests a 12-month trend window', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');
    expect(getReportingTrends).toHaveBeenCalledWith({ months: 12 });
  });

  it('shows an access error on 403', async () => {
    getReportingSummary.mockRejectedValue({ customAttributes: { httpErrorStatus: 403 } });
    renderWithProviders(<ReportingDashboardPage />);
    expect(await screen.findByText('You do not have EDL admin access.')).toBeInTheDocument();
  });

  it('refetches trends with the selected window when the trend filter changes', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');

    fireEvent.change(screen.getByLabelText('Trend window'), { target: { value: '6' } });

    await waitFor(() => expect(getReportingTrends).toHaveBeenCalledWith({ months: 6 }));
  });

  it('refetches with force_refresh when the refresh button is clicked', async () => {
    renderWithProviders(<ReportingDashboardPage />);
    await screen.findByText('100');

    fireEvent.click(screen.getByRole('button', { name: /refresh metrics/i }));

    await waitFor(() => expect(getReportingSummary).toHaveBeenCalledWith({ force_refresh: 1 }));
    expect(getReportingTrends).toHaveBeenCalledWith({ months: 12, force_refresh: 1 });
    expect(getReportingBreakdowns).toHaveBeenCalledWith({ force_refresh: 1 });
  });
});
