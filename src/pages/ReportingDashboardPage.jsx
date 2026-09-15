import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, Card, Alert, Spinner, Button, Form,
} from '@openedx/paragon';
import { Refresh } from '@openedx/paragon/icons';

import { useReportingDashboard } from '../data/hooks/reporting';
import KpiCard from '../components/KpiCard';
import MetricChart from '../components/MetricChart';
import { formatDateTime } from '../utils/formatDate';

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
    <Card.Body className="pt-3">
      <h3 className="h5 mb-3 pl-3">{title}</h3>
      {children}
    </Card.Body>
  </Card>
);

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const ReportingDashboardPage = () => {
  const [months, setMonths] = useState(12);

  // The very first fetch shows the full-page spinner; every later one (the
  // Refresh button, or picking a different trend window) is a soft reload
  // that keeps the page visible and only flags the KPI cards as loading.
  const {
    summary, trends, breakdowns,
    isLoading, isRefreshing, isSummaryFetching, hasAllData, error, refresh,
  } = useReportingDashboard(months);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" screenReaderText="Loading reporting" />
      </div>
    );
  }

  // A failed FIRST load has no data to show, so it replaces the page. A
  // failed soft reload (Refresh button, trend-window change) keeps the
  // last-good data on screen and only surfaces an inline alert above it.
  if (error && !hasAllData) {
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
      {error && hasAllData && (
        <Alert variant="danger" className="mb-4">
          Could not refresh reporting data. Showing the last loaded values.
        </Alert>
      )}
      <div className="d-flex justify-content-between align-items-end flex-wrap mb-4" style={{ gap: '1rem' }}>
        {summary?.generated_at ? (
          <p className="text-muted small mb-0">
            Data as of {formatDateTime(summary.generated_at)}
          </p>
        ) : <span />}
        <Button
          variant="outline-primary"
          size="sm"
          iconBefore={Refresh}
          disabled={isRefreshing}
          onClick={() => refresh()}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh metrics'}
        </Button>
      </div>

      <Row className="mb-4">
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Total learners" value={fmt(summary?.total_learners)} isLoading={isSummaryFetching} />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard
            label="New registrations"
            value={fmt(summary?.new_registrations_this_month)}
            delta={summary?.new_registrations_delta_pct ?? undefined}
            isLoading={isSummaryFetching}
          />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Total courses" value={fmt(summary?.total_courses)} isLoading={isSummaryFetching} />
        </Col>
        <Col xs={6} md={4} lg className="mb-3 mb-lg-0">
          <KpiCard label="Running courses" value={fmt(summary?.running_courses)} isLoading={isSummaryFetching} />
        </Col>
        <Col xs={6} md={4} lg>
          <KpiCard label="Active enrollments" value={fmt(summary?.active_enrollments)} isLoading={isSummaryFetching} />
        </Col>
      </Row>

      <div className="d-flex justify-content-end mb-2">
        <Form.Group className="mb-0" controlId="trend-window-filter">
          <Form.Label className="small text-muted mb-1 mr-2">Trend window</Form.Label>
          <Form.Control
            as="select"
            size="sm"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {TREND_WINDOW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Form.Control>
        </Form.Group>
      </div>

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
