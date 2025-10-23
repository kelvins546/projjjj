// src/pages/Teacher_Grading.jsx
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './teacher_grading.css';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';

const STATIC_SY = '2025-2026';

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

const parseRange = (slotKeys) => {
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };
  let minS = Infinity,
    maxE = -Infinity;
  for (const key of slotKeys) {
    const [s, e] = String(key).split('-');
    if (!s || !e) continue;
    const sm = toMin(s),
      em = toMin(e);
    if (Number.isFinite(sm)) minS = Math.min(minS, sm);
    if (Number.isFinite(em)) maxE = Math.max(maxE, em);
  }
  if (!Number.isFinite(minS) || !Number.isFinite(maxE))
    return { label: '—', shift: '—' };
  const fmt = (mins) =>
    `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  const label = `${fmt(minS)} - ${fmt(maxE)}`;
  const shift = minS < 12 * 60 ? 'Morning' : 'Afternoon';
  return { label, shift };
};

export const Teacher_Grading = () => {
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [loading, setLoading] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [teacherDept, setTeacherDept] = useState({ id: null, name: '—' });

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);

  const [showViewCard, setShowviewCard] = useState(false);
  const [showEncodeGrade, setShowEncodeGrade] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSubmitNotif, setShowSubmitNotif] = useState(false);

  const [rosterLoading, setRosterLoading] = useState(false);
  const [roster, setRoster] = useState([]);
  const [gradeMap, setGradeMap] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const idStr =
          localStorage.getItem('user_id') ??
          localStorage.getItem('app_user_id');
        const uidNum = idStr != null ? Number(idStr) : null;
        if (uidNum == null || Number.isNaN(uidNum)) return;
        const { data: trow } = await supabase
          .from('teachers')
          .select(
            `
            teacher_id,
            department:departments(department_id, name)
          `
          )
          .eq('user_id', uidNum)
          .single();
        if (!mounted) return;
        setTeacherId(trow?.teacher_id || null);
        setTeacherDept({
          id: trow?.department?.department_id || null,
          name: trow?.department?.name || '—',
        });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: schedRows, error: sErr } = await supabase
          .from('teacher_schedules')
          .select(
            `
            slot_key,
            section_name,
            section_id,
            teacher_subject_id,
            section:sections(
              grade_level,
              name,
              adviser_id,
              section_id,
              room_label
            )
          `
          )
          .eq('teacher_id', teacherId);
        if (sErr) throw sErr;

        const blankWeekly = () =>
          Object.fromEntries(scheduleRows.map(([, , k]) => [k, '']));
        const weekly = blankWeekly();
        weekly[RECESS_SLOT_KEY] = 'Recess';
        weekly[HGP_SLOT_KEY] = 'HGP - —';

        (schedRows || []).forEach((r) => {
          if (!r?.slot_key) return;
          if (r.slot_key === HGP_SLOT_KEY) return;
          if (r.section_name) weekly[r.slot_key] = r.section_name;
        });

        const groups = new Map();
        for (const [, , key] of scheduleRows) {
          const val = (weekly[key] || '').trim();
          if (!val || val === 'Recess' || val.startsWith('HGP')) continue;

          const row = (schedRows || []).find(
            (x) =>
              x.slot_key === key &&
              ((x.section_name || '').trim() === val || x.section_id)
          );
          const secRel = row?.section || null;
          const secId = row?.section_id || secRel?.section_id || null;
          const roomLabel = secRel?.room_label || '—';

          const gkey = secId ? `id:${secId}` : `name:${val}`;
          const curr = groups.get(gkey) || {
            class_key: gkey,
            section_id: secId,
            teacher_subject_id: row?.teacher_subject_id || null,
            subject_id: null,
            subject_name: teacherDept.name || '—',
            section_name: secRel?.name || val,
            room_label: roomLabel,
            grade_level: Number(secRel?.grade_level) || '',
            adviser_id: secRel?.adviser_id || null,
            slot_keys: [],
          };
          if (!curr.teacher_subject_id && row?.teacher_subject_id)
            curr.teacher_subject_id = row.teacher_subject_id;
          curr.slot_keys.push(key);
          groups.set(gkey, curr);
        }

        const adviserIds = Array.from(
          new Set(
            Array.from(groups.values())
              .map((g) => g.adviser_id)
              .filter(Boolean)
          )
        );
        let adviserNameById = new Map();
        if (adviserIds.length) {
          const { data: tRows } = await supabase
            .from('teachers')
            .select('teacher_id, user_id')
            .in('teacher_id', adviserIds);
          const userIds = Array.from(
            new Set((tRows || []).map((t) => t.user_id).filter(Boolean))
          );
          let userMap = new Map();
          if (userIds.length) {
            const { data: uRows } = await supabase
              .from('users')
              .select('user_id, first_name, last_name')
              .in('user_id', userIds);
            userMap = new Map(
              (uRows || []).map((u) => [
                u.user_id,
                `${u.first_name || ''} ${u.last_name || ''}`.trim(),
              ])
            );
          }
          adviserNameById = new Map(
            (tRows || []).map((t) => [
              t.teacher_id,
              userMap.get(t.user_id) || '—',
            ])
          );
        }

        const built = Array.from(groups.values()).map((g) => {
          const { label: time_label, shift } = parseRange(g.slot_keys);
          return {
            class_key: g.class_key,
            section_id: g.section_id,
            teacher_subject_id: g.teacher_subject_id,
            subject_id: g.subject_id,
            subject_name: g.subject_name,
            section_name: g.section_name || '—',
            room_label: g.room_label || '—',
            grade_level: g.grade_level || '',
            adviser_full_name: g.adviser_id
              ? adviserNameById.get(g.adviser_id) || '—'
              : '—',
            time_label,
            shift,
            slot_keys: g.slot_keys,
          };
        });

        if (mounted) setClasses(built);
      } catch (e) {
        console.error(e);
        if (mounted) setClasses([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teacherId, teacherDept.name]);

  const gradeOptions = useMemo(() => {
    const set = new Set(
      classes.map((c) => Number(c.grade_level)).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a - b);
  }, [classes]);

  const visible = useMemo(() => {
    let list = classes.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [
          c.subject_name || '',
          c.section_name || '',
          c.adviser_full_name || '',
          `G${c.grade_level || ''}`,
          c.time_label || '',
          c.shift || '',
          c.room_label || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (grade)
      list = list.filter((c) => Number(c.grade_level) === Number(grade));
    if (subjectId)
      list = list.filter((c) => String(c.subject_id) === String(subjectId));
    return list;
  }, [classes, search, grade, subjectId]);

  const ensureTeacherSubjectId = async (klass) => {
    if (klass.teacher_subject_id) return klass.teacher_subject_id;
    if (!teacherId || !klass.section_id || !teacherDept.id) return null;
    const { data: existing } = await supabase
      .from('teacher_subjects')
      .select('teacher_subject_id')
      .eq('teacher_id', teacherId)
      .eq('section_id', klass.section_id)
      .eq('school_year', STATIC_SY)
      .limit(1);

    if (existing && existing.length) return existing[0].teacher_subject_id;

    const { data: subj } = await supabase
      .from('subjects')
      .select('subject_id')
      .eq('department_id', teacherDept.id)
      .order('subject_id', { ascending: true })
      .limit(1);
    const subject_id = subj && subj.length ? subj[0].subject_id : null;
    if (!subject_id) return null;

    const { data: created } = await supabase
      .from('teacher_subjects')
      .insert({
        teacher_id: teacherId,
        subject_id,
        section_id: klass.section_id,
        school_year: STATIC_SY,
        is_hgp: false,
      })
      .select();

    const tsid =
      created && created.length ? created[0].teacher_subject_id : null;
    return tsid;
  };

  const loadRosterAndGrades = async (klass) => {
    const tsId = await ensureTeacherSubjectId(klass);
    setSelectedClass({ ...klass, teacher_subject_id: tsId || null });
    setRosterLoading(true);
    try {
      const { data: studs } = await supabase
        .from('students')
        .select(
          `
          student_id,
          lrn,
          first_name,
          last_name,
          student_sections:student_sections!inner(section_id, school_year)
        `
        )
        .eq('student_sections.section_id', klass.section_id)
        .eq('student_sections.school_year', STATIC_SY)
        .order('last_name', { ascending: true });

      const rosterList = (studs || []).map((s) => ({
        student_id: s.student_id,
        lrn: s.lrn || '',
        first_name: s.first_name || '',
        last_name: s.last_name || '',
      }));

      const { data: gRows } = await supabase
        .from('grades')
        .select('student_id, quarter, grade')
        .eq('teacher_subject_id', tsId || -1)
        .eq('school_year', STATIC_SY);

      const map = {};
      (gRows || []).forEach((r) => {
        if (!map[r.student_id]) map[r.student_id] = {};
        map[r.student_id][Number(r.quarter)] = Number(r.grade);
      });

      setRoster(rosterList);
      setGradeMap(map);
    } catch (e) {
      console.error(e);
      setRoster([]);
      setGradeMap({});
    } finally {
      setRosterLoading(false);
    }
  };

  const updateGradeCell = (student_id, quarter, val) => {
    setGradeMap((prev) => {
      const m = { ...prev };
      const row = { ...(m[student_id] || {}) };
      const num = val === '' ? undefined : Number(val);
      row[quarter] = Number.isFinite(num) ? num : undefined;
      m[student_id] = row;
      return m;
    });
  };

  const computeFinal = (row) => {
    const arr = [row[1], row[2], row[3], row[4]].filter(
      (x) => typeof x === 'number'
    );
    if (!arr.length) return '—';
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.round(avg);
  };

  const computeRemarks = (finalVal) => {
    if (typeof finalVal !== 'number') return '—';
    return finalVal >= 75 ? 'Passed' : 'Failed';
  };

  const submitGrades = async () => {
    if (!selectedClass?.teacher_subject_id) {
      setShowSubmitConfirm(false);
      return;
    }
    setShowSubmitConfirm(false);
    try {
      const idStr =
        localStorage.getItem('user_id') ?? localStorage.getItem('app_user_id');
      const uidNum = idStr != null ? Number(idStr) : null;
      const studentIds = roster.map((r) => r.student_id);

      await supabase
        .from('grades')
        .delete()
        .eq('teacher_subject_id', selectedClass.teacher_subject_id)
        .eq('school_year', STATIC_SY)
        .in('student_id', studentIds);

      const rows = [];
      for (const s of roster) {
        const r = gradeMap[s.student_id] || {};
        for (const q of [1, 2, 3, 4]) {
          const g = r[q];
          if (typeof g === 'number') {
            rows.push({
              student_id: s.student_id,
              teacher_subject_id: selectedClass.teacher_subject_id,
              school_year: STATIC_SY,
              quarter: q,
              grade: g,
              encoded_by: uidNum || null,
              adviser_approved: false,
              dept_head_approved: false,
              principal_approved: false,
            });
          }
        }
      }
      if (rows.length) {
        const { error } = await supabase.from('grades').insert(rows);
        if (error) throw error;
      }
      setShowSubmitNotif(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Header userRole="teacher" />
      <LoadingPopup
        show={loading}
        message="Loading Please Wait..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <Navigation_Bar userRole="teacher" />
      <div className="teacherGradingContainer">
        <div className="sorters">
          <div className="search">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="Searchbar"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="sorter">
            <label>Select Grade Level</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              {Array.from(
                new Set(classes.map((c) => c.grade_level).filter(Boolean))
              )
                .sort((a, b) => Number(a) - Number(b))
                .map((g) => (
                  <option key={g} value={g}>
                    {`Grade ${g}`}
                  </option>
                ))}
            </select>
          </div>
          <div className="sorter">
            <label>Faculty/Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled
            >
              <option value="">All Subjects</option>
            </select>
          </div>
          <div className="archive">
            <i className="fa fa-archive" aria-hidden="true"></i>
          </div>
        </div>

        <div className="gradingArea">
          {loading && (
            <div className="gradingCard">
              <div className="gradingDataContainer">
                <div className="gradingData">
                  <h2>Loading…</h2>
                </div>
              </div>
            </div>
          )}

          {!loading &&
            visible.map((c) => (
              <div className="gradingCard" key={c.class_key}>
                <div className="gradingDataContainer">
                  <div className="gradingData">
                    <h2>Subject:</h2>
                    <p>{c.subject_name}</p>
                  </div>
                  <div className="gradingData">
                    <h2>Section:</h2>
                    <p>{c.section_name}</p>
                  </div>
                  <div className="gradingData">
                    <h2>Adviser:</h2>
                    <p>{c.adviser_full_name}</p>
                  </div>
                </div>
                <div className="gradingDataContainer">
                  <div className="gradingData">
                    <h2>Shift:</h2>
                    <p>{c.shift}</p>
                  </div>
                  <div className="gradingData">
                    <h2>Time:</h2>
                    <p>{c.time_label}</p>
                  </div>
                  <div className="gradingData">
                    <h2>Room:</h2>
                    <p>{c.room_label}</p>
                  </div>
                </div>
                <div className="buttonContainer">
                  <button
                    onClick={async () => {
                      await loadRosterAndGrades(c);
                      setShowviewCard(true);
                    }}
                  >
                    View Here
                  </button>
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={async () => {
                      await loadRosterAndGrades(c);
                      setShowEncodeGrade(true);
                    }}
                  >
                    Encode Grade
                  </button>
                </div>
              </div>
            ))}
        </div>

        <ReusableModalBox
          show={showViewCard}
          onClose={() => setShowviewCard(false)}
        >
          <div className="viewGrade">
            <div className="gradesTable">
              <table className="gradesTable">
                <thead>
                  <tr>
                    <th rowSpan="2">LRN</th>
                    <th rowSpan="2">Name</th>
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
                  {rosterLoading ? (
                    <tr>
                      <td colSpan={8}>Loading…</td>
                    </tr>
                  ) : roster.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No students</td>
                    </tr>
                  ) : (
                    roster.map((s, idx) => {
                      const row = gradeMap[s.student_id] || {};
                      const finalVal = computeFinal(row);
                      return (
                        <tr key={s.student_id}>
                          <td>{s.lrn || '—'}</td>
                          <td>
                            {idx + 1}. {s.last_name?.toUpperCase() || ''},{' '}
                            {s.first_name || ''}
                          </td>
                          <td>{row[1] ?? ''}</td>
                          <td>{row[2] ?? ''}</td>
                          <td>{row[3] ?? ''}</td>
                          <td>{row[4] ?? ''}</td>
                          <td>
                            {typeof finalVal === 'number' ? finalVal : ''}
                          </td>
                          <td>{computeRemarks(finalVal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showEncodeGrade}
          onClose={() => setShowEncodeGrade(false)}
        >
          <div className="viewGrade">
            <div className="gradesTable">
              <table className="gradesTable">
                <thead>
                  <tr>
                    <th rowSpan="2">LRN</th>
                    <th rowSpan="2">Name</th>
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
                  {rosterLoading ? (
                    <tr>
                      <td colSpan={8}>Loading…</td>
                    </tr>
                  ) : roster.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No students</td>
                    </tr>
                  ) : (
                    roster.map((s, idx) => {
                      const row = gradeMap[s.student_id] || {};
                      const finalVal = computeFinal(row);
                      return (
                        <tr key={s.student_id}>
                          <td>{s.lrn || '—'}</td>
                          <td>
                            {idx + 1}. {s.last_name?.toUpperCase() || ''},{' '}
                            {s.first_name || ''}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={row[1] ?? ''}
                              onChange={(e) =>
                                updateGradeCell(s.student_id, 1, e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={row[2] ?? ''}
                              onChange={(e) =>
                                updateGradeCell(s.student_id, 2, e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={row[3] ?? ''}
                              onChange={(e) =>
                                updateGradeCell(s.student_id, 3, e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={row[4] ?? ''}
                              onChange={(e) =>
                                updateGradeCell(s.student_id, 4, e.target.value)
                              }
                            />
                          </td>
                          <td>
                            {typeof finalVal === 'number' ? finalVal : ''}
                          </td>
                          <td>{computeRemarks(finalVal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="encodeBtns">
              <button className="import">Import CSV</button>
              <button onClick={() => setShowSubmitConfirm(true)}>Submit</button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showSubmitConfirm}
          onClose={() => setShowSubmitConfirm(false)}
        >
          <div className="confirmSubmit">
            <p>You're about to submit the grades for this section. Proceed?</p>
            <div className="btnContainer">
              <button
                className="cancel"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button onClick={submitGrades}>Proceed</button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showSubmitNotif}
          onClose={() => setShowSubmitNotif(false)}
        >
          <div className="notif">
            <div className="img" style={{ paddingTop: '10px' }}>
              <img
                src="checkImg.png"
                alt="Success"
                style={{ height: '50px', width: '50px' }}
              />
            </div>
            <h2>Successfully Submitted!</h2>
          </div>
        </ReusableModalBox>
      </div>
    </>
  );
};
