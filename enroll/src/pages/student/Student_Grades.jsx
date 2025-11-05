import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { supabase } from '../../supabaseClient';
import './student_grades.css';

const PASSING = 75;

export const Student_Grades = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [student, setStudent] = useState(null); // { student_id, first_name, last_name, lrn }
  const [syOptions, setSyOptions] = useState([]); // ['2025-2026', ...]
  const [selectedSY, setSelectedSY] = useState(''); // current school year filter

  const [rows, setRows] = useState([]); // [{ subject, teacher, q1,q2,q3,q4, final, remarks }]
  const [overallAverage, setOverallAverage] = useState(null); // numeric or null

  const fullName = useMemo(
    () =>
      `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || '—',
    [student]
  );

  // Helper to read one row or null
  const maybeSingle = async (table, builder) => {
    const q = builder(supabase.from(table));
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data || null;
  };

  // Load student + school year options + pick default SY
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr('');
      try {
        const userId = Number(localStorage.getItem('user_id'));

        // 1) Student by logged-in user
        const sRow = await maybeSingle('students', (r) =>
          r
            .select('student_id, first_name, last_name, lrn, user_id')
            .eq('user_id', userId)
        );
        if (!sRow?.student_id) {
          setErr('No student record found for this account.');
          setLoading(false);
          return;
        }
        setStudent(sRow);

        // 2) Get all school years (ordered), and find active SY
        const { data: sys, error: syErr } = await supabase
          .from('school_years')
          .select('school_year, is_active, created_at')
          .order('created_at', { ascending: false });
        if (syErr) throw syErr;
        const options = (sys || []).map((x) => x.school_year);
        setSyOptions(options);

        let defaultSY =
          (sys || []).find((x) => x.is_active)?.school_year || options[0] || '';

        // 3) If student has grades, prefer the latest SY with grades
        const { data: latestGradeSy, error: lgErr } = await supabase
          .from('grades')
          .select('school_year')
          .eq('student_id', sRow.student_id)
          .order('school_year', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lgErr) throw lgErr;
        if (latestGradeSy?.school_year) {
          defaultSY = latestGradeSy.school_year;
        }

        setSelectedSY(defaultSY || '');
      } catch (e) {
        setErr(e?.message || 'Failed to initialize.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Load grades whenever selectedSY changes
  useEffect(() => {
    const loadGrades = async () => {
      if (!student?.student_id || !selectedSY) return;

      setLoading(true);
      setErr('');
      try {
        // 1) Fetch all grades for this student + SY
        const { data: gradeRows, error: gErr } = await supabase
          .from('grades')
          .select('teacher_subject_id, quarter, grade')
          .eq('student_id', student.student_id)
          .eq('school_year', selectedSY);
        if (gErr) throw gErr;

        // Group per teacher_subject_id -> {1:q1,2:q2,3:q3,4:q4}
        const byTs = new Map();
        const tsIds = new Set();
        (gradeRows || []).forEach((g) => {
          if (!g.teacher_subject_id) return;
          tsIds.add(g.teacher_subject_id);
          const m = byTs.get(g.teacher_subject_id) || {};
          if (g.quarter >= 1 && g.quarter <= 4) {
            m[g.quarter] =
              typeof g.grade === 'number' ? g.grade : Number(g.grade);
          }
          byTs.set(g.teacher_subject_id, m);
        });

        // If no grades yet
        if (!tsIds.size) {
          setRows([]);
          setOverallAverage(null);
          setLoading(false);
          return;
        }

        // 2) Resolve teacher_subjects for subject_id and teacher_id
        const { data: tsRows, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id, subject_id, teacher_id, school_year')
          .in('teacher_subject_id', Array.from(tsIds))
          .eq('school_year', selectedSY);
        if (tsErr) throw tsErr;

        const subjectIds = Array.from(
          new Set((tsRows || []).map((r) => r.subject_id).filter(Boolean))
        );
        const teacherIds = Array.from(
          new Set((tsRows || []).map((r) => r.teacher_id).filter(Boolean))
        );

        // 3) Subject names
        let subjNameById = new Map();
        if (subjectIds.length) {
          const { data: subs, error: subErr } = await supabase
            .from('subjects')
            .select('subject_id, name')
            .in('subject_id', subjectIds);
          if (subErr) throw subErr;
          subjNameById = new Map(
            (subs || []).map((s) => [s.subject_id, s.name])
          );
        }

        // 4) Teacher -> user mapping
        let userByTeacher = new Map();
        if (teacherIds.length) {
          const { data: tr, error: tErr } = await supabase
            .from('teachers')
            .select('teacher_id, user_id')
            .in('teacher_id', teacherIds);
          if (tErr) throw tErr;
          userByTeacher = new Map(
            (tr || []).map((x) => [x.teacher_id, x.user_id])
          );
        }

        // 5) User names
        const userIds = Array.from(
          new Set(Array.from(userByTeacher.values()).filter(Boolean))
        );
        let nameByUser = new Map();
        if (userIds.length) {
          const { data: users, error: uErr } = await supabase
            .from('users')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);
          if (uErr) throw uErr;
          nameByUser = new Map(
            (users || []).map((u) => [
              u.user_id,
              `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            ])
          );
        }

        // 6) Build table rows
        const tsById = new Map(
          (tsRows || []).map((r) => [r.teacher_subject_id, r])
        );
        const built = Array.from(byTs.entries()).map(([tsId, quarters]) => {
          const ts = tsById.get(tsId);
          const subject = ts?.subject_id
            ? subjNameById.get(ts.subject_id) || '—'
            : '—';
          const tUserId = ts?.teacher_id
            ? userByTeacher.get(ts.teacher_id)
            : null;
          const teacher = tUserId ? nameByUser.get(tUserId) || '—' : '—';

          const q1 = quarters[1] ?? null;
          const q2 = quarters[2] ?? null;
          const q3 = quarters[3] ?? null;
          const q4 = quarters[4] ?? null;

          const present = [q1, q2, q3, q4].filter((x) => typeof x === 'number');
          const final = present.length
            ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
            : null;
          const remarks =
            typeof final === 'number'
              ? final >= PASSING
                ? 'Passed'
                : 'Failed'
              : '—';

          return { subject, teacher, q1, q2, q3, q4, final, remarks };
        });

        // Sort by subject name for stable UI
        built.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));

        // Overall average across subjects that have a final
        const finals = built
          .map((r) => r.final)
          .filter((x) => typeof x === 'number');
        const overall = finals.length
          ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length)
          : null;

        setRows(built);
        setOverallAverage(overall);
      } catch (e) {
        setErr(e?.message || 'Failed to load grades.');
        setRows([]);
        setOverallAverage(null);
      } finally {
        setLoading(false);
      }
    };

    loadGrades();
  }, [student?.student_id, selectedSY]);

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />

      <div className="studentGradesContainer">
        {/* School Year selector */}
        <div className="syGradeSorter">
          <div className="sorter">
            <label>Select School Year</label>
            <select
              value={selectedSY}
              onChange={(e) => setSelectedSY(e.target.value)}
              disabled={loading || !syOptions.length}
            >
              {syOptions.length ? (
                syOptions.map((sy) => (
                  <option key={sy} value={sy}>
                    {sy}
                  </option>
                ))
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="gradesTableArea">
          <div className="gradesTableContainer">
            <div className="gradesTable">
              {loading ? (
                <p>Loading grades…</p>
              ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th rowSpan="2">Subject</th>
                      <th rowSpan="2">Teacher</th>
                      <th colSpan="4">Quarter</th>
                      <th rowSpan="2">Final Grade</th>
                      <th rowSpan="2">Remarks</th>
                    </tr>
                    <tr>
                      <th>1st</th>
                      <th>2nd</th>
                      <th>3rd</th>
                      <th>4th</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ textAlign: 'center', color: '#64748b' }}
                        >
                          No grades encoded for {selectedSY}.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.subject + r.teacher}>
                          <td>{r.subject}</td>
                          <td>{r.teacher}</td>
                          <td>{typeof r.q1 === 'number' ? r.q1 : '—'}</td>
                          <td>{typeof r.q2 === 'number' ? r.q2 : '—'}</td>
                          <td>{typeof r.q3 === 'number' ? r.q3 : '—'}</td>
                          <td>{typeof r.q4 === 'number' ? r.q4 : '—'}</td>
                          <td>{typeof r.final === 'number' ? r.final : '—'}</td>
                          <td>
                            <em>{r.remarks}</em>
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Overall average row */}
                    <tr className="averageRow">
                      <td className="average" colSpan={6}>
                        Average
                      </td>
                      <td colSpan={2}>
                        {typeof overallAverage === 'number'
                          ? overallAverage
                          : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
