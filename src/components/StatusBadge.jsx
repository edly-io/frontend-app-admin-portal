import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@openedx/paragon';

export const STATUS_VARIANTS = {
  active: 'success',
  pending: 'warning',
  disabled: 'danger',
};

export const STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending invitation',
  disabled: 'Disabled',
};

// A pending user whose set-password link has lapsed needs a new invitation.
const StatusBadge = ({ status, inviteExpired }) => {
  if (status === 'pending' && inviteExpired) {
    return <Badge variant="secondary">Invitation expired</Badge>;
  }
  return <Badge variant={STATUS_VARIANTS[status] || 'light'}>{STATUS_LABELS[status] || status}</Badge>;
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  inviteExpired: PropTypes.bool,
};

StatusBadge.defaultProps = {
  inviteExpired: false,
};

export default StatusBadge;
