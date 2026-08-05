import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('maps status values to friendly labels', () => {
    const { rerender } = render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();

    rerender(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending invitation')).toBeInTheDocument();

    rerender(<StatusBadge status="disabled" />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('falls back to the raw value for unknown status', () => {
    render(<StatusBadge status="mystery" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});
