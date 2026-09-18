/**
 * KpiCard — a metric summary card: label, big value, optional delta badge, and
 * an optional sparkline slot. Colors come from Paragon CSS custom properties.
 *
 * Ported from the RWAQ admin MFE (KpiCard.tsx) to plain JSX + PropTypes, with
 * the i18n messages inlined (the admin-portal pages use plain strings).
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '@openedx/paragon';

const DeltaBadge = ({ delta }) => {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const abs = Math.abs(delta).toFixed(1);

  let colorStyle;
  let arrow;
  let srText;
  if (isPositive) {
    colorStyle = { color: 'var(--pgn-color-success-500, #178253)' };
    arrow = '▲';
    srText = `Increased by ${abs}%`;
  } else if (isNegative) {
    colorStyle = { color: 'var(--pgn-color-danger-500, #C00000)' };
    arrow = '▼';
    srText = `Decreased by ${abs}%`;
  } else {
    colorStyle = { color: 'var(--pgn-color-gray-500, #6B757F)' };
    arrow = '—';
    srText = 'No change';
  }

  return (
    <span
      style={{
        ...colorStyle,
        fontSize: '0.875rem',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        marginTop: '0.25rem',
      }}
      aria-label={srText}
    >
      <span aria-hidden="true">{arrow}</span>
      {!isPositive && !isNegative ? null : <span aria-hidden="true">{abs}%</span>}
      <span aria-hidden="true" style={{ color: 'var(--pgn-color-gray-500, #6B757F)', fontWeight: 400 }}>
        vs last month
      </span>
    </span>
  );
};

DeltaBadge.propTypes = { delta: PropTypes.number.isRequired };

const KpiCard = ({
  label, value, delta = undefined, sparkline = null, isLoading = false,
}) => (
  <Card className="h-100" style={{ borderRadius: 'var(--pgn-size-border-radius-lg, 0.5rem)' }}>
    <Card.Body className="d-flex flex-column justify-content-between p-3">
      <div>
        <p
          className="small text-uppercase mb-1"
          style={{ color: 'var(--pgn-color-gray-500, #6B757F)', letterSpacing: '0.04em', fontWeight: 600 }}
        >
          {label}
        </p>

        {isLoading ? (
          <div
            style={{
              width: '60%',
              height: '2rem',
              borderRadius: 4,
              background: 'var(--pgn-color-gray-100, #f0f0ef)',
            }}
            aria-busy="true"
            aria-label="Loading"
          />
        ) : (
          <>
            <p
              className="mb-0"
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--pgn-color-gray-700, #273F58)',
              }}
            >
              {value}
            </p>
            {delta !== undefined && delta !== null && <DeltaBadge delta={delta} />}
          </>
        )}
      </div>

      {sparkline && <div className="mt-2" style={{ height: '48px' }}>{sparkline}</div>}
    </Card.Body>
  </Card>
);

KpiCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  delta: PropTypes.number,
  sparkline: PropTypes.node,
  isLoading: PropTypes.bool,
};

export default KpiCard;
