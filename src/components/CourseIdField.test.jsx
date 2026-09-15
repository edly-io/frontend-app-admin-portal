import React, { useState } from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import CourseIdField from './CourseIdField';
import { getCourseReports } from '../data/api';

jest.mock('../data/api', () => ({ getCourseReports: jest.fn() }));

// CourseIdField is controlled; wrap it so typing/selecting actually updates value.
const Wrapper = () => {
  const [value, setValue] = useState('');
  return <CourseIdField controlId="test-course-id" value={value} onChange={setValue} />;
};

beforeEach(() => {
  jest.clearAllMocks();
  getCourseReports.mockResolvedValue({
    results: [
      { course_id: 'course-v1:Org+A+2026', display_name: 'Algebra' },
      { course_id: 'course-v1:Org+B+2026', display_name: 'Biology' },
    ],
  });
});

describe('CourseIdField', () => {
  it('does not search on an empty value', async () => {
    renderWithProviders(<Wrapper />);
    await new Promise((r) => { setTimeout(r, 350); });
    expect(getCourseReports).not.toHaveBeenCalled();
  });

  it('searches (debounced) as the user types and shows matching suggestions', async () => {
    renderWithProviders(<Wrapper />);
    fireEvent.change(screen.getByPlaceholderText('course-v1:Org+Course+Run'), { target: { value: 'alg' } });

    await waitFor(() => expect(getCourseReports).toHaveBeenCalledWith({ search: 'alg', page: 1 }));
    expect(await screen.findByText('Algebra')).toBeInTheDocument();
    expect(screen.getByText('Biology')).toBeInTheDocument();
  });

  it('selecting a suggestion fills the field with its course id', async () => {
    renderWithProviders(<Wrapper />);
    const input = screen.getByPlaceholderText('course-v1:Org+Course+Run');
    fireEvent.change(input, { target: { value: 'alg' } });

    fireEvent.click(await screen.findByText('Algebra'));

    expect(input).toHaveValue('course-v1:Org+A+2026');
  });

  it('keeps a typed value with no matching suggestion (free text still works)', async () => {
    getCourseReports.mockResolvedValue({ results: [] });
    renderWithProviders(<Wrapper />);
    const input = screen.getByPlaceholderText('course-v1:Org+Course+Run');
    fireEvent.change(input, { target: { value: 'course-v1:Unlisted+Course+Run' } });

    await waitFor(() => expect(getCourseReports).toHaveBeenCalled());
    expect(input).toHaveValue('course-v1:Unlisted+Course+Run');
    expect(screen.queryByRole('button', { name: /Algebra|Biology/ })).not.toBeInTheDocument();
  });
});
