import React from 'react';
import { render, screen } from '@testing-library/react';
import AccessDenied from './AccessDenied';

describe('AccessDenied', () => {
  it('explains the missing edl_admin access', () => {
    render(<AccessDenied />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.getByText(/edl_admin/)).toBeInTheDocument();
  });
});
