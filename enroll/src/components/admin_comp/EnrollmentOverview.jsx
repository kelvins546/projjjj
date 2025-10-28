import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import './EnrollmentOverview.css';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const EnrollmentOverview = () => {
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [grade, setGrade] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | approved | pending | rejected | cancelled
  const [minGrade, setMinGrade] = useState(7);
  const [maxGrade, setMaxGrade] = useState(10);

  const [stats, setStats] = useState({
    enrolled: 0,
    pending: 0,
    rejected: 0,
    cancelled: 0,
    byGrade: [], // [{grade, count, sections, capacity, gap}]
    byMonth: [], // [{month, Total, Approved, Pending}]
    conversionRate: 0, // percent
  });

  useEffect(() => {
    const fetchStats = async () => {
      // 1) Pull enrollments for SY (optionally by grade)
      let q = supabase
        .from('enrollments')
        .select('status, grade_level, school_year, application_date', {
          count: 'exact',
        })
        .eq('school_year', schoolYear);
      if (grade) q = q.eq('grade_level', grade);
      const { data, error } = await q;
      if (error) {
        alert('Error fetching stats');
        return;
      }

      // 2) Aggregate status cards
      const summary = { enrolled: 0, pending: 0, rejected: 0, cancelled: 0 };
      const gradeMap = new Map(); // grade -> count
      const monthMap = new Map(); // m(0-11) -> { Total, Approved, Pending }

      let total = 0,
        approved = 0;

      for (const row of data || []) {
        total += 1;
        const st = String(row.status || '').toLowerCase();
        if (st === 'approved') {
          summary.enrolled += 1;
          approved += 1;
        } else if (st === 'pending') summary.pending += 1;
        else if (st === 'rejected') summary.rejected += 1;
        else if (st === 'cancelled') summary.cancelled += 1;

        const gKey = String(row.grade_level || '').trim() || 'Unknown';
        gradeMap.set(gKey, (gradeMap.get(gKey) || 0) + 1);

        const d = row.application_date ? new Date(row.application_date) : null;
        const m = d ? d.getMonth() : null;
        if (m != null) {
          const cur = monthMap.get(m) || { Total: 0, Approved: 0, Pending: 0 };
          cur.Total += 1;
          if (st === 'approved') cur.Approved += 1;
          if (st === 'pending') cur.Pending += 1;
          monthMap.set(m, cur);
        }
      }

      // 3) Sections per grade for capacity
      const { data: secs, error: eSec } = await supabase
        .from('sections')
        .select('grade_level');
      if (eSec) {
        alert('Error fetching sections');
        return;
      }
      const sectionsByGrade = new Map();
      (secs || []).forEach((s) => {
        const g = Number(s.grade_level);
        const label = Number.isFinite(g) ? `Grade ${g}` : String(s.grade_level);
        sectionsByGrade.set(label, (sectionsByGrade.get(label) || 0) + 1);
      });

      // 4) Build grade rows (capacity uses 40 as default target)
      const TARGET_CLASS_SIZE = 40;
      const byGrade = Array.from(gradeMap.entries())
        .map(([g, count]) => {
          const sections = sectionsByGrade.get(g) || 0;
          const capacity = sections * TARGET_CLASS_SIZE;
          const gap = capacity - count;
          return { grade: g, count, sections, capacity, gap };
        })
        .filter((r) => {
          const n = parseInt((r.grade.match(/\d+/) || [0])[0], 10);
          if (!Number.isFinite(n)) return true;
          return n >= minGrade && n <= maxGrade;
        })
        .sort((a, b) => {
          const na = parseInt((a.grade.match(/\d+/) || [0])[0], 10);
          const nb = parseInt((b.grade.match(/\d+/) || [0])[0], 10);
          return na - nb || a.grade.localeCompare(b.grade);
        });

      // 5) Monthly trend rows (fill missing months)
      const byMonth = MONTHS.map((label, i) => ({
        month: label,
        Total: monthMap.get(i)?.Total || 0,
        Approved: monthMap.get(i)?.Approved || 0,
        Pending: monthMap.get(i)?.Pending || 0,
      }));

      const conversionRate = total ? +((approved / total) * 100).toFixed(1) : 0;

      // 6) Optional status filter for chart/table
      let filteredGrade = byGrade;
      if (statusFilter !== 'all') {
        // If a status is selected, reflect it in counts: count becomes only that status
        const wanted = statusFilter.toLowerCase();
        const gradeStatusMap = new Map(); // grade -> count of wanted status
        for (const row of data || []) {
          if (String(row.status || '').toLowerCase() === wanted) {
            const g = String(row.grade_level || '').trim() || 'Unknown';
            gradeStatusMap.set(g, (gradeStatusMap.get(g) || 0) + 1);
          }
        }
        filteredGrade = filteredGrade.map((r) => ({
          ...r,
          count: gradeStatusMap.get(r.grade) || 0,
          gap:
            r.sections * TARGET_CLASS_SIZE - (gradeStatusMap.get(r.grade) || 0),
        }));
      }

      setStats({
        enrolled: summary.enrolled,
        pending: summary.pending,
        rejected: summary.rejected,
        cancelled: summary.cancelled,
        byGrade: filteredGrade,
        byMonth,
        conversionRate,
      });
    };

    fetchStats();
  }, [schoolYear, grade, statusFilter, minGrade, maxGrade]);

  // CSV export of current grade view
  const exportCSV = () => {
    const headers = ['Grade', 'Count', 'Sections', 'Capacity', 'Gap'];
    const rows = stats.byGrade.map((r) =>
      [r.grade, r.count, r.sections, r.capacity, r.gap].join(',')
    );
    const blob = new Blob([[headers.join(',')].concat(rows).join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrollment_overview_${schoolYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="enrollment-overview-wrapper">
      <div
        className="sorter"
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label
          htmlFor="school-year"
          style={{ fontWeight: 600, marginRight: 4 }}
        >
          Select School Year:
        </label>
        <select
          id="school-year"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
        >
          <option value="">All</option>
          <option value="2023-2024">2023-2024</option>
          <option value="2024-2025">2024-2025</option>
          <option value="2025-2026">2025-2026</option>
        </select>

        <label style={{ marginLeft: 8 }}>Grade:</label>
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All</option>
          <option>Grade 7</option>
          <option>Grade 8</option>
          <option>Grade 9</option>
          <option>Grade 10</option>
        </select>

        <label style={{ marginLeft: 8 }}>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button onClick={exportCSV} style={{ marginLeft: 'auto' }}>
          Export CSV
        </button>
      </div>

      <div className="enrollmentOverviewContent">
        <div className="enrollment-stat-cards">
          <div className="card">
            <h2>{stats.enrolled}</h2>
            <p>Enrolled Students</p>
          </div>
          <div className="card">
            <h2>{stats.pending}</h2>
            <p>Pending Applications</p>
          </div>
          <div className="card">
            <h2>{stats.conversionRate}%</h2>
            <p>Conversion Rate</p>
          </div>
        </div>

        {/* Monthly trend with line on approvals */}
        <div
          className="chart-section"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <div className="barChartContainer card">
            <h4 style={{ margin: '8px 12px' }}>
              Applications by Month ({schoolYear || 'All'})
            </h4>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={stats.byMonth}
                  margin={{ top: 10, right: 16, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Total" fill="#64748b" />
                  <Bar dataKey="Pending" fill="#f59e0b" />
                  <Line
                    type="monotone"
                    dataKey="Approved"
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="barChartContainer card">
            <h4 style={{ margin: '8px 12px' }}>
              Grade Distribution ({schoolYear || 'All'})
            </h4>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={stats.byGrade}
                  margin={{ top: 10, right: 16, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Applications" />
                  <Bar dataKey="sections" fill="#3b82f6" name="Sections" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="gradeStatsContainer">
            <h3>Grade Level Summary</h3>
            <table className="gradeStatsTable">
              <thead>
                <tr>
                  <th>Grade Level</th>
                  <th>Applications</th>
                  <th>Sections</th>
                  <th>Capacity</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {stats.byGrade.map((row) => (
                  <tr key={row.grade}>
                    <td>{row.grade}</td>
                    <td>{row.count}</td>
                    <td>{row.sections}</td>
                    <td>{row.capacity}</td>
                    <td style={{ color: row.gap < 0 ? '#ef4444' : '#10b981' }}>
                      {row.gap}
                    </td>
                  </tr>
                ))}
                {stats.byGrade.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ color: '#64748b', textAlign: 'center' }}
                    >
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentOverview;
