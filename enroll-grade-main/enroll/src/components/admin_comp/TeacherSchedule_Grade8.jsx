// src/components/admin_comp/TeacherSchedule_AllGrades.jsx
import './scheduling_card.css';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const scheduleRows = [
  ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
  ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
  ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
  ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
  ['9:00 - 9:20', '8:40 - 9:00', '8:40-9:00'],
  ['9:20 - 10:05', '9:00 - 9:40', '9:00-9:20'],
  ['10:05 - 10:50', '9:40 - 10:20', '9:20-10:05'],
  ['10:50 - 11:35', '10:20 - 11:00', '10:05-10:50'],
  ['11:35 - 12:20', '11:00 - 11:40', '10:50-11:35'],
  ['', '11:40 - 12:20', '11:35-12:20'],
];

const RECESS_SLOT_KEY = '8:40-9:00';
const HGP_SLOT_KEY = '11:35-12:20';

const blankWeekly = () =>
  Object.fromEntries(scheduleRows.map(([, , k]) => [k, '']));

const slotMinutes = (key) => {
  const [s, e] = String(key).split('-');
  if (!s || !e) return 0;
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMin(e) - toMin(s));
};

export default function TeacherSchedule_Gr8({ userId }) {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [gradeMaps, setGradeMaps] = useState({}); // grade_level -> weekly map

  useEffect(() => {
    const uidNum = typeof userId === 'string' ? Number(userId) : userId;
    if (uidNum == null || Number.isNaN(uidNum)) {
      setErrMsg('No userId provided.');
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      setErrMsg('');
      try {
        // 1) Resolve the teacher for this users.user_id
        const { data: trow, error: tErr } = await supabase
          .from('teachers')
          .select(
            `
            teacher_id,
            advisory_section:sections!teachers_advisory_section_id_fkey(section_id, name, grade_level),
            department:departments(name, code),
            user:users(first_name, last_name),
            degree, major, minor, post_grad, course, position, is_active
          `
          )
          .eq('user_id', uidNum)
          .single();
        if (tErr) {
          setErrMsg(tErr.message || 'Failed to resolve teacher.');
          return;
        }
        if (!trow?.teacher_id) {
          setErrMsg('No teacher linked to this user.');
          return;
        }

        // 2) Fetch all schedule rows, joining sections to get grade_level
        const { data: schedRows, error: sErr } = await supabase
          .from('teacher_schedules')
          .select(
            `
            slot_key,
            section_name,
            section:sections(grade_level, name, section_id)
          `
          )
          .eq('teacher_id', trow.teacher_id);
        if (sErr) {
          setErrMsg(sErr.message || 'Failed to load schedule.');
          return;
        }

        // 3) Group by sections.grade_level
        const advisoryName = trow?.advisory_section?.name || '—';
        const advisoryGrade =
          Number(trow?.advisory_section?.grade_level) || null;

        const maps = {};
        const ensureMap = (g) => {
          if (!maps[g]) {
            const m = blankWeekly();
            m[RECESS_SLOT_KEY] = 'Recess';
            m[HGP_SLOT_KEY] =
              `HGP - ${g === advisoryGrade ? advisoryName : '—'}`;
            maps[g] = m;
          }
        };

        (schedRows || []).forEach(({ slot_key, section_name, section }) => {
          const g = Number(section?.grade_level);
          if (!slot_key || Number.isNaN(g)) return;
          ensureMap(g);
          if (slot_key !== HGP_SLOT_KEY) {
            maps[g][slot_key] = section_name || '';
          }
        });

        if (mounted) {
          setTeacher(trow);
          setGradeMaps(maps);
        }
      } catch {
        if (mounted) setErrMsg('Failed to load schedule.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>
        <div className="faculty-card-body">
          <p>Loading schedules…</p>
        </div>
      </div>
    );
  }
  if (errMsg) {
    return (
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>
        <div className="faculty-card-body">
          <p>{errMsg}</p>
        </div>
      </div>
    );
  }
  if (!teacher) {
    return (
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>
        <div className="faculty-card-body">
          <p>No teacher resolved for this user.</p>
        </div>
      </div>
    );
  }

  const teacherName =
    `${teacher?.user?.first_name || ''} ${teacher?.user?.last_name || ''}`.trim() ||
    '—';
  const deptName = teacher?.department?.name || '—';

  return (
    <>
      {Object.entries(gradeMaps).map(([grade, weekly]) => {
        const entries = Object.entries(weekly || {});
        const valid = entries.filter(
          ([k, v]) =>
            v &&
            v !== 'Recess' &&
            k !== HGP_SLOT_KEY &&
            !String(v).startsWith('HGP')
        );
        const count = valid.length;
        const mins = valid.reduce((sum, [k]) => {
          const [s, e] = String(k).split('-');
          if (!s || !e) return sum;
          const toMin = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          return sum + Math.max(0, toMin(e) - toMin(s));
        }, 0);

        return (
          <div className="faculty-card" key={grade}>
            <div className={`faculty_card_header_grade${grade}`}></div>
            <div className="faculty-card-body">
              <h3>Name: {teacherName}</h3>
              <p>
                <strong>Department:</strong> {deptName}
              </p>
              <p>
                <strong>Grade:</strong> {grade}
              </p>
              <p>
                <strong>Teaching load per week:</strong> {count} / {mins} mins
                (weekly)
              </p>

              <table className="faculty-schedule">
                <thead>
                  <tr>
                    <th>Time (Mon-Thu)</th>
                    <th>Time (Fri)</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map(([monThuTime, friTime, key]) => {
                    const value = weekly[key] || '';
                    return (
                      <tr key={`${grade}-${key}`}>
                        <td>{monThuTime}</td>
                        <td>{friTime}</td>
                        <td>{value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
