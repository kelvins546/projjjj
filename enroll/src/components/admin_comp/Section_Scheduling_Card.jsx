// components/admin_comp/Section_Scheduling_Card.jsx
import { useCallback, useEffect, useState } from 'react';
import './scheduling_card.css';
import { supabase } from '../../supabaseClient';

// Time grids per grade (same keys as teacher view; include Recess)
const gradeConfig = {
  7: {
    headerClassName: 'faculty_card_header_grade7',
    rows: [
      ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
      ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
      ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
      ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
      ['9:00 - 9:20', '8:40 - 9:00', '9:00-9:20'], // Recess
      ['9:20 - 10:05', '9:00 - 9:40', '9:20-10:05'],
      ['10:05 - 10:50', '9:40 - 10:20', '10:05-10:50'],
      ['10:50 - 11:35', '10:20 - 11:00', '10:50-11:35'],
      ['11:35 - 12:20', '11:00 - 11:40', '11:35-12:20'],
    ],
    recessKey: '9:00-9:20',
  },
  8: {
    headerClassName: 'faculty_card_header_grade8',
    rows: [
      ['12:30 - 1:15', '12:30 - 1:10', '12:30-1:15'],
      ['1:15 - 2:00', '1:10 - 1:50', '1:15-2:00'],
      ['2:00 - 2:45', '1:50 - 2:30', '2:00-2:45'],
      ['2:45 - 3:30', '2:30 - 3:10', '2:45-3:30'],
      ['3:30 - 3:50', '3:10 - 3:30', '3:30-3:50'], // Recess
      ['3:50 - 4:35', '3:30 - 4:10', '3:50-4:35'],
      ['4:35 - 5:20', '4:10 - 4:50', '4:35-5:20'],
      ['5:20 - 6:05', '4:50 - 5:30', '5:20-6:05'],
      ['6:05 - 6:50', '5:30 - 6:10', '6:05-6:50'],
    ],
    recessKey: '3:30-3:50',
  },
  9: {
    headerClassName: 'faculty_card_header_grade9',
    rows: [
      ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
      ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
      ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
      ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
      ['9:00 - 9:20', '8:40 - 9:00', '9:00-9:20'], // Recess
      ['9:20 - 10:05', '9:00 - 9:40', '9:20-10:05'],
      ['10:05 - 10:50', '9:40 - 10:20', '10:05-10:50'],
      ['10:50 - 11:35', '10:20 - 11:00', '10:50-11:35'],
      ['11:35 - 12:20', '11:00 - 11:40', '11:35-12:20'],
    ],
    recessKey: '9:00-9:20',
  },
  10: {
    headerClassName: 'faculty_card_header_grade10',
    rows: [
      ['12:30 - 1:15', '12:30 - 1:10', '12:30-1:15'],
      ['1:15 - 2:00', '1:10 - 1:50', '1:15-2:00'],
      ['2:00 - 2:45', '1:50 - 2:30', '2:00-2:45'],
      ['2:45 - 3:30', '2:30 - 3:10', '2:45-3:30'],
      ['3:30 - 3:50', '3:10 - 3:30', '3:30-3:50'], // Recess
      ['3:50 - 4:35', '3:30 - 4:10', '3:50-4:35'],
      ['4:35 - 5:20', '4:10 - 4:50', '4:35-5:20'],
      ['5:20 - 6:05', '4:50 - 5:30', '5:20-6:05'],
      ['6:05 - 6:50', '5:30 - 6:10', '6:05-6:50'],
    ],
    recessKey: '3:30-3:50',
  },
};

