import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import './studentDistribution.css';
import './dashboardver1.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const STATIC_SY = '2025-2026';

// Parse "Grade 7" -> 7
const parseGradeNum = (g) => {
  if (g == null) return NaN;
  const m = String(g).match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
};

const StudentDistribution = () => {
  const [distributionData, setDistributionData] = useState([]);
  const [sortAscending, setSortAscending] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // New controls
  const [viewFilter, setViewFilter] = useState('all'); // all | placed | unplaced
  const [minGrade, setMinGrade] = useState(7);
  const [maxGrade, setMaxGrade] = useState(10);
  const [targetClassSize, setTargetClassSize] = useState(40);

  const withinRange = (label) => {
    const n = parseGradeNum(label);
    if (!Number.isFinite(n)) return true;
    return n >= minGrade && n <= maxGrade;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setErr('');

        // 1) Approved enrollments for SY (grade + applicant_id)
        const { data: enr, error: e1 } = await supabase
          .from('enrollments')
          .select('applicant_id, grade_level')
          .eq('school_year', STATIC_SY)
          .eq('status', 'approved');
        if (e1) throw e1;

        if (!enr?.length) {
          if (mounted) setDistributionData([]);
          return;
        }

        // Grade -> applicants and totals
        const applicantsByGrade = new Map();
        const totalsByGrade = new Map();
        for (const row of enr) {
          const gKey = String(row.grade_level || '').trim() || 'Unknown';
          if (!applicantsByGrade.has(gKey))
            applicantsByGrade.set(gKey, new Set());
          applicantsByGrade.get(gKey).add(row.applicant_id);
          totalsByGrade.set(gKey, (totalsByGrade.get(gKey) || 0) + 1);
        }

        // 2) Students for those applicant_ids (student_id + gender)
        const allApplicantIds = Array.from(
          new Set(enr.map((r) => r.applicant_id).filter(Boolean))
        );
        const CHUNK = 1000;
        const studentsList = [];
        for (let i = 0; i < allApplicantIds.length; i += CHUNK) {
          const part = allApplicantIds.slice(i, i + CHUNK);
          const { data: studs, error: e2 } = await supabase
            .from('students')
            .select('student_id, applicant_id, gender')
            .in('applicant_id', part);
          if (e2) throw e2;
          studentsList.push(...(studs || []));
        }
        const studentIdByApplicant = new Map(
          studentsList.map((s) => [s.applicant_id, s.student_id])
        );
        const genderByApplicant = new Map(
          studentsList.map((s) => [s.applicant_id, s.gender || ''])
        );

        // 3) Placed set for SY from student_sections (by student_id)
        const studentIds = studentsList
          .map((s) => s.student_id)
          .filter(Boolean);
        const placedSet = new Set();
        for (let i = 0; i < studentIds.length; i += 1000) {
          const part = studentIds.slice(i, i + 1000);
          const { data: ss, error: ssErr } = await supabase
            .from('student_sections')
            .select('student_id')
            .eq('school_year', STATIC_SY)
            .in('student_id', part);
          if (ssErr) throw ssErr;
          (ss || []).forEach((r) => placedSet.add(r.student_id));
        }

        // 4) Sections per grade (independent of SY)
        const { data: secs, error: eSec } = await supabase
          .from('sections')
          .select('grade_level');
        if (eSec) throw eSec;
        const sectionCounts = new Map();
        for (const s of secs || []) {
          const gNum = Number(s.grade_level);
          if (!Number.isFinite(gNum)) continue;
          sectionCounts.set(gNum, (sectionCounts.get(gNum) || 0) + 1);
        }

        // 5) Build rows with male/female, placed/unplaced, avgPerSection
        const rows = [];
        for (const [gradeKey, appSet] of applicantsByGrade.entries()) {
          let male = 0,
            female = 0,
            placed = 0;
          for (const aid of appSet) {
            const g = String(genderByApplicant.get(aid) || '')
              .trim()
              .toLowerCase();
            if (g.startsWith('m')) male += 1;
            else if (g.startsWith('f')) female += 1;
            const sid = studentIdByApplicant.get(aid);
            if (sid && placedSet.has(sid)) placed += 1;
          }
          const totalEnrolled = totalsByGrade.get(gradeKey) || 0;
          const unplaced = Math.max(0, totalEnrolled - placed);
          const gNum = parseGradeNum(gradeKey);
          const sectionsCount = Number.isFinite(gNum)
            ? sectionCounts.get(gNum) || 0
            : 0;
          const avgPerSection =
            sectionsCount > 0 ? +(totalEnrolled / sectionsCount).toFixed(2) : 0;

          rows.push({
            grade: gradeKey,
            male,
            female,
            sectionsCount,
            totalEnrolled,
            placed,
            unplaced,
            avgPerSection,
          });
        }

        rows.sort((a, b) => {
          const an = parseGradeNum(a.grade);
          const bn = parseGradeNum(b.grade);
          if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
          return String(a.grade).localeCompare(String(b.grade));
        });

        if (mounted) setDistributionData(rows);
      } catch (e) {
        console.error(e);
        if (mounted) {
          setErr('Failed to load distribution.');
          setDistributionData([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredData = useMemo(() => {
    let base = [...distributionData];
    if (viewFilter === 'placed') base = base.filter((r) => r.placed > 0);
    if (viewFilter === 'unplaced') base = base.filter((r) => r.unplaced > 0);
    base = base.filter((r) => withinRange(r.grade));
    return base;
  }, [distributionData, viewFilter, minGrade, maxGrade]);

  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a, b) =>
      sortAscending
        ? a.sectionsCount - b.sectionsCount
        : b.sectionsCount - a.sectionsCount
    );
    return copy;
  }, [filteredData, sortAscending]);

  const exportCSV = () => {
    const headers = [
      'Grade',
      'Sections',
      'Total',
      'Placed',
      'Unplaced',
      'UnplacedPct',
      'AvgPerSection',
      'Capacity',
      'Gap',
      'Male',
      'Female',
    ];
    const lines = [headers.join(',')];
    sortedData.forEach((r) => {
      const capacity = r.sectionsCount * targetClassSize;
      const gap = capacity - r.totalEnrolled;
      const unplacedPct = r.totalEnrolled
        ? ((r.unplaced / r.totalEnrolled) * 100).toFixed(1)
        : '0.0';
      lines.push(
        [
          r.grade,
          r.sectionsCount,
          r.totalEnrolled,
          r.placed,
          r.unplaced,
          `${unplacedPct}`,
          r.avgPerSection,
          capacity,
          gap,
          r.male,
          r.female,
        ].join(',')
      );
    });
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_distribution_${STATIC_SY}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studentDistributionContainer">
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>Grade Distribution ({STATIC_SY})</h3>
          {loading && (
            <span style={{ color: '#64748b', fontSize: 13 }}>Loading…</span>
          )}
          {err && <span style={{ color: '#ef4444', fontSize: 13 }}>{err}</span>}

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <label style={{ fontSize: 12 }}>View:</label>
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="placed">Placed only</option>
              <option value="unplaced">Unplaced only</option>
            </select>

            <label style={{ fontSize: 12 }}>Grade range:</label>
            <input
              type="number"
              min={7}
              max={10}
              value={minGrade}
              onChange={(e) => setMinGrade(Number(e.target.value))}
              style={{ width: 64 }}
            />
            <span>–</span>
            <input
              type="number"
              min={7}
              max={10}
              value={maxGrade}
              onChange={(e) => setMaxGrade(Number(e.target.value))}
              style={{ width: 64 }}
            />

            <label style={{ fontSize: 12 }}>Target/class:</label>
            <input
              type="number"
              min={10}
              max={60}
              step={1}
              value={targetClassSize}
              onChange={(e) => setTargetClassSize(Number(e.target.value))}
              style={{ width: 72 }}
            />

            <button onClick={exportCSV}>Export CSV</button>
          </div>
        </div>

        {/* Existing Male/Female per grade */}
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 20, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="male" fill="#6366f1" name="Male" />
              <Bar dataKey="female" fill="#10b981" name="Female" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Placed vs Unplaced per grade */}
        <div style={{ width: '100%', height: 320, marginTop: 16 }}>
          <ResponsiveContainer>
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 20, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="placed" stackId="A" fill="#22c55e" name="Placed" />
              <Bar
                dataKey="unplaced"
                stackId="A"
                fill="#ef4444"
                name="Unplaced"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average per section and sections count */}
        <div style={{ width: '100%', height: 320, marginTop: 16 }}>
          <ResponsiveContainer>
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 20, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="avgPerSection"
                fill="#f59e0b"
                name="Avg per Section"
              />
              <Bar dataKey="sectionsCount" fill="#3b82f6" name="Sections" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="gradeDistributionContainer" style={{ marginTop: 18 }}>
          <table className="gradeDistributionTable">
            <thead>
              <tr>
                <th>Grade Level</th>
                <th
                  onClick={() => setSortAscending((v) => !v)}
                  className="sortableHeader"
                  style={{ cursor: 'pointer' }}
                >
                  Number of Sections {sortAscending ? '▲' : '▼'}
                </th>
                <th>Total Enrolled</th>
                <th>Placed</th>
                <th>Unplaced</th>
                <th>Unplaced%</th>
                <th>Avg per Section</th>
                <th>Capacity</th>
                <th>Gap</th>
                <th>Male</th>
                <th>Female</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((r) => {
                const capacity = r.sectionsCount * targetClassSize;
                const gap = capacity - r.totalEnrolled;
                const unplacedPct = r.totalEnrolled
                  ? ((r.unplaced / r.totalEnrolled) * 100).toFixed(1)
                  : '0.0';
                return (
                  <tr key={r.grade}>
                    <td>{r.grade}</td>
                    <td>{r.sectionsCount}</td>
                    <td>{r.totalEnrolled}</td>
                    <td>{r.placed}</td>
                    <td>{r.unplaced}</td>
                    <td>{unplacedPct}%</td>
                    <td>{r.avgPerSection}</td>
                    <td>{capacity}</td>
                    <td style={{ color: gap < 0 ? '#ef4444' : '#10b981' }}>
                      {gap}
                    </td>
                    <td>{r.male}</td>
                    <td>{r.female}</td>
                  </tr>
                );
              })}
              {sortedData.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{ color: '#64748b', textAlign: 'center' }}
                  >
                    No data for {STATIC_SY}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentDistribution;
