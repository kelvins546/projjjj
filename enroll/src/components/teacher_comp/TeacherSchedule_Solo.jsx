// src/components/teacher/TeacherSchedule_Solo.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

// Match your global SY
const STATIC_SY = '2025-2026';

// Your exact grids (copied verbatim so times match)
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

export default function TeacherSchedule_Solo({ userId }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [teacher, setTeacher] = useState(null); // { teacher_id, advisory_section:{name,grade_level}, user:{first_name,last_name} }
  const [weekly, setWeekly] = useState({}); // { slot_key: section_name }
  const [roomsByKey, setRoomsByKey] = useState({}); // { slot_key: 'Room 201' }

  // Resolve config from advisory grade once teacher is known
  const cfg = useMemo(() => {
    const g = Number(teacher?.advisory_section?.grade_level);
    return gradeConfig[g] || gradeConfig[8]; // fall back to PM grid if unknown
  }, [teacher]);
  const allowedKeys = useMemo(
    () => new Set((cfg?.rows || []).map(([, , k]) => k)),
    [cfg]
  );
  const blank = useMemo(
    () => Object.fromEntries((cfg?.rows || []).map(([, , k]) => [k, ''])),
    [cfg]
  );

  useEffect(() => {
    const run = async () => {
      if (userId == null) return;
      setLoading(true);
      setErr('');
      try {
        // 1) Resolve teacher_id and advisory grade from the current user
        const { data: tRow, error: tErr } = await supabase
          .from('teachers')
          .select(
            `
            teacher_id,
            user:users(first_name,last_name),
            advisory_section:sections!teachers_advisory_section_id_fkey(section_id,name,grade_level)
          `
          )
          .eq('user_id', userId)
          .maybeSingle(); // only the currently logged-in teacher [web:430]
        if (tErr) throw tErr;
        if (!tRow?.teacher_id) {
          setErr('No teacher record found for this account.');
          setLoading(false);
          return;
        }
        setTeacher(tRow);

        // 2) Prepare empty grid and stamp Recess
        const seeded = { ...blank };
        const recessKey = (
          Object.values(gradeConfig).find((v) => v === cfg) || {}
        ).recessKey;
        if (recessKey && allowedKeys.has(recessKey))
          seeded[recessKey] = 'Recess';

        // 3) Fetch only this teacher’s schedule
        const { data: sched, error: sErr } = await supabase
          .from('teacher_schedules')
          .select('slot_key, section_id, section_name, teacher_subject_id')
          .eq('teacher_id', tRow.teacher_id); // scope strictly to this teacher [web:430]
        if (sErr) throw sErr;

        // 4) Keep entries that match the advisory grid’s slot keys
        const sectionIds = new Set();
        (sched || []).forEach(({ slot_key, section_id, section_name }) => {
          if (slot_key && allowedKeys.has(slot_key)) {
            seeded[slot_key] = section_name || seeded[slot_key] || '';
          }
          if (section_id) sectionIds.add(section_id);
        });

        // 5) Mark HGP on the exact slot (if any) for this SY
        const { data: hgpTs, error: hErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id')
          .eq('teacher_id', tRow.teacher_id)
          .eq('school_year', STATIC_SY)
          .eq('is_hgp', true);
        if (hErr) throw hErr;
        const hgpIds = (hgpTs || [])
          .map((r) => r.teacher_subject_id)
          .filter(Boolean);
        if (hgpIds.length) {
          const { data: hSlots, error: hsErr } = await supabase
            .from('teacher_schedules')
            .select('slot_key')
            .in('teacher_subject_id', hgpIds);
          if (hsErr) throw hsErr;
          const hgpSlot = (hSlots || []).find((r) => r.slot_key)?.slot_key;
          if (hgpSlot && allowedKeys.has(hgpSlot)) {
            const adv = tRow?.advisory_section?.name || 'Advisory';
            seeded[hgpSlot] = seeded[hgpSlot]
              ? `${seeded[hgpSlot]} • HGP`
              : `HGP - ${adv}`;
          }
        }

        // 6) Resolve room labels for scheduled sections
        let roomMap = {};
        if (sectionIds.size) {
          const { data: secs, error: secErr } = await supabase
            .from('sections')
            .select('section_id, room_label')
            .in('section_id', Array.from(sectionIds)); // only rooms for the teacher’s current sections [web:430]
          if (secErr) throw secErr;
          const byId = new Map(
            (secs || []).map((s) => [s.section_id, s.room_label])
          );
          roomMap = {};
          (sched || []).forEach(({ slot_key, section_id }) => {
            if (slot_key && section_id && allowedKeys.has(slot_key)) {
              const lbl = byId.get(section_id);
              roomMap[slot_key] = lbl ? `Room ${String(lbl).trim()}` : '';
            }
          });
        }

        setWeekly(seeded);
        setRoomsByKey(roomMap);
      } catch (e) {
        setErr(e?.message || 'Failed to load schedule.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [userId, cfg, allowedKeys, blank]);

  if (loading) {
    return (
      <div className="faculty-card">
        <div
          className={cfg?.headerClassName || 'faculty_card_header_grade8'}
        ></div>
        <div className="faculty-card-body">
          <p>Loading schedule…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="faculty-card">
        <div
          className={cfg?.headerClassName || 'faculty_card_header_grade8'}
        ></div>
        <div className="faculty-card-body">
          <p>{err}</p>
        </div>
      </div>
    );
  }

  const fullName =
    `${teacher?.user?.first_name || ''} ${teacher?.user?.last_name || ''}`.trim() ||
    '—';
  const advName = teacher?.advisory_section?.name || '—';

  return (
    <div className="faculty-card">
      <div
        className={cfg?.headerClassName || 'faculty_card_header_grade8'}
      ></div>
      <div className="faculty-card-body">
        <h3>Name: {fullName}</h3>
        <p>
          <strong>Advisory Class:</strong> {advName}
        </p>
        <p>
          <strong>Advisory Grade:</strong>{' '}
          {teacher?.advisory_section?.grade_level ?? '—'}
        </p>

        <table className="faculty-schedule">
          <thead>
            <tr>
              <th>Time (Mon‑Thu)</th>
              <th>Time (Fri)</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            {(cfg?.rows || []).map(([mt, fr, key]) => {
              const val = weekly[key] || '';
              const room = roomsByKey[key] || '';
              const isRecess = key === cfg.recessKey || val === 'Recess';
              return (
                <tr key={key}>
                  <td>{mt}</td>
                  <td>{fr}</td>
                  <td
                    style={{
                      backgroundColor: isRecess ? '#d4edda' : 'white',
                      fontWeight: isRecess ? 600 : 400,
                      textAlign: 'center',
                    }}
                  >
                    <div>{val || '—'}</div>
                    {room ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {room}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
