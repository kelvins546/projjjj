// components/admin_comp/Teacher_Scheduling_Card.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import './scheduling_card.css';
import { supabase } from '../../supabaseClient';

// School year constant
const STATIC_SY = '2025-2026';

// Grade-specific time grids with pseudo rows (Recess only).
// HGP is NOT hardcoded; it is fetched per teacher and stamped on the correct slot.
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

// Combined slot list for all grades (unique by slot_key)
const allRows = (() => {
  const seen = new Set();
  const out = [];
  Object.values(gradeConfig).forEach((cfg) => {
    cfg.rows.forEach(([mon, fri, key]) => {
      if (!seen.has(key)) {
        seen.add(key);
        out.push([mon, fri, key]);
      }
    });
  });
  return out;
})();

// All recess keys across grades (for showing Recess)
const allRecessKeys = new Set(
  Object.values(gradeConfig).map((cfg) => cfg.recessKey)
);

export const Teacher_Scheduling_Card = ({
  gradeLevel = 7,
  search = '',
  subjectId = '',
  sectionId = '',
  selectedDept = 'all',
}) => {
  const cfg = gradeConfig[Number(gradeLevel)] || gradeConfig[7];
  const { headerClassName } = cfg;

  // Per-teacher per-slot room text
  const [roomsByTeacher, setRoomsByTeacher] = useState({});
  // Per-teacher per-slot section_id
  const [idsByTeacherSlot, setIdsByTeacherSlot] = useState({});

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessNotif, setShowSuccessNotif] = useState(false);
  const [activeTeacherId, setActiveTeacherId] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [sectionsPerTeacher, setSectionsPerTeacher] = useState({});
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // Prevent auto-save: snapshot + cancel
  const preEditSnapshotRef = useRef(null);
  const didSaveRef = useRef(false);

  const onDragStart = (event, timeKey) => {
    event.dataTransfer.setData('sectionKey', timeKey);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (event) => event.preventDefault();
  const onDrop = (event, dropKey) => {
    event.preventDefault();
    const dragKey = event.dataTransfer.getData('sectionKey');
    if (!dragKey || dragKey === dropKey || !activeTeacherId) return;

    // swap names
    setSectionsPerTeacher((prev) => {
      const map = { ...prev };
      const current = map[activeTeacherId] || {};
      const copy = { ...current };
      const temp = copy[dragKey] || '';
      copy[dragKey] = copy[dropKey] || '';
      copy[dropKey] = temp;
      map[activeTeacherId] = copy;
      return map;
    });

    // swap section_id
    setIdsByTeacherSlot((prev) => {
      const map = { ...prev };
      const cur = { ...(map[activeTeacherId] || {}) };
      const tempId = cur[dragKey] ?? null;
      cur[dragKey] = cur[dropKey] ?? null;
      cur[dropKey] = tempId;
      map[activeTeacherId] = cur;
      return map;
    });

    // swap room text
    setRoomsByTeacher((prev) => {
      const map = { ...prev };
      const cur = { ...(map[activeTeacherId] || {}) };
      const tempRoom = cur[dragKey] || '';
      cur[dragKey] = cur[dropKey] || '';
      cur[dropKey] = tempRoom;
      map[activeTeacherId] = cur;
      return map;
    });
  };

  // Always use the combined grid
  const activeRows = allRows;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrMsg('');

      const sec = sectionId ? Number(sectionId) : null;

      // Advisers for the chosen grade
      let adv = supabase
        .from('teachers')
        .select(
          `
          teacher_id,
          advisory_section:sections!teachers_advisory_section_id_fkey!inner(section_id, name, grade_level),
          department:departments(name, code, department_id),
          user:users(first_name, last_name),
          position, degree, major, minor, post_grad, course, is_active
        `
        )
        .eq('advisory_section.grade_level', Number(gradeLevel));
      if (sec) adv = adv.eq('advisory_section.section_id', sec);

      const { data: tRows, error: tErr } = await adv;
      if (tErr) throw tErr;

      const teacherIds = (tRows || []).map((t) => t.teacher_id);

      // Seed weekly grid: stamp Recess on all recess slots in combined grid
      const blankWeekly = () =>
        Object.fromEntries(activeRows.map(([, , k]) => [k, '']));
      const seeded = {};
      (tRows || []).forEach((t) => {
        const m = blankWeekly();
        activeRows.forEach(([, , k]) => {
          if (allRecessKeys.has(k)) m[k] = 'Recess';
        });
        seeded[t.teacher_id] = m;
      });

      const roomsByT = {};
      const idsMapBuild = {};

      if (teacherIds.length) {
        // 1) Load all schedules for these teachers
        const { data: schedRows, error: sErr } = await supabase
          .from('teacher_schedules')
          .select(
            'teacher_id, slot_key, section_id, section_name, teacher_subject_id'
          )
          .in('teacher_id', teacherIds)
          .not('slot_key', 'is', null);
        if (sErr) throw sErr;

        // 2) HGP teacher_subject rows and their schedule slots
        const { data: hgpTs, error: hgpErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id, teacher_id, section_id')
          .eq('school_year', STATIC_SY)
          .eq('is_hgp', true)
          .in('teacher_id', teacherIds);
        if (hgpErr) throw hgpErr;

        const hgpTsIds = (hgpTs || [])
          .map((r) => r.teacher_subject_id)
          .filter(Boolean);
        let hgpSched = [];
        if (hgpTsIds.length) {
          const { data: hgpSchedRows, error: hgpSErr } = await supabase
            .from('teacher_schedules')
            .select('teacher_subject_id, teacher_id, slot_key')
            .in('teacher_subject_id', hgpTsIds);
          if (hgpSErr) throw hgpSErr;
          hgpSched = hgpSchedRows || [];
        }
        const hgpSlotByTeacher = new Map();
        (hgpSched || []).forEach((r) => {
          if (r.slot_key) hgpSlotByTeacher.set(r.teacher_id, r.slot_key);
        });

        // 3) Lookup rooms via sections.room_label
        const secIds = [
          ...new Set(
            (schedRows || []).map((r) => r.section_id).filter(Boolean)
          ),
        ];
        let secRoomMap = new Map();
        if (secIds.length) {
          const { data: secRows, error: secErr } = await supabase
            .from('sections')
            .select('section_id, room_label')
            .in('section_id', secIds);
          if (!secErr && Array.isArray(secRows)) {
            secRows.forEach((s) => {
              const roomVal = s?.room_label ? String(s.room_label).trim() : '';
              secRoomMap.set(s.section_id, roomVal ? `Room ${roomVal}` : '');
            });
          } else {
            secRoomMap = new Map(); // fallback
          }
        }

        const allowedKeys = new Set(activeRows.map(([, , k]) => k));

        // 4) Hydrate visible cells + rooms + ids across the combined grid
        (schedRows || []).forEach(
          ({ teacher_id, slot_key, section_id, section_name }) => {
            if (!seeded[teacher_id]) seeded[teacher_id] = blankWeekly();

            // Room capture
            if (section_id) {
              const rmap = roomsByT[teacher_id] || {};
              rmap[slot_key] = secRoomMap.get(section_id) || '';
              roomsByT[teacher_id] = rmap;
            }

            // Id capture
            {
              const imap = idsMapBuild[teacher_id] || {};
              imap[slot_key] = section_id ?? null;
              idsMapBuild[teacher_id] = imap;
            }

            if (allowedKeys.has(slot_key)) {
              seeded[teacher_id][slot_key] =
                section_name || seeded[teacher_id][slot_key] || '';
            }
          }
        );

        // 5) Stamp HGP on each teacher’s actual HGP slot (if known)
        (tRows || []).forEach((t) => {
          const tid = t.teacher_id;
          const weekly = seeded[tid];
          const hgpSlot = hgpSlotByTeacher.get(tid);
          if (weekly && hgpSlot && hgpSlot in weekly) {
            const advisory = t?.advisory_section?.name || 'Advisory';
            if (!weekly[hgpSlot]) {
              weekly[hgpSlot] = `HGP - ${advisory}`;
            } else if (!String(weekly[hgpSlot]).includes('HGP')) {
              weekly[hgpSlot] = `${weekly[hgpSlot]} • HGP`;
            }
          }
        });
      }

      setTeachers(tRows || []);
      setSectionsPerTeacher(seeded);
      setRoomsByTeacher(roomsByT);
      setIdsByTeacherSlot(idsMapBuild);
    } catch (e) {
      console.error('load error:', e);
      setErrMsg(`Failed to load Grade ${gradeLevel} teachers.`);
    } finally {
      setLoading(false);
    }
  }, [gradeLevel, sectionId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await loadData();
    })();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const openModalFor = (teacher_id) => {
    setActiveTeacherId(teacher_id);
    // Snapshot current weekly state for cancel
    preEditSnapshotRef.current = JSON.parse(
      JSON.stringify(sectionsPerTeacher[teacher_id] || {})
    );
    didSaveRef.current = false;
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    // Revert if not saved
    if (!didSaveRef.current && preEditSnapshotRef.current && activeTeacherId) {
      setSectionsPerTeacher((prev) => ({
        ...prev,
        [activeTeacherId]: preEditSnapshotRef.current,
      }));
    }
    preEditSnapshotRef.current = null;
    didSaveRef.current = false;
    setShowEditModal(false);
  };

  const teacherName = (t) =>
    `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim() || '—';
  const deptName = (t) => t?.department?.name || '—';
  const advisoryName = (t) => t?.advisory_section?.name || '—';

  const filteredTeachers = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (teachers || []).filter((t) => {
      const deptId =
        t?.department?.department_id ||
        t?.department?.code ||
        t?.department?.name;
      const matchesDept = selectedDept === 'all' || deptId === selectedDept;
      if (!matchesDept) return false;
      if (!q) return true;
      const full =
        `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [teachers, search, selectedDept]);

  const handleUpdate = async () => {
    try {
      const current = sectionsPerTeacher[activeTeacherId] || {};
      const idMap = idsByTeacherSlot[activeTeacherId] || {};

      // rows to upsert
      const rows = Object.entries(current)
        .filter(([key, section]) => {
          const isRecess = allRecessKeys.has(key) || section === 'Recess';
          const isHgpLabel = String(section).startsWith('HGP');
          return section && !isRecess && !isHgpLabel;
        })
        .map(([slot_key, section_name]) => ({
          teacher_id: activeTeacherId,
          slot_key,
          section_name,
          teacher_subject_id: null,
          section_id: idMap[slot_key] ?? null,
        }));

      // slots to delete (now empty / recess / HGP label)
      const empties = Object.entries(current)
        .filter(([key, section]) => {
          const isRecess = allRecessKeys.has(key) || section === 'Recess';
          const isHgpLabel = String(section).startsWith('HGP');
          return !section || isRecess || isHgpLabel;
        })
        .map(([slot_key]) => slot_key);

      if (rows.length) {
        const { error } = await supabase
          .from('teacher_schedules')
          .upsert(rows, { onConflict: 'teacher_id,slot_key' });
        if (error) throw error;
      }

      if (empties.length) {
        const { error: delErr } = await supabase
          .from('teacher_schedules')
          .delete()
          .eq('teacher_id', activeTeacherId)
          .in('slot_key', empties);
        if (delErr) throw delErr;
      }

      didSaveRef.current = true;
      setShowSuccessNotif(true);
    } catch (e) {
      console.error(e);
      setErrMsg('Failed to save schedule.');
    }
  };

  const handleCancel = () => {
    handleCloseModal();
  };

  if (loading) {
    return (
      <div className="faculty-card">
        <div className={headerClassName}></div>
        <div className="faculty-card-body">
          <p>Loading Grade {gradeLevel} teachers…</p>
        </div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="faculty-card">
        <div className={headerClassName}></div>
        <div className="faculty-card-body">
          <p>{errMsg}</p>
        </div>
      </div>
    );
  }

  if (!filteredTeachers.length) {
    return (
      <div className="faculty-card">
        <div className={headerClassName}></div>
        <div className="faculty-card-body">
          <p>No Grade {gradeLevel} teachers found.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Cards grid */}
      <div className="faculty-cards-grid">
        {filteredTeachers.map((t) => {
          const weekly = sectionsPerTeacher[t.teacher_id] || {};
          const getValue = (k) => weekly[k] || '';
          const roomOf = (k) => roomsByTeacher[t.teacher_id]?.[k] || '';
          return (
            <div key={t.teacher_id} className="faculty-card">
              <div className={headerClassName}></div>

              <div className="faculty-card-body">
                <h3>Name: {teacherName(t)}</h3>
                <p>
                  <strong>Department:</strong> {deptName(t)}
                </p>
                <p>
                  <strong>Advisory Class:</strong> {advisoryName(t)}
                </p>
                <p>
                  <strong>Advisory Grade:</strong> {gradeLevel}
                </p>

                <div className="faculty-details">
                  <div>
                    <p>
                      <strong>Degree:</strong> {t.degree || '—'}
                    </p>
                    <p>
                      <strong>Major:</strong> {t.major || '—'}
                    </p>
                    <p>
                      <strong>Minor:</strong> {t.minor || '—'}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Post Grad:</strong> {t.post_grad || '—'}
                    </p>
                    <p>
                      <strong>Course:</strong> {t.course || '—'}
                    </p>
                  </div>
                </div>

                <p>
                  <strong>Teaching load per week:</strong> —
                </p>
                <p>
                  <strong>Position:</strong> {t.position || '—'}
                </p>

                {/* Preview: first 2 rows of the combined grid */}
                <table className="faculty-schedule">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Mon</th>
                      <th>Tue</th>
                      <th>Wed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows
                      .slice(0, 2)
                      .map(([monThuTime, _friTime, key]) => (
                        <tr key={key}>
                          <td>{monThuTime}</td>
                          <td>
                            {getValue(key)}
                            {roomOf(key) ? (
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {roomOf(key)}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {getValue(key)}
                            {roomOf(key) ? (
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {roomOf(key)}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {getValue(key)}
                            {roomOf(key) ? (
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {roomOf(key)}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                <div className="editButtonCardContainer">
                  <button
                    className="edit-btn"
                    onClick={() => openModalFor(t.teacher_id)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      <ReusableModalBox show={showEditModal} onClose={handleCloseModal}>
        <div className="scheduduleEdit">
          <div className={headerClassName}></div>
          <div className="scheduleEditBody">
            <h3>
              Name:{' '}
              {teacherName(
                teachers.find((tt) => tt.teacher_id === activeTeacherId)
              )}
            </h3>
            <p>
              <strong>Department:</strong>{' '}
              {deptName(
                teachers.find((tt) => tt.teacher_id === activeTeacherId)
              )}
            </p>
            <p>
              <strong>Advisory Class:</strong>{' '}
              {advisoryName(
                teachers.find((tt) => tt.teacher_id === activeTeacherId)
              )}
            </p>
            <p>
              <strong>Advisory Grade:</strong> {gradeLevel}
            </p>

            <div className="facultyEditData">
              <div>
                <p>
                  <strong>Degree:</strong>{' '}
                  {teachers.find((tt) => tt.teacher_id === activeTeacherId)
                    ?.degree || '—'}
                </p>
                <p>
                  <strong>Major:</strong>{' '}
                  {teachers.find((tt) => tt.teacher_id === activeTeacherId)
                    ?.major || '—'}
                </p>
                <p>
                  <strong>Minor:</strong>{' '}
                  {teachers.find((tt) => tt.teacher_id === activeTeacherId)
                    ?.minor || '—'}
                </p>
              </div>
              <div>
                <p>
                  <strong>Post Grad:</strong>{' '}
                  {teachers.find((tt) => tt.teacher_id === activeTeacherId)
                    ?.post_grad || '—'}
                </p>
                <p>
                  <strong>Course:</strong>{' '}
                  {teachers.find((tt) => tt.teacher_id === activeTeacherId)
                    ?.course || '—'}
                </p>
              </div>
            </div>

            <p className="p-text">Drag Section name to re‑arrange schedule</p>

            <table className="scheduleEditTable">
              <thead>
                <tr>
                  <th>Time (Mon‑Thu)</th>
                  <th>Time (Fri)</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map(([monThuTime, friTime, key]) => {
                  const weekly = sectionsPerTeacher[activeTeacherId] || {};
                  const value = weekly[key] || '';
                  const isRecess = allRecessKeys.has(key) || value === 'Recess';
                  const isHGP = String(value).startsWith('HGP');
                  const roomTxt = roomsByTeacher[activeTeacherId]?.[key] || '';
                  return (
                    <tr key={key}>
                      <td>{monThuTime}</td>
                      <td>{friTime}</td>
                      <td
                        draggable={!!value && !isRecess && !isHGP}
                        onDragStart={
                          !isRecess && !isHGP
                            ? (e) => onDragStart(e, key)
                            : undefined
                        }
                        onDrop={
                          !isRecess && !isHGP
                            ? (e) => onDrop(e, key)
                            : undefined
                        }
                        onDragOver={
                          !isRecess && !isHGP ? onDragOver : undefined
                        }
                        style={{
                          cursor:
                            !value || isRecess || isHGP ? 'default' : 'move',
                          userSelect: 'none',
                          backgroundColor: isRecess
                            ? '#d4edda'
                            : isHGP
                              ? '#e2e3e5'
                              : 'white',
                          color: isHGP ? '#333' : 'inherit',
                          fontWeight: isRecess || isHGP ? 600 : 400,
                          textAlign: 'center',
                          padding: '5px',
                        }}
                      >
                        <div>{value}</div>
                        {roomTxt ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {roomTxt}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="editSchedButtonContainer">
              <button className="update-btn" onClick={handleUpdate}>
                Update
              </button>
              <button
                className="update-btn"
                onClick={handleCancel}
                style={{ backgroundColor: '#e5e7eb', color: '#111827' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </ReusableModalBox>

      {/* Success notification */}
      <ReusableModalBox
        show={showSuccessNotif}
        onClose={() => setShowSuccessNotif(false)}
      >
        <div className="notif">
          <div className="img" style={{ paddingTop: '10px' }}>
            <img
              src="checkImg.png"
              alt="Success"
              style={{ height: '50px', width: '50px' }}
            />
          </div>
          <h2>Successfully Updated!</h2>
        </div>
      </ReusableModalBox>
    </>
  );
};

export default Teacher_Scheduling_Card;
