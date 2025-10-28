import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import './scheduling_card.css';
import { supabase } from '../../supabaseClient';

// Weekly-fixed slots
const scheduleRows = [
  ['6:00 - 6:45', '6:00 - 6:40', '6:00-6:45'],
  ['6:45 - 7:30', '6:40 - 7:20', '6:45-7:30'],
  ['7:30 - 8:15', '7:20 - 8:00', '7:30-8:15'],
  ['8:15 - 9:00', '8:00 - 8:40', '8:15-9:00'],
  ['9:00 - 9:20', '8:40 - 9:00', '8:40-9:00'], // Recess
  ['9:20 - 10:05', '9:00 - 9:40', '9:00-9:20'],
  ['10:05 - 10:50', '9:40 - 10:20', '9:20-10:05'],
  ['10:50 - 11:35', '10:20 - 11:00', '10:05-10:50'],
  ['11:35 - 12:20', '11:00 - 11:40', '10:50-11:35'],
  ['', '11:40 - 12:20', '11:35-12:20'], // HGP
];

const RECESS_SLOT_KEY = '8:40-9:00';
const HGP_SLOT_KEY = '11:35-12:20';

export const Scheduling_Card_Gr7 = ({
  search = '',
  subjectId = '',
  sectionId = '',
  selectedDept = 'all',
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessNotif, setShowSuccessNotif] = useState(false);
  const [activeTeacherId, setActiveTeacherId] = useState(null);

  const [teachersGr7, setTeachersGr7] = useState([]);
  const [sectionsPerTeacher, setSectionsPerTeacher] = useState({});
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  const onDragStart = (event, timeKey) => {
    event.dataTransfer.setData('sectionKey', timeKey);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (event) => event.preventDefault();
  const onDrop = (event, dropKey) => {
    event.preventDefault();
    const dragKey = event.dataTransfer.getData('sectionKey');
    if (!dragKey || dragKey === dropKey || !activeTeacherId) return;

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
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrMsg('');

      const sec = sectionId ? Number(sectionId) : null;

      // Advisory-only Grade 7 teachers via INNER JOIN on advisory_section
      let adv = supabase
        .from('teachers')
        .select(
          `
          teacher_id,
          advisory_section:sections!teachers_advisory_section_id_fkey!inner(section_id, name, grade_level),
          department:departments(name, code),
          user:users(first_name, last_name),
          position, degree, major, minor, post_grad, course, is_active
        `
        )
        .eq('advisory_section.grade_level', 7);
      if (sec) adv = adv.eq('advisory_section.section_id', sec);

      const { data: teachers, error: tErr } = await adv;
      if (tErr) throw tErr;

      const teacherIds = (teachers || []).map((t) => t.teacher_id);

      // Seed weekly map with dynamic HGP text from advisory section
      const blankWeekly = () =>
        Object.fromEntries(scheduleRows.map(([, , k]) => [k, '']));
      const seeded = {};
      (teachers || []).forEach((t) => {
        const m = blankWeekly();
        m[RECESS_SLOT_KEY] = 'Recess';
        const advisory =
          Number(t?.advisory_section?.grade_level) === 7 &&
          t?.advisory_section?.name
            ? t.advisory_section.name
            : '—';
        m[HGP_SLOT_KEY] = `HGP - ${advisory}`;
        seeded[t.teacher_id] = m;
      });

      // Hydrate from teacher_schedules (skip HGP to keep dynamic label)
      if (teacherIds.length) {
        const { data: schedRows, error: sErr } = await supabase
          .from('teacher_schedules')
          .select('teacher_id, slot_key, section_name')
          .in('teacher_id', teacherIds);
        if (sErr) throw sErr;

        (schedRows || []).forEach(({ teacher_id, slot_key, section_name }) => {
          if (!seeded[teacher_id]) seeded[teacher_id] = blankWeekly();
          if (slot_key === HGP_SLOT_KEY) return; // keep dynamic HGP
          seeded[teacher_id][slot_key] = section_name || '';
        });
      }

      setTeachersGr7(teachers || []);
      setSectionsPerTeacher(seeded);
    } catch (e) {
      console.error(e);
      setErrMsg('Failed to load Grade 7 teachers.');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await loadData();
    })();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const openModalFor = (teacher_id) => {
    setActiveTeacherId(teacher_id);
    setShowEditModal(true);
  };

  const activeTeacher = useMemo(
    () => teachersGr7.find((t) => t.teacher_id === activeTeacherId) || null,
    [teachersGr7, activeTeacherId]
  );

  const teacherName = (t) =>
    `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim() || '—';
  const deptName = (t) => t?.department?.name || '—';
  const advisoryName = (t) =>
    Number(t?.advisory_section?.grade_level) === 7 && t?.advisory_section?.name
      ? t.advisory_section.name
      : '—';

  const filteredTeachers = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (teachersGr7 || []).filter((t) => {
      const matchesDept =
        selectedDept === 'all' ||
        (t?.department?.code && t.department.code === selectedDept) ||
        (t?.department?.name && t.department.name === selectedDept);
      if (!matchesDept) return false;

      if (!q) return true;
      const full =
        `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [teachersGr7, search, selectedDept]);

  const handleUpdate = async () => {
    try {
      const current = sectionsPerTeacher[activeTeacherId] || {};
      const rows = Object.entries(current)
        .filter(
          ([key, section]) =>
            section &&
            key !== RECESS_SLOT_KEY &&
            key !== HGP_SLOT_KEY &&
            !String(section).startsWith('HGP')
        )
        .map(([slot_key, section_name]) => ({
          teacher_id: activeTeacherId,
          slot_key,
          section_name,
          teacher_subject_id: null,
          section_id: null,
        }));

      const { error } = await supabase
        .from('teacher_schedules')
        .upsert(rows, { onConflict: 'teacher_id,slot_key' });
      if (error) throw error;

      setShowSuccessNotif(true);
    } catch (e) {
      console.error(e);
      setErrMsg('Failed to save schedule.');
    }
  };

  if (loading) {
    return (
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>
        <div className="faculty-card-body">
          <p>Loading Grade 7 teachers…</p>
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

  if (!filteredTeachers.length) {
    return (
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>
        <div className="faculty-card-body">
          <p>No Grade 7 teachers found.</p>
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
          return (
            <div key={t.teacher_id} className="faculty-card">
              <div className="faculty_card_header_grade7"></div>

              <div className="faculty-card-body">
                <h3>Name: {teacherName(t)}</h3>
                <p>
                  <strong>Department:</strong> {deptName(t)}
                </p>
                <p>
                  <strong>Advisory Class:</strong> {advisoryName(t)}
                </p>
                <p>
                  <strong>Grade:</strong> 7
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

                {/* Preview: first 2 time slots */}
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
                    {scheduleRows
                      .slice(0, 2)
                      .map(([monThuTime, _friTime, key]) => (
                        <tr key={key}>
                          <td>{monThuTime}</td>
                          <td>{getValue(key)}</td>
                          <td>{getValue(key)}</td>
                          <td>{getValue(key)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                <div className="buttonContainerCard">
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
      <ReusableModalBox
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
      >
        <div className="scheduduleEdit">
          <div className="faculty_card_header_grade7"></div>
          <div className="scheduleEditBody">
            <h3>Name: {teacherName(activeTeacher)}</h3>
            <p>
              <strong>Department:</strong> {deptName(activeTeacher)}
            </p>
            <p>
              <strong>Advisory Class:</strong> {advisoryName(activeTeacher)}
            </p>
            <p>
              <strong>Grade:</strong> 7
            </p>

            <div className="facultyEditData">
              <div>
                <p>
                  <strong>Degree:</strong> {activeTeacher?.degree || '—'}
                </p>
                <p>
                  <strong>Major:</strong> {activeTeacher?.major || '—'}
                </p>
                <p>
                  <strong>Minor:</strong> {activeTeacher?.minor || '—'}
                </p>
              </div>
              <div>
                <p>
                  <strong>Post Grad:</strong> {activeTeacher?.post_grad || '—'}
                </p>
                <p>
                  <strong>Course:</strong> {activeTeacher?.course || '—'}
                </p>
              </div>
            </div>

            <p className="p-text">Drag Section name to re-arrange schedule</p>

            <table className="scheduleEditTable">
              <thead>
                <tr>
                  <th>Time (Mon-Thu)</th>
                  <th>Time (Fri)</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map(([monThuTime, friTime, key]) => {
                  const weekly = sectionsPerTeacher[activeTeacherId] || {};
                  const value = weekly[key] || '';
                  const isRecess =
                    key === RECESS_SLOT_KEY || value === 'Recess';
                  const isHGP =
                    key === HGP_SLOT_KEY || String(value).startsWith('HGP');
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
                        {value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div
              className="buttonContainer"
              style={{ display: 'flex', gap: 8 }}
            >
              <button className="update-btn" onClick={handleUpdate}>
                Update
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
