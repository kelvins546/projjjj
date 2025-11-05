import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { supabase } from '../../supabaseClient';
import './student_schedule.css';

// Use the same grids so times/keys match teachers' schedules
const gradeConfig = {
  7: {
    rows: [
      ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
      ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
      ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
      ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
      ['9:00 - 9:20', '8:40 - 9:00', '9:00-9:20'],
      ['9:20 - 10:05', '9:00 - 9:40', '9:20-10:05'],
      ['10:05 - 10:50', '9:40 - 10:20', '10:05-10:50'],
      ['10:50 - 11:35', '10:20 - 11:00', '10:50-11:35'],
      ['11:35 - 12:20', '11:00 - 11:40', '11:35-12:20'],
    ],
    recessKey: '9:00-9:20',
  },
  8: {
    rows: [
      ['12:30 - 1:15', '12:30 - 1:10', '12:30-1:15'],
      ['1:15 - 2:00', '1:10 - 1:50', '1:15-2:00'],
      ['2:00 - 2:45', '1:50 - 2:30', '2:00-2:45'],
      ['2:45 - 3:30', '2:30 - 3:10', '2:45-3:30'],
      ['3:30 - 3:50', '3:10 - 3:30', '3:30-3:50'],
      ['3:50 - 4:35', '3:30 - 4:10', '3:50-4:35'],
      ['4:35 - 5:20', '4:10 - 4:50', '4:35-5:20'],
      ['5:20 - 6:05', '4:50 - 5:30', '5:20-6:05'],
      ['6:05 - 6:50', '5:30 - 6:10', '6:05-6:50'],
    ],
    recessKey: '3:30-3:50',
  },
  9: {
    rows: [
      ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
      ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
      ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
      ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
      ['9:00 - 9:20', '8:40 - 9:00', '9:00-9:20'],
      ['9:20 - 10:05', '9:00 - 9:40', '9:20-10:05'],
      ['10:05 - 10:50', '9:40 - 10:20', '10:05-10:50'],
      ['10:50 - 11:35', '10:20 - 11:00', '10:50-11:35'],
      ['11:35 - 12:20', '11:00 - 11:40', '11:35-12:20'],
    ],
    recessKey: '9:00-9:20',
  },
  10: {
    rows: [
      ['12:30 - 1:15', '12:30 - 1:10', '12:30-1:15'],
      ['1:15 - 2:00', '1:10 - 1:50', '1:15-2:00'],
      ['2:00 - 2:45', '1:50 - 2:30', '2:00-2:45'],
      ['2:45 - 3:30', '2:30 - 3:10', '2:45-3:30'],
      ['3:30 - 3:50', '3:10 - 3:30', '3:30-3:50'],
      ['3:50 - 4:35', '3:30 - 4:10', '3:50-4:35'],
      ['4:35 - 5:20', '4:10 - 4:50', '4:35-5:20'],
      ['5:20 - 6:05', '4:50 - 5:30', '5:20-6:05'],
      ['6:05 - 6:50', '5:30 - 6:10', '6:05-6:50'],
    ],
    recessKey: '3:30-3:50',
  },
};

const STATIC_SY = '2025-2026';

