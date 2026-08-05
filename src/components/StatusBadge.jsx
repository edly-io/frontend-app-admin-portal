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

const StatusBadge = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status] || 'light'}>{STATUS_LABELS[status] || status}</Badge>
);

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

export default StatusBadge;
