import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, Card, Alert, Spinner, Button, Form,
} from '@openedx/paragon';
import { Refresh } from '@openedx/paragon/icons';

import { getReportingSummary, getReportingTrends, getReportingBreakdowns } from '../data/api';
import KpiCard from '../components/KpiCard';
import MetricChart from '../components/MetricChart';

const fmt = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString());

// Backend trends are [{period, value}]; MetricChart wants [{name, value}].
const toChartData = (series) => (series || []).map((p) => ({ name: p.period, value: p.value }));

// Matches the backend's clamp_months range (1..MAX_TREND_MONTHS=24).
const TREND_WINDOW_OPTIONS = [
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
];

const ChartCard = ({ title, children }) => (
  <Card className="h-100">
    <Card.Body className="pt-4">
      <h3 className="h5 mb-3 pl-1">{title}</h3>
      {children}
    </Card.Body>
  </Card>
);

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const ReportingDashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [breakdowns, setBreakdowns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(12);
  const mountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // The very first fetch shows the full-page spinner; every later one (the
  // Refresh button, or picking a different trend window) is a soft reload
  // that keeps the page visible and only flags the KPI cards as loading.
  const load = useCallback((bypassCache = false) => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    hasLoadedOnceRef.current = true;
    const params = bypassCache ? { force_refresh: 1 } : {};
    (isFirstLoad ? setLoading : setRefreshing)(true);
    return Promise.all([
      getReportingSummary(params),
      getReportingTrends({ months, ...params }),
      getReportingBreakdowns(params),
    ])
      .then(([s, t, b]) => {
        if (!mountedRef.current) { return; }
        setSummary(s);
        setTrends(t);
        setBreakdowns(b);
        setError(null);
      })
      .catch((e) => mountedRef.current && setError(e))
      .finally(() => {
        if (!mountedRef.current) { return; }
        (isFirstLoad ? setLoading : setRefreshing)(false);
      });
  }, [months]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" screenReaderText="Loading reporting" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        {error.customAttributes?.httpErrorStatus === 403
          ? 'You do not have EDL admin access.'
          : 'Could not load reporting data. Please try again.'}
      </Alert>
    );
  }

  const lifecycle = breakdowns?.course_lifecycle || {};
  const lifecycleData = [
    { name: 'Running', value: lifecycle.running || 0 },
    { name: 'Upcoming', value: lifecycle.upcoming || 0 },
    { name: 'Ended', value: lifecycle.ended || 0 },
    { name: 'No dates', value: lifecycle.no_dates || 0 },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-end flex-wrap mb-4" style={{ gap: '1rem' }}>
        {summary?.generated_at ? (
          <p className="text-muted small mb-0">
            Data as of {new Date(summary.generated_at).toLocaleString()}
          </p>
        ) : <span />}
        <div className="d-flex align-items-end" style={{ gap: '1rem' }}>
          <Form.Group className="mb-0" controlId="trend-window-filter">
            <Form.Label className="small text-muted mb-1">Trend window</Form.Label>
            <Form.Control
              as="select"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              {TREND_WINDOW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Form.Control>
          </Form.Group>
          <Button
            variant="outline-primary"
            size="sm"
            iconBefore={Refresh}
            disabled={refreshing}
            onClick={() => load(true)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh metrics'}
          </Button>
        </div>
      </div>

      <Row className="mb-4">
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Total learners" value={fmt(summary?.total_learners)} isLoading={refreshing} />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard
            label="New registrations"
            value={fmt(summary?.new_registrations_this_month)}
            delta={summary?.new_registrations_delta_pct ?? undefined}
            isLoading={refreshing}
          />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Total courses" value={fmt(summary?.total_courses)} isLoading={refreshing} />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Running courses" value={fmt(summary?.running_courses)} isLoading={refreshing} />
        </Col>
        <Col xs={6} md={4} lg>
          <KpiCard label="Active enrollments" value={fmt(summary?.active_enrollments)} isLoading={refreshing} />
        </Col>
      </Row>

      <Row className="mb-4">
        <Col xs={12}>
          <ChartCard title={`Enrollment trend (${months} months)`}>
            <MetricChart
              type="bar"
              data={toChartData(trends?.enrollments)}
              ariaLabel={`Enrollment trend over the last ${months} months`}
              height={280}
            />
          </ChartCard>
        </Col>
      </Row>

      <Row>
        <Col xs={12} lg={8} className="mb-3 mb-lg-0">
          <ChartCard title={`Registration trend (${months} months)`}>
            <MetricChart
              type="line"
              data={toChartData(trends?.registrations)}
              ariaLabel={`Registration trend over the last ${months} months`}
              height={220}
            />
          </ChartCard>
        </Col>
        <Col xs={12} lg={4}>
          <ChartCard title="Course status">
            <MetricChart
              type="donut"
              data={lifecycleData}
              ariaLabel="Course runs by lifecycle state"
              height={220}
            />
          </ChartCard>
        </Col>
      </Row> 
    </>
  );
};

export default ReportingDashboardPage;