export const Student_Schedule = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [student, setStudent] = useState(null); // { student_id, first_name, last_name, lrn }
  const [activeSY, setActiveSY] = useState(STATIC_SY);
  const [schoolYears, setSchoolYears] = useState([]); // ['2025-2026', ...]
  const [section, setSection] = useState(null); // { section_id, name, grade_level }
  const [rows, setRows] = useState([]); // [{ time:'', subject:'', teacher:'' }]

  // Select grid based on grade level
  const cfg = useMemo(() => {
    const g = Number(section?.grade_level);
    return gradeConfig[g] || gradeConfig[7];
  }, [section]);

  // One-time: student + default SY list and default value
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setErr('');
      try {
        const userId = Number(localStorage.getItem('user_id'));

        // 1) Student by user
        const { data: sRow, error: sErr } = await supabase
          .from('students')
          .select('student_id, first_name, last_name, lrn, user_id')
          .eq('user_id', userId)
          .order('student_id', { ascending: false })
          .limit(1);
        if (sErr) throw sErr;
        const studentRow = sRow?.[0] || null;
        if (!studentRow?.student_id) {
          setErr('No student record found for this account.');
          setLoading(false);
          return;
        }
        setStudent(studentRow);

        // 2) Get all school years for dropdown, newest first
        const { data: syList, error: syListErr } = await supabase
          .from('school_years')
          .select('school_year, is_active, created_at')
          .order('created_at', { ascending: false });
        if (syListErr) throw syListErr;

        const list = (syList || []).map((r) => r.school_year);
        setSchoolYears(list);

        // pick default: active SY if present, else latest, else STATIC_SY
        const activeRow = (syList || []).find((r) => r.is_active);
        const defaultSY = activeRow?.school_year || list?.[0] || STATIC_SY;
        setActiveSY(defaultSY);
      } catch (e) {
        setErr(e?.message || 'Failed to initialize schedule.');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  // Fetch schedule whenever activeSY changes and student is known
  useEffect(() => {
    if (!student?.student_id || !activeSY) return;

    const loadSchedule = async (sy) => {
      setLoading(true);
      setErr('');
      try {
        // 1) Student's section for selected SY
        const { data: studSec, error: ssErr } = await supabase
          .from('student_sections')
          .select('student_section_id, section_id, school_year')
          .eq('student_id', student.student_id)
          .eq('school_year', sy)
          .order('student_section_id', { ascending: false })
          .limit(1);
        if (ssErr) throw ssErr;
        const ss = studSec?.[0] || null;
        if (!ss?.section_id) {
          setSection(null);
          setRows([]);
          setErr(`No section found for School Year ${sy}.`);
          setLoading(false);
          return;
        }

        // 2) Section info (grade level decides grid)
        const { data: secRow, error: secErr } = await supabase
          .from('sections')
          .select('section_id, name, grade_level')
          .eq('section_id', ss.section_id)
          .order('section_id', { ascending: false })
          .limit(1);
        if (secErr) throw secErr;
        const sec = secRow?.[0] || null;
        setSection(sec);

        // 3) Section schedule slots
        const { data: sched, error: schErr } = await supabase
          .from('teacher_schedules')
          .select('slot_key, teacher_subject_id, section_id')
          .eq('section_id', ss.section_id);
        if (schErr) throw schErr;

        const slotToTsId = new Map();
        const tsIds = new Set();
        (sched || []).forEach((r) => {
          if (r.slot_key && r.teacher_subject_id) {
            slotToTsId.set(r.slot_key, r.teacher_subject_id);
            tsIds.add(r.teacher_subject_id);
          }
        });

        // 4) Teacher_subjects for selected SY
        let tsRows = [];
        if (tsIds.size) {
          const { data: tss, error: tsErr } = await supabase
            .from('teacher_subjects')
            .select('teacher_subject_id, subject_id, teacher_id, school_year')
            .in('teacher_subject_id', Array.from(tsIds))
            .eq('school_year', sy);
          if (tsErr) throw tsErr;
          tsRows = tss || [];
        }

        const subjIds = Array.from(
          new Set(tsRows.map((r) => r.subject_id).filter(Boolean))
        );
        const teacherIds = Array.from(
          new Set(tsRows.map((r) => r.teacher_id).filter(Boolean))
        );

        // 5) Subject names
        let subjNameById = new Map();
        if (subjIds.length) {
          const { data: subs, error: subErr } = await supabase
            .from('subjects')
            .select('subject_id, name')
            .in('subject_id', subjIds);
          if (subErr) throw subErr;
          subjNameById = new Map(
            (subs || []).map((s) => [s.subject_id, s.name])
          );
        }

        // 6) Teacher -> user
        let userIdByTeacherId = new Map();
        if (teacherIds.length) {
          const { data: tRows, error: tErr } = await supabase
            .from('teachers')
            .select('teacher_id, user_id')
            .in('teacher_id', teacherIds);
          if (tErr) throw tErr;
          userIdByTeacherId = new Map(
            (tRows || []).map((t) => [t.teacher_id, t.user_id])
          );
        }

        // 7) User names
        const uIds = Array.from(
          new Set(Array.from(userIdByTeacherId.values()).filter(Boolean))
        );
        let userNameById = new Map();
        if (uIds.length) {
          const { data: uRows, error: uErr } = await supabase
            .from('users')
            .select('user_id, first_name, last_name')
            .in('user_id', uIds);
          if (uErr) throw uErr;
          userNameById = new Map(
            (uRows || []).map((u) => [
              u.user_id,
              `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            ])
          );
        }

        // 8) Build rows for grid
        const tsById = new Map(tsRows.map((r) => [r.teacher_subject_id, r]));
        const grid = cfg?.rows || [];
        const recessKey = cfg?.recessKey;

        const built = grid.map(([mt, _fri, key]) => {
          if (key === recessKey)
            return { time: mt, subject: 'RECESS', teacher: '' };
          const tsId = slotToTsId.get(key);
          if (!tsId) return { time: mt, subject: '—', teacher: '—' };
          const ts = tsById.get(tsId);
          const subj = ts?.subject_id
            ? subjNameById.get(ts.subject_id) || '—'
            : '—';
          const tUserId = ts?.teacher_id
            ? userIdByTeacherId.get(ts.teacher_id)
            : null;
          const tName = tUserId ? userNameById.get(tUserId) || '—' : '—';
          return { time: mt, subject: subj || '—', teacher: tName || '—' };
        });

        setRows(built);
      } catch (e) {
        setErr(e?.message || 'Failed to load schedule.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadSchedule(activeSY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.student_id, activeSY, cfg?.rows, cfg?.recessKey]);

  const fullName =
    `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || '—';

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />
      <div className="studentScheduleContainer">
        <div className="studentWelcoming">
          <p>
            Welcome, {fullName} ({student?.lrn || '—'})
          </p>
        </div>

        <div
          className="pageTitle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>My Daily Schedule</h2>
          <label htmlFor="sy-select" style={{ fontSize: 13, color: '#64748b' }}>
            School Year:
          </label>
          <select
            id="sy-select"
            value={activeSY}
            onChange={(e) => setActiveSY(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 14 }}
          >
            {schoolYears.length === 0 && (
              <option value={activeSY}>{activeSY}</option>
            )}
            {schoolYears.map((sy) => (
              <option key={sy} value={sy}>
                {sy}
              </option>
            ))}
          </select>
        </div>

        <div className="scheduleTableArea">
          <div className="scheduleTableContainer">
            <div className="scheduleTable">
              {loading ? (
                <p>Loading schedule…</p>
              ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Subject</th>
                      <th>Subject Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rows || []).map((r) => {
                      const isRecess = r.subject === 'RECESS';
                      return (
                        <tr
                          key={r.time}
                          className={isRecess ? 'recessRow' : ''}
                        >
                          <td>{r.time}</td>
                          <td className={isRecess ? 'recess' : ''}>
                            {isRecess ? 'RECESS' : r.subject || '—'}
                          </td>
                          <td>{isRecess ? '' : r.teacher || '—'}</td>
                        </tr>
                      );
                    })}
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
