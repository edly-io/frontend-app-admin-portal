import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor, within,
} from '../test-utils';

import ReportingCoursesPage from './ReportingCoursesPage';
import { getCourseReports } from '../data/api';
import { formatDate } from '../utils/formatDate';

jest.mock('../data/api', () => ({
  getCourseReports: jest.fn(),
}));

const COURSES = {
  count: 2,
  results: [
    {
      course_id: 'course-v1:Org+A+2026',
      display_name: 'Algebra',
      org: 'Org',
      enrollment_count: 30,
      unenrolled_count: 2,
      lifecycle_state: 'running',
      created: '2026-01-15T09:00:00+00:00',
    },
    {
      course_id: 'course-v1:Org+B+2026',
      display_name: 'Biology',
      org: 'Org',
      enrollment_count: 10,
      unenrolled_count: 0,
      lifecycle_state: 'ended',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getCourseReports.mockResolvedValue(COURSES);
});

describe('ReportingCoursesPage', () => {
  it('lists courses with enrollment counts and state badges', async () => {
    renderWithProviders(<ReportingCoursesPage />);
    expect(await screen.findByText('Algebra')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Running')).toBeInTheDocument();
    expect(within(table).getByText('Ended')).toBeInTheDocument();
    expect(within(table).getByText('30')).toBeInTheDocument();
  });

  it('shows the course key and creation date, with a dash when creation date is missing', async () => {
    renderWithProviders(<ReportingCoursesPage />);
    await screen.findByText('Algebra');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Key')).toBeInTheDocument();
    expect(within(table).getByText('course-v1:Org+A+2026')).toBeInTheDocument();
    expect(within(table).getByText('Creation Date')).toBeInTheDocument();
    expect(within(table).getByText(formatDate('2026-01-15T09:00:00+00:00'))).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('links each course to its report detail page (encoded id)', async () => {
    renderWithProviders(<ReportingCoursesPage />);
    const link = await screen.findByRole('link', { name: 'Algebra' });
    expect(link).toHaveAttribute(
      'href',
      '/reporting/courses/course-v1%3AOrg%2BA%2B2026',
    );
  });

  it('passes the search term to the API', async () => {
    renderWithProviders(<ReportingCoursesPage />);
    await screen.findByText('Algebra');
    fireEvent.change(screen.getByPlaceholderText('course name, id or org'), { target: { value: 'alg' } });
    await waitFor(() => expect(getCourseReports).toHaveBeenCalledWith(expect.objectContaining({ search: 'alg' })));
  });
});
