import { useEffect, useMemo, useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import './scheduling_card.css';
import { supabase } from '../../supabaseClient';

// Combined schedule for non-advisory teachers (can teach any grade)
const scheduleRows = [
  // Morning slots (Grades 7 & 9)
  ['6:00 - 6:45 (G7/9)', '6:00 - 6:40 (G7/9)', '6:00-6:45'],
  ['6:45 - 7:30 (G7/9)', '6:40 - 7:20 (G7/9)', '6:45-7:30'],
  ['7:30 - 8:15 (G7/9)', '7:20 - 8:00 (G7/9)', '7:30-8:15'],
  ['8:15 - 9:00 (G7/9)', '8:00 - 8:40 (G7/9)', '8:15-9:00'],
  ['9:20 - 10:05 (G7/9)', '9:00 - 9:40 (G7/9)', '9:20-10:05'],
  ['10:05 - 10:50 (G7/9)', '9:40 - 10:20 (G7/9)', '10:05-10:50'],
  ['10:50 - 11:35 (G7/9)', '10:20 - 11:00 (G7/9)', '10:50-11:35'],

  // Afternoon slots (Grades 8 & 10)
  ['12:30 - 1:15 (G8/10)', '12:30 - 1:10 (G8/10)', '12:30-1:15'],
  ['1:15 - 2:00 (G8/10)', '1:10 - 1:50 (G8/10)', '1:15-2:00'],
  ['2:00 - 2:45 (G8/10)', '1:50 - 2:30 (G8/10)', '2:00-2:45'],
  ['2:45 - 3:30 (G8/10)', '2:30 - 3:10 (G8/10)', '2:45-3:30'],
  ['3:50 - 4:35 (G8/10)', '3:30 - 4:10 (G8/10)', '3:50-4:35'],
  ['4:35 - 5:20 (G8/10)', '4:10 - 4:50 (G8/10)', '4:35-5:20'],
  ['5:20 - 6:05 (G8/10)', '4:50 - 5:30 (G8/10)', '5:20-6:05'],
  ['6:05 - 6:50 (G8/10)', '5:30 - 6:10 (G8/10)', '6:05-6:50'],
];

// No filtering needed - all slots visible for non-advisory
const visibleRows = scheduleRows;

export const Scheduling_Card_NoAdvisory = ({
  search = '',
  subjectId = '',
  sectionId = '',
  selectedDept = 'all',
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessNotif, setShowSuccessNotif] = useState(false);
  const [activeTeacherId, setActiveTeacherId] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [teacherGrades, setTeacherGrades] = useState({});
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

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrMsg('');

        // Fetch ALL teachers with no advisory (advisory_section_id IS NULL)
        const { data: tRows, error: tErr } = await supabase
          .from('teachers')
          .select(
            `
        teacher_id,
        position,
        degree,
        major,
        minor,
        post_grad,
        course,
        is_active,
        department:departments(name, code),
        user:users(first_name, last_name)
      `
          )
          .is('advisory_section_id', null)
          .eq('is_active', true);
        if (tErr) throw tErr;

        const nonAdvisoryIds = (tRows || []).map((t) => t.teacher_id);

        // Get their teaching assignments (if any) to show grades
        const { data: teachSec, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select(
            `
        teacher_id,
        section:sections(grade_level, name)
      `
          )
          .in('teacher_id', nonAdvisoryIds);
        if (tsErr) throw tsErr;

        // Build map of taught grades per teacher
        const gradesMap = {};
        (teachSec || []).forEach(({ teacher_id, section }) => {
          const g = Number(section?.grade_level);
          if (!Number.isFinite(g)) return;
          if (!gradesMap[teacher_id]) gradesMap[teacher_id] = new Set();
          gradesMap[teacher_id].add(g);
        });

        // Seed weekly map per teacher
        const blankWeekly = () =>
          Object.fromEntries(visibleRows.map(([, , k]) => [k, '']));
        const seeded = {};
        (tRows || []).forEach((t) => {
          const m = blankWeekly();
          seeded[t.teacher_id] = m;
        });

        // Hydrate from teacher_schedules
        if (nonAdvisoryIds.length) {
          const { data: schedRows, error: sErr } = await supabase
            .from('teacher_schedules')
            .select('teacher_id, slot_key, section_name')
            .in('teacher_id', nonAdvisoryIds);
          if (sErr) throw sErr;

          (schedRows || []).forEach(
            ({ teacher_id, slot_key, section_name }) => {
              if (!seeded[teacher_id]) return;
              seeded[teacher_id][slot_key] = section_name || '';
            }
          );
        }

        if (mounted) {
          setTeachers(tRows || []);
          setSectionsPerTeacher(seeded);
          const asObj = {};
          Object.entries(gradesMap).forEach(([tid, set]) => {
            asObj[tid] = Array.from(set).sort((a, b) => a - b);
          });
          setTeacherGrades(asObj);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setErrMsg('Failed to load non-advisory teachers.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [subjectId, sectionId]);

  const openModalFor = (teacher_id) => {
    setActiveTeacherId(teacher_id);
    setShowEditModal(true);
  };

  const teacherName = (t) =>
    `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim() || '—';
  const deptName = (t) => t?.department?.name || '—';
  const gradesList = (teacher_id) => {
    const arr = teacherGrades[teacher_id] || [];
    return arr.length ? `G${arr.join(', G')}` : '—';
  };

  const filteredTeachers = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (teachers || []).filter((t) => {
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
  }, [teachers, search, selectedDept]);

  const handleUpdate = async () => {
    try {
      const current = sectionsPerTeacher[activeTeacherId] || {};
      const rows = Object.entries(current)
        .filter(([, section]) => !!section)
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
          <p>Loading faculty without advisory…</p>
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
          <p>No non-advisory teachers found.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="faculty-cards-grid">
        {filteredTeachers.map((t) => {
          const weekly = sectionsPerTeacher[t.teacher_id] || {};
          const getValue = (k) => weekly[k] || '';
          return (
            <div key={t.teacher_id} className="faculty-card">
              <div className="faculty_card_header_noadvisory"></div>

              <div className="faculty-card-body">
                <h3>Name: {teacherName(t)}</h3>
                <p>
                  <strong>Department:</strong> {deptName(t)}
                </p>
                <p>
                  <strong>Advisory Class:</strong> —
                </p>
                <p>
                  <strong>Grades:</strong> {gradesList(t.teacher_id)}
                </p>

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
                    {visibleRows
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

      <ReusableModalBox
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
      >
        <div className="scheduduleEdit">
          <div className="faculty_card_header_noadvisory"></div>

          <div className="scheduleEditBody">
            <h3>
              Name:{' '}
              {(() => {
                const t = teachers.find(
                  (x) => x.teacher_id === activeTeacherId
                );
                return t
                  ? `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim()
                  : '—';
              })()}
            </h3>
            <p>
              <strong>Department:</strong>{' '}
              {(() => {
                const t = teachers.find(
                  (x) => x.teacher_id === activeTeacherId
                );
                return t?.department?.name || '—';
              })()}
            </p>
            <p>
              <strong>Advisory Class:</strong> —
            </p>
            <p>
              <strong>Grades:</strong> {gradesList(activeTeacherId)}
            </p>

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
                {visibleRows.map(([monThuTime, friTime, key]) => {
                  const weekly = sectionsPerTeacher[activeTeacherId] || {};
                  const value = weekly[key] || '';
                  return (
                    <tr key={key}>
                      <td>{monThuTime}</td>
                      <td>{friTime}</td>
                      <td
                        draggable={!!value}
                        onDragStart={
                          value ? (e) => onDragStart(e, key) : undefined
                        }
                        onDrop={(e) => onDrop(e, key)}
                        onDragOver={onDragOver}
                        style={{
                          cursor: !value ? 'default' : 'move',
                          userSelect: 'none',
                          backgroundColor: 'white',
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
