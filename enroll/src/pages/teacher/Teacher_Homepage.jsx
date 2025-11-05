import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './teacher_homepage.css';
import { MasterList } from '../../components/teacher_comp/MasterList';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';

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
    const [h, m] = t.split(':').map(Number);
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

export const Teacher_Homepage = () => {
  const [showMasterList, setShowMasterList] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [loading, setLoading] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [classes, setClasses] = useState([]);

  const [teacherDept, setTeacherDept] = useState({ name: '—', code: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const idStr =
          localStorage.getItem('user_id') ??
          localStorage.getItem('app_user_id');
        const uidNum = idStr != null ? Number(idStr) : null;
        if (uidNum == null || Number.isNaN(uidNum)) return;

        const { data: trow, error: tErr } = await supabase
          .from('teachers')
          .select(
            `
            teacher_id,
            department:departments(name, code)
          `
          )
          .eq('user_id', uidNum)
          .single();
        if (!tErr && mounted) {
          setTeacherId(trow?.teacher_id || null);
          setTeacherDept({
            name: trow?.department?.name || '—',
            code: trow?.department?.code || null,
          });
        }
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
            section_name: secRel?.name || val,
            grade_level: Number(secRel?.grade_level) || '',
            adviser_id: secRel?.adviser_id || null,
            room_label: roomLabel,
            slot_keys: [],
            subject_id: null,
            subject_name: teacherDept.name || '—',
          };
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

  const subjectOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const c of classes) {
      if (!c.subject_id || seen.has(c.subject_id)) continue;
      seen.add(c.subject_id);
      list.push({
        subject_id: c.subject_id,
        name: c.subject_name || `Subject ${c.subject_id}`,
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
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

  return (
    <>
      <Header userRole="teacher" />
      <Navigation_Bar userRole="teacher" />
      <LoadingPopup
        show={loading}
        message="Loading Please Wait..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <div className="teacherHomepageContainer">
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
          <div className="sort">
            <label>Select Grade Level</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={loading}
            >
              <option value="">All Grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{`Grade ${g}`}</option>
              ))}
            </select>
          </div>
          <div className="sort">
            <label>Faculty/Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={loading || subjectOptions.length === 0}
            >
              <option value="">All Subjects</option>
              {subjectOptions.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="archive">
            <i className="fa fa-archive" aria-hidden="true"></i>
          </div>
        </div>

        <div className="classesArea">
          {loading && (
            <div className="classesCard">
              <div className="classesDataContainer">
                <div className="classesData">
                  <h2>Loading…</h2>
                </div>
              </div>
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="classesCard">
              <div className="classesDataContainer">
                <div className="classesData">
                  <h2>No classes found</h2>
                </div>
              </div>
            </div>
          )}
          {!loading &&
            visible.map((c) => (
              <div className="classesCard" key={c.class_key}>
                <div className="classesDataContainer">
                  <div className="classesData">
                    <h2>Subject:</h2>
                    <p>{c.subject_name}</p>
                  </div>
                  <div className="classesData">
                    <h2>Section:</h2>
                    <p>{c.section_name}</p>
                  </div>
                  <div className="classesData">
                    <h2>Room:</h2>
                    <p>{c.room_label}</p>
                  </div>
                  <div className="classesData">
                    <h2>Adviser:</h2>
                    <p>{c.adviser_full_name}</p>
                  </div>
                </div>
                <div className="classesDataContainer">
                  <div className="classesData">
                    <h2>Shift:</h2>
                    <p>{c.shift}</p>
                  </div>
                  <div className="classesData">
                    <h2>Time:</h2>
                    <p>{c.time_label}</p>
                  </div>
                </div>
                <div className="viewMasterListButtonContainer">
                  <button
                    onClick={() => {
                      setSelectedClass(c);
                      setShowMasterList(true);
                    }}
                  >
                    View Masterlist
                  </button>
                </div>
              </div>
            ))}
        </div>

        <MasterList
          showMasterList={showMasterList}
          closeMasterList={() => setShowMasterList(false)}
          sectionId={selectedClass?.section_id}
          sectionName={selectedClass?.section_name}
          gradeLevel={selectedClass?.grade_level}
        />
      </div>
    </>
  );
};