export const Section_Scheduling_Card = ({
  gradeLevel = null, // '7' | '8' | '9' | '10' | 'all' | null
  sectionId = '',
  search = '',
}) => {
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [sections, setSections] = useState([]);
  const [weeklyBySection, setWeeklyBySection] = useState({}); // section_id -> { slot_key: label }

  const isAllGrades = String(gradeLevel).toLowerCase() === 'all';
  const activeGrade = !isAllGrades && gradeLevel ? Number(gradeLevel) : null;

  const blankWeeklyForGrade = (g) =>
    Object.fromEntries((gradeConfig[g]?.rows || []).map(([, , k]) => [k, '']));

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrMsg('');

      // Sections
      let secQ = supabase
        .from('sections')
        .select('section_id, name, grade_level, room_label')
        .order('grade_level', { ascending: true })
        .order('name', { ascending: true });
      if (!isAllGrades && activeGrade)
        secQ = secQ.eq('grade_level', activeGrade);
      if (sectionId) secQ = secQ.eq('section_id', Number(sectionId));
      const { data: secRows, error: secErr } = await secQ;
      if (secErr) throw secErr;

      const q = (search || '').trim().toLowerCase();
      const secFiltered = (secRows || []).filter((s) =>
        !q ? true : (s.name || '').toLowerCase().includes(q)
      );
      const secIds = secFiltered.map((s) => s.section_id);
      const secNames = secFiltered.map((s) => s.name).filter(Boolean);
      const secNameToId = new Map(
        secFiltered.map((s) => [String(s.name || ''), s.section_id])
      );
      const secIdToGrade = new Map(
        secFiltered.map((s) => [s.section_id, Number(s.grade_level)])
      );

      // Seed weekly maps (with Recess)
      const seeded = {};
      secFiltered.forEach((s) => {
        const g = Number(s.grade_level);
        const cfg = gradeConfig[g];
        const m = blankWeeklyForGrade(g);
        if (cfg?.recessKey) m[cfg.recessKey] = 'Recess';
        seeded[s.section_id] = m;
      });

      if (secIds.length) {
        // Schedules by section_id
        const { data: schedById, error: schedErrA } = await supabase
          .from('teacher_schedules')
          .select(
            'teacher_id, slot_key, section_id, section_name, teacher_subject_id'
          )
          .in('section_id', secIds);
        if (schedErrA) throw schedErrA;

        // Schedules where section_id is null but the name matches our sections
        let schedByName = [];
        if (secNames.length) {
          const { data: schedNullSec, error: schedErrB } = await supabase
            .from('teacher_schedules')
            .select(
              'teacher_id, slot_key, section_id, section_name, teacher_subject_id'
            )
            .is('section_id', null)
            .in('section_name', secNames);
          if (schedErrB) throw schedErrB;
          schedByName = (schedNullSec || [])
            .map((r) => ({
              ...r,
              section_id: secNameToId.get(String(r.section_name || '')) || null,
            }))
            .filter((r) => r.section_id);
        }

        // Merge schedules and de-duplicate
        const merged = [...(schedById || []), ...schedByName];
        const schedRows = [];
        const seen = new Set();
        const scheduledTsIds = new Set();
        const scheduledTeacherBySection = new Map(); // section_id -> Set(teacher_id)

        for (const r of merged) {
          const key = `${r.teacher_id}||${r.section_id}||${r.slot_key}`;
          if (seen.has(key)) continue;
          seen.add(key);
          schedRows.push(r);
          if (r.teacher_subject_id) scheduledTsIds.add(r.teacher_subject_id);
          if (r.section_id && r.teacher_id) {
            const set =
              scheduledTeacherBySection.get(r.section_id) || new Set();
            set.add(r.teacher_id);
            scheduledTeacherBySection.set(r.section_id, set);
          }
        }

        // Teacher names
        const teacherIds = [
          ...new Set(
            (schedRows || []).map((r) => r.teacher_id).filter(Boolean)
          ),
        ];
        // Also include teachers from teacher_subjects fallback
        const { data: tsForNames } = await supabase
          .from('teacher_subjects')
          .select('teacher_id')
          .in('section_id', secIds)
          .eq('school_year', '2025-2026');
        const extraIds = new Set((tsForNames || []).map((r) => r.teacher_id));
        const allIds = [...new Set([...teacherIds, ...extraIds])];

        let nameMap = new Map();
        if (allIds.length) {
          const { data: tRows, error: tErr } = await supabase
            .from('teachers')
            .select('teacher_id, user:users(first_name, last_name)')
            .in('teacher_id', allIds);
          if (tErr) throw tErr;
          (tRows || []).forEach((t) => {
            const nm =
              `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim();
            nameMap.set(t.teacher_id, nm || `Teacher ${t.teacher_id}`);
          });
        }

        // HGP slots per section
        const { data: hgpTs, error: hgpErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id, teacher_id, section_id')
          .in('section_id', secIds)
          .eq('is_hgp', true)
          .eq('school_year', '2025-2026');
        if (hgpErr) throw hgpErr;

        const hgpTsIds = (hgpTs || [])
          .map((r) => r.teacher_subject_id)
          .filter(Boolean);
        const hgpBySection = new Map();
        if (hgpTsIds.length) {
          const { data: hgpSched, error: hgpSchedErr } = await supabase
            .from('teacher_schedules')
            .select('teacher_subject_id, section_id, slot_key')
            .in('teacher_subject_id', hgpTsIds);
          if (hgpSchedErr) throw hgpSchedErr;
          (hgpSched || []).forEach((r) => {
            if (r.section_id && r.slot_key)
              hgpBySection.set(r.section_id, r.slot_key);
          });
        }

        // Fill scheduled names
        (schedRows || []).forEach(({ teacher_id, slot_key, section_id }) => {
          const g = secIdToGrade.get(section_id);
          if (!g) return;
          const allowedKeys = new Set(
            (gradeConfig[g]?.rows || []).map(([, , k]) => k)
          );
          if (!allowedKeys.has(slot_key)) return;
          const m = seeded[section_id] || blankWeeklyForGrade(g);
          const nm = nameMap.get(teacher_id) || `Teacher ${teacher_id}`;
          m[slot_key] = nm;
          seeded[section_id] = m;
        });

        // Fallback: place unscheduled teacher_subjects into first open non-recess slots
        // Fallback: place unscheduled teacher_subjects into first open non-recess slots
        const { data: tsRows, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id, teacher_id, section_id')
          .in('section_id', secIds)
          .eq('school_year', '2025-2026');
        if (tsErr) throw tsErr;

        // Index TS per section; do NOT collapse by teacher_id.
        // One TS row should occupy one period, even if multiple TS share the same teacher.
        const tsBySection = new Map();
        (tsRows || []).forEach((r) => {
          const arr = tsBySection.get(r.section_id) || [];
          arr.push(r);
          tsBySection.set(r.section_id, arr);
        });

        secFiltered.forEach((s) => {
          const g = Number(s.grade_level);
          const cfg = gradeConfig[g];
          const keys = (cfg?.rows || [])
            .map(([, , k]) => k)
            .filter((k) => k !== cfg?.recessKey);
          const m = seeded[s.section_id] || blankWeeklyForGrade(g);

          // Sort to make fills deterministic (optional)
          const pending = (tsBySection.get(s.section_id) || [])
            // only those TS not already scheduled by TS id
            .filter((r) => !scheduledTsIds.has(r.teacher_subject_id))
            // stable order by teacher_id then ts_id
            .sort(
              (a, b) =>
                a.teacher_id - b.teacher_id ||
                a.teacher_subject_id - b.teacher_subject_id
            );

          for (const p of pending) {
            const slot = keys.find((k) => !m[k]);
            if (!slot) break;
            m[slot] = nameMap.get(p.teacher_id) || `Teacher ${p.teacher_id}`;
          }

          seeded[s.section_id] = m;
        });

        // HGP stamp
        secFiltered.forEach((s) => {
          const g = Number(s.grade_level);
          const m = seeded[s.section_id] || blankWeeklyForGrade(g);
          const hgpSlot = hgpBySection.get(s.section_id);
          if (hgpSlot && hgpSlot in m) {
            if (!m[hgpSlot]) m[hgpSlot] = `HGP - ${s.name}`;
            else if (!String(m[hgpSlot]).includes('HGP'))
              m[hgpSlot] = `${m[hgpSlot]} • HGP`;
            seeded[s.section_id] = m;
          }
        });
      }

      setSections(secFiltered);
      setWeeklyBySection(seeded);
    } catch (e) {
      console.error('section load error:', e);
      setErrMsg(
        isAllGrades
          ? 'Failed to load sections (All grades).'
          : `Failed to load sections for Grade ${activeGrade || '—'}.`
      );
    } finally {
      setLoading(false);
    }
  }, [gradeLevel, sectionId, search, isAllGrades, activeGrade]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await loadData();
    })();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  if (!isAllGrades && !activeGrade) {
    return (
      <div className="faculty-card">
        <div className="faculty-card-body">
          <p>
            Please choose a Grade Level or select “All” to view section
            schedules.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="faculty-card">
        <div className="faculty-card-body">
          <p>
            {isAllGrades
              ? 'Loading section schedules (All grades)…'
              : `Loading section schedules for Grade ${activeGrade}…`}
          </p>
        </div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="faculty-card">
        <div className="faculty-card-body">
          <p>{errMsg}</p>
        </div>
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div className="faculty-card">
        <div className="faculty-card-body">
          <p>
            {isAllGrades
              ? 'No sections found (All grades).'
              : `No sections found for Grade ${activeGrade}.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="faculty-cards-grid">
      {sections.map((sec) => {
        const g = Number(sec.grade_level);
        const cfg = gradeConfig[g];
        const weekly = weeklyBySection[sec.section_id] || {};
        const room = sec?.room_label ? `Room ${sec.room_label}` : '';
        return (
          <div key={sec.section_id} className="faculty-card">
            <div className={cfg?.headerClassName || ''}></div>
            <div className="faculty-card-body">
              <h3>{`G${g} - ${sec.name}`}</h3>
              {room && (
                <p>
                  <strong>Room:</strong> {room}
                </p>
              )}

              <table className="faculty-schedule">
                <thead>
                  <tr>
                    <th>Time (Mon‑Thu)</th>
                    <th>Time (Fri)</th>
                    <th>Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {(cfg?.rows || []).map(([monThuTime, friTime, key]) => {
                    const val = weekly[key] || '';
                    const isRecess = key === cfg?.recessKey || val === 'Recess';
                    const isHGP = String(val).startsWith('HGP');
                    return (
                      <tr key={key}>
                        <td>{monThuTime}</td>
                        <td>{friTime}</td>
                        <td
                          style={{
                            backgroundColor: isRecess
                              ? '#d4edda'
                              : isHGP
                                ? '#e2e3e5'
                                : 'white',
                            fontWeight: isRecess || isHGP ? 600 : 400,
                            textAlign: 'center',
                            padding: '5px',
                          }}
                        >
                          {val || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
