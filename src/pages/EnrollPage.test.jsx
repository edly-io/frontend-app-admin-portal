import React from 'react';
import {
  renderWithProviders, screen, fireEvent, waitFor,
} from '../test-utils';

import EnrollPage from './EnrollPage';
import { updateEnrollments } from '../data/api';

jest.mock('../data/api', () => ({ updateEnrollments: jest.fn() }));

const COURSE = 'course-v1:Org+Course+Run';

const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('course-v1:Org+Course+Run'), { target: { value: COURSE } });
  fireEvent.change(
    screen.getByPlaceholderText(/One email or username per line/i),
    { target: { value: 'a@e.com\nbob' } },
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  updateEnrollments.mockResolvedValue({
    action: 'enroll',
    results: [{ identifier: 'a@e.com', success: true }, { identifier: 'bob', success: true }],
    successful_operations: 2,
    failed_operations: 0,
    total_students: 2,
  });
});

describe('EnrollPage', () => {
  it('enrolls identifiers and shows per-identifier results', async () => {
    renderWithProviders(<EnrollPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enroll' }));

    await waitFor(() => expect(updateEnrollments).toHaveBeenCalledWith('enroll', expect.objectContaining({
      course_id: COURSE,
      identifiers: ['a@e.com', 'bob'],
    })));
    expect(await screen.findByText(/2 ok, 0 failed/)).toBeInTheDocument();
    expect(screen.getByText('a@e.com')).toBeInTheDocument();
  });

  it('confirms before unenrolling', async () => {
    renderWithProviders(<EnrollPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Unenroll' }));

    // Confirmation modal
    expect(await screen.findByText('Unenroll 2 learner(s)?')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Unenroll' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(updateEnrollments).toHaveBeenCalledWith('unenroll', expect.any(Object)));
  });

  it('surfaces an invalid course error inline', async () => {
    updateEnrollments.mockRejectedValue({ response: { status: 400, data: { course_id: ['Invalid course id.'] } } });
    renderWithProviders(<EnrollPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enroll' }));
    expect(await screen.findByText('Invalid course id.')).toBeInTheDocument();
  });
});
