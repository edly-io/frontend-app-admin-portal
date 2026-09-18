import React from 'react';
import PropTypes from 'prop-types';
import { Icon } from '@openedx/paragon';
import { InfoOutline } from '@openedx/paragon/icons';

/**
 * Empty-table content: an icon, a line saying what is missing, and an optional
 * line saying what to do about it. Passed to `DataTable.EmptyTable`'s `content`,
 * which accepts a node, so it renders inside the table's own empty row.
 */
const EmptyState = ({ message, hint = '' }) => (
  <div className="d-flex flex-column align-items-center text-center">
    <Icon src={InfoOutline} size="sm" className="text-muted mb-1" />
    <p className="mb-0">{message}</p>
    {hint && <p className="text-muted small mb-0 mt-1">{hint}</p>}
  </div>
);

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
  hint: PropTypes.string,
};

export default EmptyState;
