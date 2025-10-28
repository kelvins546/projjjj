import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './EnrollmentOverview.css';
const EnrollmentOverview = () => {
  const [schoolYear, setSchoolYear] = useState('');
  const [grade, setGrade] = useState('');
  const [stats, setStats] = useState({
    enrolled: 0,
    pending: 0,
    rejected: 0,
    cancelled: 0,
    byGrade: [],
  });

  useEffect(() => {
    const fetchStats = async () => {
      let query = supabase
        .from('enrollments')
        .select('status, grade_level, school_year', { count: 'exact' });

      // Apply filters if selected
      if (schoolYear) query = query.eq('school_year', schoolYear);
      if (grade) query = query.eq('grade_level', grade);

      const { data, error } = await query;
      if (error) {
        alert('Error fetching stats');
        return;
      }

      // Aggregate counts for each status
      const summary = { enrolled: 0, pending: 0, rejected: 0, cancelled: 0 };
      const gradeMap = {};

      data.forEach((item) => {
        if (item.status === 'approved') summary.enrolled += 1;
        if (item.status === 'pending') summary.pending += 1;

        // Grade distribution
        if (!gradeMap[item.grade_level]) gradeMap[item.grade_level] = 0;
        gradeMap[item.grade_level]++;
      });

      summary.byGrade = Object.entries(gradeMap).map(([grade, count]) => ({
        grade,
        count,
      }));
      setStats(summary);
    };

    fetchStats();
  }, [schoolYear, grade]);
  <BarChart width={500} height={250} data={stats.byGrade}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="grade" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="count" fill="#8884d8" />
  </BarChart>;

  return (
    <div className="enrollment-overview-wrapper">
      <div className="sorter" style={{ marginTop: 24 }}>
        <label
          htmlFor="school-year"
          style={{ fontWeight: 600, marginRight: 12 }}
        >
          Select School Year:
        </label>
        <select
          id="school-year"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid #b0bfd7',
            fontSize: '1rem',
            outline: 'none',
            minWidth: 120,
          }}
        >
          <option value="">All</option>
          <option value="2023-2024">2023-2024</option>
          <option value="2024-2025">2024-2025</option>
          <option value="2025-2026">2025-2026</option>
        </select>
      </div>
      <div className='enrollmentOverviewContent'>
        <div className="enrollment-stat-cards">
          <div className="card">
            <h2>{stats.enrolled}</h2>
            <p>Enrolled Students</p>
          </div>
          <div className="card">
            <h2>{stats.pending}</h2>
            <p>Pending Applications</p>
          </div>
        </div>

        <div className="chart-section">
          <div className="barChartContainer">
            <BarChart width={500} height={250} data={stats.byGrade}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </div>

          <div className="table-section">
            <div className="gradeStatsContainer">
              <h3>Grade Level Summary</h3>
              <table className="gradeStatsTable">
                <thead>
                  <tr>
                    <th>Grade Level</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byGrade.map((row) => (
                    <tr key={row.grade}>
                      <td>{row.grade}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default EnrollmentOverview;
