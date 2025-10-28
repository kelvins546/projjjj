import { useEffect, useMemo, useState } from 'react';
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
} from 'recharts';

const STATIC_SY = '2025-2026';
const PASSING_THRESHOLD = 75; // configurable
const QUARTER_LABELS = ['1st', '2nd', '3rd', '4th'];
const toQuarterNum = (label) => {
  if (!label) return 1;
  const i = QUARTER_LABELS.findIndex((q) => q === label);
  return i >= 0 ? i + 1 : 1;
};

const GradingSummary = ({ activeSection = 'gradingSummary' }) => {
  const [gradingSummaryQuarter, setGradingSummaryQuarter] = useState('1st');
  const [gradingSummaryGrade, setGradingSummaryGrade] = useState('');
  const [topSectionQuarter, setTopSectionQuarter] = useState('1st');
  const [topSectionGrade, setTopSectionGrade] = useState('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Core data
  const [submissionRate, setSubmissionRate] = useState({
    submitted: 0,
    notSubmitted: 0,
    pct: 0,
  });
  const [verificationRate, setVerificationRate] = useState({
    verified: 0,
    notVerified: 0,
    pct: 0,
  });
  const [passingByGrade, setPassingByGrade] = useState([]); // [{gradeLabel, pass, fail, passPct}]
  const [topSections, setTopSections] = useState([]); // [{section_id, section_name, grade_level, avg}]
  const [quarterLocked, setQuarterLocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setErr('');
        const qNum = toQuarterNum(gradingSummaryQuarter);
        const gradeFilter = gradingSummaryGrade; // 'Grade 7' style or ''

        // 1) Load teacher_subjects for SY with sections and subjects
        const { data: ts, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select(
            `
            teacher_subject_id,
            teacher_id,
            section:sections(section_id, name, grade_level),
            subject:subjects(subject_id, name)
          `
          )
          .eq('school_year', STATIC_SY);
        if (tsErr) throw tsErr;

        // Optional grade filter on assignments
        const tsFiltered =
          ts?.filter((r) => {
            if (!gradeFilter) return true;
            const gl = Number(r?.section?.grade_level);
            const label = Number.isFinite(gl) ? `Grade ${gl}` : '';
            return label === gradeFilter;
          }) || [];

        const tsIds = tsFiltered.map((r) => r.teacher_subject_id);
        const sectionOf = new Map(
          tsFiltered.map((r) => [r.teacher_subject_id, r.section])
        );
        const gradeOfTS = new Map(
          tsFiltered.map((r) => [r.teacher_subject_id, r?.section?.grade_level])
        );

        // 2) Grades for selected quarter and SY for those assignments
        let grades = [];
        if (tsIds.length) {
          const { data: gr, error: gErr } = await supabase
            .from('grades')
            .select('teacher_subject_id, grade, adviser_approved, quarter')
            .eq('school_year', STATIC_SY)
            .eq('quarter', qNum)
            .in('teacher_subject_id', tsIds);
          if (gErr) throw gErr;
          grades = gr || [];
        }

        // 3) Submission rate: unique TS IDs present in grades
        const submittedSet = new Set(grades.map((g) => g.teacher_subject_id));
        const submitted = submittedSet.size;
        const total = tsFiltered.length;
        const notSubmitted = Math.max(0, total - submitted);
        const subPct = total ? +((submitted / total) * 100).toFixed(1) : 0;

        // 4) Verification rate: TS where all rows are adviser_approved
        const rowsByTS = new Map();
        for (const g of grades) {
          const list = rowsByTS.get(g.teacher_subject_id) || [];
          list.push(g);
          rowsByTS.set(g.teacher_subject_id, list);
        }
        let verified = 0;
        for (const [tsid, list] of rowsByTS.entries()) {
          if (list.length > 0 && list.every((r) => r.adviser_approved === true))
            verified += 1;
        }
        const notVerified = Math.max(0, submitted - verified);
        const verPct = submitted
          ? +((verified / submitted) * 100).toFixed(1)
          : 0;

        // 5) Passing by grade: count pass/fail using teacher_subjects -> section.grade_level
        const passMap = new Map(); // grade_label -> {pass, fail}
        for (const g of grades) {
          const gl = Number(gradeOfTS.get(g.teacher_subject_id));
          const label = Number.isFinite(gl) ? `Grade ${gl}` : 'Unknown';
          const bucket = passMap.get(label) || { pass: 0, fail: 0 };
          if (Number(g.grade) >= PASSING_THRESHOLD) bucket.pass += 1;
          else bucket.fail += 1;
          passMap.set(label, bucket);
        }
        const passRows = Array.from(passMap.entries())
          .map(([gradeLabel, v]) => ({
            gradeLabel,
            pass: v.pass,
            fail: v.fail,
            passPct:
              v.pass + v.fail
                ? +((v.pass / (v.pass + v.fail)) * 100).toFixed(1)
                : 0,
          }))
          .sort((a, b) => {
            const na = parseInt((a.gradeLabel.match(/\d+/) || [0])[0], 10);
            const nb = parseInt((b.gradeLabel.match(/\d+/) || [0])[0], 10);
            return na - nb || a.gradeLabel.localeCompare(b.gradeLabel);
          });

        // 6) Top sections by average grade (use separate quarter/grade filter controls)
        const tqNum = toQuarterNum(topSectionQuarter);
        const ts2 =
          ts?.filter((r) => {
            if (!topSectionGrade) return true;
            const gl = Number(r?.section?.grade_level);
            const label = Number.isFinite(gl) ? `Grade ${gl}` : '';
            return label === topSectionGrade;
          }) || [];
        const ts2Ids = ts2.map((r) => r.teacher_subject_id);

        let grades2 = [];
        if (ts2Ids.length) {
          const { data: gr2, error: g2Err } = await supabase
            .from('grades')
            .select('teacher_subject_id, grade')
            .eq('school_year', STATIC_SY)
            .eq('quarter', tqNum)
            .in('teacher_subject_id', ts2Ids);
          if (g2Err) throw g2Err;
          grades2 = gr2 || [];
        }

        // Map TS -> section, then section -> aggregate
        const secAgg = new Map(); // section_id -> { sum, n, name, grade_level }
        for (const g of grades2) {
          const sec = sectionOf.get(g.teacher_subject_id);
          if (!sec?.section_id) continue;
          const agg = secAgg.get(sec.section_id) || {
            sum: 0,
            n: 0,
            name: sec.name || `#${sec.section_id}`,
            grade_level: sec.grade_level,
          };
          const val = Number(g.grade);
          if (Number.isFinite(val)) {
            agg.sum += val;
            agg.n += 1;
          }
          secAgg.set(sec.section_id, agg);
        }
        const top = Array.from(secAgg.entries())
          .map(([section_id, v]) => ({
            section_id,
            section_name: v.name,
            grade_level: v.grade_level,
            avg: v.n ? +(v.sum / v.n).toFixed(2) : 0,
          }))
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 10);

        // 7) Quarter lock status (any matching entry locked counts as locked)
        let locked = false;
        {
          const { data: win, error: wErr } = await supabase
            .from('encoding_windows')
            .select('grade_level, quarter, is_locked')
            .eq('quarter', qNum);
          if (wErr) throw wErr;
          const wins = (win || []).filter((w) => {
            if (!gradeFilter) return true;
            const label = Number.isFinite(Number(w.grade_level))
              ? `Grade ${Number(w.grade_level)}`
              : '';
            return label === gradeFilter;
          });
          locked = wins.some((w) => w.is_locked === true);
        }

        if (!mounted) return;
        setSubmissionRate({ submitted, notSubmitted, pct: subPct });
        setVerificationRate({ verified, notVerified, pct: verPct });
        setPassingByGrade(passRows);
        setTopSections(top);
        setQuarterLocked(locked);
      } catch (e) {
        console.error(e);
        if (mounted) setErr('Failed to load grading summary.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [
    gradingSummaryQuarter,
    gradingSummaryGrade,
    topSectionQuarter,
    topSectionGrade,
  ]);

  // Charts
  const submissionChart = useMemo(
    () => [
      {
        name: 'Submission',
        Submitted: submissionRate.submitted,
        NotSubmitted: submissionRate.notSubmitted,
      },
    ],
    [submissionRate]
  );

  const verificationChart = useMemo(
    () => [
      {
        name: 'Verification',
        Verified: verificationRate.verified,
        NotVerified: verificationRate.notVerified,
      },
    ],
    [verificationRate]
  );

  const exportPassingCSV = () => {
    const headers = ['Grade', 'Pass', 'Fail', 'PassPct'];
    const lines = [headers.join(',')];
    passingByGrade.forEach((r) =>
      lines.push([r.gradeLabel, r.pass, r.fail, r.passPct].join(','))
    );
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passing_rates_${STATIC_SY}_${gradingSummaryQuarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTopCSV = () => {
    const headers = ['Section', 'GradeLevel', 'Average'];
    const lines = [headers.join(',')];
    topSections.forEach((r) =>
      lines.push([r.section_name, r.grade_level, r.avg].join(','))
    );
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `top_sections_${STATIC_SY}_${topSectionQuarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (activeSection !== 'gradingSummary') return null;

  return (
    <div>
      <h2>Grading Summary</h2>

      <div className="gradingSummary">
        <h1>Grade Summary</h1>

        <div
          className="gradingSummaryP1"
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div className="gradingSummaryQuarterSort">
            <label>Quarter</label>
            <select
              value={gradingSummaryQuarter}
              onChange={(e) => setGradingSummaryQuarter(e.target.value)}
            >
              <option value="" disabled>
                Quarter
              </option>
              <option>1st</option>
              <option>2nd</option>
              <option>3rd</option>
              <option>4th</option>
            </select>
          </div>

          <div className="gradingSummaryGradeSort">
            <label>Select Grade Level</label>
            <select
              value={gradingSummaryGrade}
              onChange={(e) => setGradingSummaryGrade(e.target.value)}
            >
              <option value="">All Grade</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </div>

          <div
            style={{
              marginLeft: 'auto',
              fontSize: 13,
              color: quarterLocked ? '#ef4444' : '#10b981',
            }}
          >
            Window: {quarterLocked ? 'Locked' : 'Open'}
          </div>
        </div>

        <div
          className="gradingSummaryP2"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <div
            className="card teacher-grade-submission"
            style={{ padding: 12 }}
          >
            <p style={{ marginTop: 0 }}>Teacher Grades Submission</p>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart
                  data={submissionChart}
                  margin={{ top: 10, right: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Submitted" fill="#22c55e" />
                  <Bar dataKey="NotSubmitted" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {submissionRate.pct}% submitted
            </div>
          </div>

          <div
            className="card teacher-grade-submission"
            style={{ padding: 12 }}
          >
            <p style={{ marginTop: 0 }}>Adviser Grades Verification</p>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart
                  data={verificationChart}
                  margin={{ top: 10, right: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Verified" fill="#06b6d4" />
                  <Bar dataKey="NotVerified" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {verificationRate.pct}% verified
            </div>
          </div>
        </div>

        <div className="gradingSummaryP3" style={{ marginTop: 16 }}>
          <div className="passingRateTitle">
            <h1>Passing Rate</h1>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart
                data={passingByGrade}
                margin={{ top: 10, right: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="gradeLabel" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pass" fill="#16a34a" name="Pass" />
                <Bar dataKey="fail" fill="#ef4444" name="Fail" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportPassingCSV}>Export Passing CSV</button>
          </div>
        </div>

        <div className="gradingSummaryP4" style={{ marginTop: 16 }}>
          <div className="topSections" style={{ marginBottom: 8 }}>
            <div
              className="topSectionsSorter"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div className="gradingSummaryQuarterSort">
                <label>Quarter</label>
                <select
                  value={topSectionQuarter}
                  onChange={(e) => setTopSectionQuarter(e.target.value)}
                >
                  <option value="" disabled>
                    Quarter
                  </option>
                  <option>1st</option>
                  <option>2nd</option>
                  <option>3rd</option>
                  <option>4th</option>
                </select>
              </div>

              <div className="gradingSummaryGradeSort">
                <label>Select Grade Level</label>
                <select
                  value={topSectionGrade}
                  onChange={(e) => setTopSectionGrade(e.target.value)}
                >
                  <option value="">All Grade</option>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                </select>
              </div>

              <button onClick={exportTopCSV} style={{ marginLeft: 'auto' }}>
                Export Top Sections CSV
              </button>
            </div>

            <div className="topSectionTable">
              <div className="table-container">
                <table className="table1">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Average</th>
                      <th>Grade Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSections.length === 0 && (
                      <tr>
                        <td colSpan={3}>No data.</td>
                      </tr>
                    )}
                    {topSections.map((r) => (
                      <tr key={r.section_id}>
                        <td>{r.section_name}</td>
                        <td>{r.avg}</td>
                        <td>{r.grade_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="averageGradeChart">
            {/* You can add a per-subject average bar chart here using the same grades source if needed */}
          </div>
        </div>

        {loading && (
          <div style={{ color: '#64748b', marginTop: 8 }}>Loading…</div>
        )}
        {err && <div style={{ color: '#ef4444', marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
};

export default GradingSummary;
