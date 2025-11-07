// src/pages/admin/Admin_Analytics.jsx
import './admin_analytics.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
  PieChart,
  Pie,
  Cell,
  Label,
} from 'recharts';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';

const normYear = (y) => (y || '').trim();

export const Admin_Analytics = () => {
  const [activeSection, setActiveSection] = useState('enrollmentForecast');
  const [selectedYear, setSelectedYear] = useState('SY 2025-2026');

  // Data
  const [overall, setOverall] = useState([]); // [{school_year, gender, headcount}]
  // UI
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [schemaName, setSchemaName] = useState('analytics');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setErrorMsg('');

      const fetchOverall = async (schema) => {
        const client = schema ? supabase.schema(schema) : supabase;
        const { data, error, status } = await client
          .from('v_bosy_gender_overall')
          .select('school_year, gender, headcount')
          .order('school_year', { ascending: true });
        return { data, error, status };
      };

      // Try analytics first
      let { data, error, status } = await fetchOverall('analytics');

      // Fallbacks: schema not exposed or relation missing or 406
      if (
        error &&
        (status === 406 ||
          error.message?.includes('schema must be one of') ||
          error.message?.includes('relation'))
      ) {
        const resp = await fetchOverall(null); // default/public
        data = resp.data;
        error = resp.error;
        status = resp.status;
        if (!error) setSchemaName('public');
      } else {
        setSchemaName('analytics');
      }

      if (!mounted) return;

      if (error) setErrorMsg(error.message || `HTTP ${status}`);
      setOverall(data || []);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [selectedYear]); // [web:81]

  // Pivot overall -> one row per SY with male/female/total
  const overallRows = useMemo(() => {
    const m = new Map();
    for (const r of overall) {
      const key = r.school_year;
      const row = m.get(key) || {
        school_year: key,
        male: 0,
        female: 0,
        total: 0,
      };
      if (r.gender === 'male') row.male = r.headcount;
      if (r.gender === 'female') row.female = r.headcount;
      if (r.gender === 'total') row.total = r.headcount;
      m.set(key, row);
    }
    return Array.from(m.values());
  }, [overall]); // [web:93]

  // Sorted copy for the table (earliest to latest)
  const overallRowsSorted = useMemo(() => {
    return [...overallRows].sort((a, b) =>
      a.school_year.localeCompare(b.school_year)
    );
  }, [overallRows]); // [web:93]

  // Latest completed actual year (pick last row with a positive total)
  const latestActual = useMemo(() => {
    const rows = overallRowsSorted.filter((r) => (r.total || 0) > 0);
    return rows.length ? rows[rows.length - 1] : null;
  }, [overallRowsSorted]); // [web:93]

  // Donut data for gender split
  const genderPieData = useMemo(() => {
    if (!latestActual) return [];
    return [
      { name: 'Female', value: latestActual.female, fill: '#f472b6' },
      { name: 'Male', value: latestActual.male, fill: '#60a5fa' },
    ];
  }, [latestActual]); // [web:93]

  // Always project SY 2025-2026 using linear trend across all prior years
  const forecast = useMemo(() => {
    const target = 'SY 2025-2026';
    const totals = overallRows
      .map((r) => ({ year: normYear(r.school_year), total: r.total || 0 }))
      .sort((a, b) => a.year.localeCompare(b.year));

    const hist = totals.filter((t) => t.year < target && t.total > 0);
    if (hist.length < 2) return { hasHistory: false, labelYear: target };

    const x = hist.map((_, i) => i);
    const y = hist.map((t) => t.total);
    const n = x.length;
    const sumX = x.reduce((s, v) => s + v, 0);
    const sumY = y.reduce((s, v) => s + v, 0);
    const sumXX = x.reduce((s, v) => s + v * v, 0);
    const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
    const denom = n * sumXX - sumX * sumX || 1;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const yhat = Math.round(intercept + slope * n);
    const lastActual = y[n - 1] || 0;
    const pct = lastActual
      ? Math.round((yhat / lastActual - 1) * 1000) / 10
      : 0;

    return { hasHistory: true, projected: yhat, pct, labelYear: target };
  }, [overallRows]); // [web:93]

  return (
    <>
      <LoadingPopup
        show={loading}
        message="Loading Please Wait..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      {/* Ensure parents can shrink so charts get real width */}
      <div className="analyticsContainer" style={{ minWidth: 0 }}>
        {activeSection === 'enrollmentForecast' && (
          <div className="enrollmentForecast" style={{ minWidth: 0 }}>
            <h2>Enrollment Forecast</h2>

            <div className="enrollmentForecastSorter" style={{ minWidth: 0 }}>
              <div className="sort">
                <label>School Year</label>
                {/* Dropdown controls only the projection card */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option>SY 2025-2026</option>
                </select>
              </div>
            </div>

            {errorMsg && <p style={{ color: '#ef4444' }}>{errorMsg}</p>}
            {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

            <div
              className="statChartContainer"
              style={{ width: '100%', minWidth: 0 }}
            >
              <div className="enrollmentForecastP1">
                {/* BOSY by Gender (All Grades) */}
                <div
                  className="enrollmentForecastGraph card1"
                  style={{ minWidth: 0 }}
                >
                  <div className="chartTitle">
                    <h2>BOSY by Gender (All Grades)</h2>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={1}
                      minHeight={300}
                    >
                      <BarChart
                        data={overallRows}
                        margin={{ top: 30, right: 20, left: -30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="school_year"
                          interval="preserveStartEnd"
                          height={28}
                          tickMargin={10}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickFormatter={(v) =>
                            v >= 1000 ? `${Math.round(v / 100) / 10}k` : v
                          }
                          domain={[
                            0,
                            (dataMax) => Math.ceil(dataMax / 200) * 200 + 200,
                          ]}
                        />
                        <Tooltip />
                        <Legend verticalAlign="top" height={28} />
                        {/* Stacked bars */}
                        <Bar
                          dataKey="female"
                          stackId="g"
                          fill="#f472b6"
                          name="Female"
                        />
                        <Bar
                          dataKey="male"
                          stackId="g"
                          fill="#60a5fa"
                          name="Male"
                        />
                        {/* Total line with markers and labels */}
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          name="Total"
                          label={{
                            position: 'top',
                            formatter: (v) => v.toLocaleString(),
                            fill: '#16a34a',
                            fontSize: 12,
                          }}
                        />
                        {/* Analytics-style range selector */}
                        <Brush
                          dataKey="school_year"
                          height={26}
                          travellerWidth={10}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Latest Gender Split (Donut) */}
                <div
                  className="enrollmentForecastGraph card1"
                  style={{ minWidth: 0 }}
                >
                  <div className="chartTitle">
                    <h2>Latest Gender Split</h2>
                  </div>
                  <div style={{ width: '100%', height: 300, minWidth: 0 }}>
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={1}
                      minHeight={250}
                    >
                      <PieChart>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={28} />
                        <Pie
                          data={genderPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          isAnimationActive
                        >
                          {genderPieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                          ))}
                          {latestActual && (
                            <Label
                              position="center"
                              style={{ fontSize: 14, fill: '#334155' }}
                            >
                              {latestActual.total.toLocaleString()}
                            </Label>
                          )}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {!latestActual && (
                    <p style={{ color: '#64748b' }}>
                      No actual data available.
                    </p>
                  )}
                </div>
              </div>

              <div className="enrollmentForecastP2">
                {/* Overall table: one row per SY */}
                <div className="tableSection" style={{ width: '100%' }}>
                  <h3 style={{ color: '#334155' }}>
                    Overall BOSY by School Year
                  </h3>
                  <table className="gradeStatsTable" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>School Year</th>
                        <th>Male</th>
                        <th>Female</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallRowsSorted.map((r) => (
                        <tr key={r.school_year}>
                          <td>{r.school_year}</td>
                          <td>{r.male}</td>
                          <td>{r.female}</td>
                          <td>{r.total}</td>
                        </tr>
                      ))}
                      {overallRowsSorted.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{ color: '#64748b', textAlign: 'center' }}
                          >
                            No data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Projection card – always SY 2025–2026 */}
                <div className="cardSection">
                  <div className="enrollmentForecastCard">
                    <p className="yearStat">
                      {forecast.labelYear} Projected Total Enrollees:
                    </p>
                    <h2>
                      {forecast.hasHistory
                        ? forecast.projected.toLocaleString()
                        : '—'}
                    </h2>
                    <p>
                      {forecast.hasHistory
                        ? `${forecast.pct >= 0 ? '+' : ''}${forecast.pct}% vs last year`
                        : 'No data'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'dropoutTrend' && (
          <div className="dropoutTrend" style={{ minWidth: 0 }}>
            <h2>Non-completion Trend</h2>
            {/* Wire to dropout aggregates later */}
          </div>
        )}
      </div>
    </>
  );
};

export default Admin_Analytics;
