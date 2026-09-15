/**
 * MetricChart — the ONLY file that imports from 'recharts'. Other components
 * import this wrapper; never recharts directly.
 *
 * Most colors are resolved from Paragon CSS custom properties at runtime so a
 * brand change re-themes charts without a rebuild (see getChartColors for the
 * one exception). Animation is disabled when the
 * viewer prefers reduced motion, and an sr-only <table> mirrors the data for
 * screen readers.
 *
 * Ported from the RWAQ admin MFE (MetricChart.tsx) to plain JSX + PropTypes.
 */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/** Read a Paragon CSS custom property from :root, or a fallback (e.g. in tests). */
export const resolveParagonToken = (token, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
};

/**
 * Brand-aligned chart palette. `primary-500` is skipped deliberately: some
 * themes (e.g. tutor-indigo) set it to a near-black brand color that's
 * correct for buttons/nav but illegible as a chart series, so series 1 uses
 * a fixed chart-safe green instead of resolving it from Paragon.
 */
export const getChartColors = () => [
  '#0D7D4D',
  resolveParagonToken('--pgn-color-info-500', '#0070D2'),
  resolveParagonToken('--pgn-color-warning-500', '#FFB81C'),
  resolveParagonToken('--pgn-color-danger-500', '#C00000'),
  resolveParagonToken('--pgn-color-success-500', '#178253'),
];

const usePrefersReducedMotion = () => {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined; // no matchMedia (SSR, older browsers, jsdom) -> assume motion OK
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mediaQuery.matches);
    const handler = (e) => setPrefers(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefers;
};

// Visually hidden but screen-reader-accessible. The hiding styles live on a
// wrapping <div>, not the <table> itself: a <table> defaults to
// table-layout: auto, where an explicit width/height is only a *minimum* —
// the browser still grows the table to fit its content (here, a full row per
// data point), so a 1px table still lays out at its natural, much larger,
// size. A <div> has no such quirk, so clipping happens one level up.
const VISUALLY_HIDDEN_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const AccessibleFallbackTable = ({ data, series }) => (
  <div style={VISUALLY_HIDDEN_STYLE}>
    <table>
      <caption>Chart data</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          {series.map((s) => <th key={s} scope="col">{s}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            {series.map((s) => <td key={s}>{row[s]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

AccessibleFallbackTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  series: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const MetricChart = ({
  type,
  data,
  series = ['value'],
  ariaLabel,
  height = 300,
  compact = false,
  hideLegend = false,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const colors = getChartColors();
  const chartProps = { isAnimationActive: !reducedMotion };

  const axisProps = compact ? {} : {
    xAxis: <XAxis dataKey="name" tick={{ fontSize: 12 }} />,
    yAxis: <YAxis tick={{ fontSize: 12 }} />,
    grid: <CartesianGrid strokeDasharray="3 3" stroke={resolveParagonToken('--pgn-color-gray-300', '#dee2e6')} />,
  };

  const renderContent = () => {
    if (type === 'line') {
      return (
        <LineChart data={data}>
          {!compact && axisProps.grid}
          {!compact && axisProps.xAxis}
          {!compact && axisProps.yAxis}
          <Tooltip />
          {!hideLegend && !compact && <Legend />}
          {series.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={!compact}
              {...chartProps}
            />
          ))}
        </LineChart>
      );
    }

    if (type === 'bar') {
      return (
        <BarChart data={data}>
          {!compact && axisProps.grid}
          {!compact && axisProps.xAxis}
          {!compact && axisProps.yAxis}
          <Tooltip />
          {!hideLegend && !compact && <Legend />}
          {series.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} {...chartProps} />
          ))}
        </BarChart>
      );
    }

    if (type === 'donut') {
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={series[0] ?? 'value'}
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            {...chartProps}
          >
            {data.map((entry, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          {!hideLegend && <Legend />}
        </PieChart>
      );
    }

    return null;
  };

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        {renderContent()}
      </ResponsiveContainer>
      <AccessibleFallbackTable data={data} series={series} />
    </div>
  );
};

MetricChart.propTypes = {
  type: PropTypes.oneOf(['line', 'bar', 'donut']).isRequired,
  data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  series: PropTypes.arrayOf(PropTypes.string),
  ariaLabel: PropTypes.string.isRequired,
  height: PropTypes.number,
  compact: PropTypes.bool,
  hideLegend: PropTypes.bool,
};

export default MetricChart;
