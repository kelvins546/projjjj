import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './admin_scheduling.css';
import { Scheduling_Card_Gr7 } from '../../components/admin_comp/Scheduling_Card_Gr7';
import { Scheduling_Card_Gr8 } from '../../components/admin_comp/Scheduling_Card_Gr8';
import { Scheduling_Card_Gr9 } from '../../components/admin_comp/Scheduling_Card_Gr9';
import { Scheduling_Card_Gr10 } from '../../components/admin_comp/Scheduling_Card_Gr10';
import { Scheduling_Card_NoAdvisory } from '../../components/admin_comp/Scheduling_Card_NoAdvisory';
import { supabase } from '../../supabaseClient';

// Seven teaching periods (exclude Recess '8:40-9:00' and HGP '11:35-12:20')
const TEACHING_SLOT_KEYS = [
  '6:00-6:45',
  '6:45-7:30',
  '7:30-8:15',
  '8:15-9:00',
  '9:20-10:05',
  '10:05-10:50',
  '10:50-11:35',
];

export const Admin_Scheduling = () => {
  // Controls
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState(''); // optional: used by NoAdvisory card
  const [grade, setGrade] = useState(''); // '', '7', '8', '9', '10'
  const [sectionId, setSectionId] = useState('');
  const [selectedDept, setSelectedDept] = useState('all'); // department code
  const [facultyType, setFacultyType] = useState('advisory'); // 'advisory' | 'noAdvisory'

  // Data for dropdowns
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Action state
  const [running, setRunning] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // force re-mount of cards to reload data

  // Load filter data: subjects, sections, departments
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      try {
        setLoadingMeta(true);

        const { data: sub, error: subErr } = await supabase
          .from('subjects')
          .select('subject_id, name, code')
          .order('name', { ascending: true });
        if (subErr) throw subErr;

        const { data: secs, error: secErr } = await supabase
          .from('sections')
          .select('section_id, name, grade_level')
          .order('grade_level', { ascending: true })
          .order('name', { ascending: true });
        if (secErr) throw secErr;

        const { data: deptRows, error: dErr } = await supabase
          .from('departments')
          .select('name, code')
          .order('name', { ascending: true });
        if (dErr) throw dErr;

        if (mounted) {
          setSubjects(sub || []);
          setSections(secs || []);
          setDepartments(deptRows || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    };
    loadMeta();
    return () => {
      mounted = false;
    };
  }, []); // one-time metadata load [web:24]

  // Derived sections dropdown filtered by grade selection
  const filteredSections = useMemo(() => {
    if (!grade) return sections;
    const g = Number(grade);
    return sections.filter((s) => Number(s.grade_level) === g);
  }, [sections, grade]); // client-side filter [web:24]

  // When grade changes, reset sectionId if it no longer matches filtered list
  useEffect(() => {
    if (!sectionId) return;
    if (!filteredSections.some((s) => s.section_id === Number(sectionId))) {
      setSectionId('');
    }
  }, [filteredSections, sectionId]); // guard against stale section [web:24]

  // Which grades to operate on (selected grade or all 7–10)
  const getTargetGrades = () => {
    if (grade === '7' || grade === '8' || grade === '9' || grade === '10') {
      return [Number(grade)];
    }
    return [7, 8, 9, 10];
  }; // helper for cross-grade actions [web:21]

  // Fetch adviser teacher_ids for target grades, optionally narrowed by a specific section
  const fetchAdviserTeacherIds = async (grades) => {
    let q = supabase
      .from('teachers')
      .select(
        `
        teacher_id,
        advisory_section:sections!teachers_advisory_section_id_fkey!inner(section_id, grade_level)
      `
      )
      .in('advisory_section.grade_level', grades);
    if (sectionId) q = q.eq('advisory_section.section_id', Number(sectionId));
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((t) => t.teacher_id);
  }; // nested filters and .in for multiple grades [web:24]

  // Centralized: Dry run / Auto-schedule via RPC for one or many grades
  const handleAutoSchedule = async (isDryRun = false) => {
    try {
      if (facultyType !== 'advisory') {
        setActionMsg('Auto-schedule is only available for advisers.');
        return;
      }
      setRunning(true);
      setActionMsg('');
      const grades = getTargetGrades();

      let totalPlaced = 0;
      for (const g of grades) {
        // If a specific section is chosen, narrow to that section’s grade only
        if (sectionId) {
          const sec = sections.find((s) => s.section_id === Number(sectionId));
          if (!sec || Number(sec.grade_level) !== g) continue;
        }
        // grade-aware RPC; PostgREST handles CORS and returns JSON { upserts: N }
        const { data, error } = await supabase.rpc('schedule_build', {
          grade: g,
          dry: isDryRun,
        });
        if (error) throw error;
        const placed = typeof data?.upserts === 'number' ? data.upserts : 0;
        totalPlaced += placed;
      }

      setActionMsg(
        isDryRun
          ? `Dry run complete: ${totalPlaced} slots planned (no changes saved).`
          : `Auto-schedule complete: ${totalPlaced} slots placed.`
      );
      // Force child cards to re-mount so they re-run their loadData
      setReloadKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      setActionMsg('Auto-schedule failed.');
    } finally {
      setRunning(false);
    }
  }; // supabase.rpc for DB-side scheduling [web:21]

  // Centralized: Remove auto-scheduled rows for target grades (and optional section)
  const handleClearAutoSchedule = async () => {
    try {
      if (facultyType !== 'advisory') {
        setActionMsg('Remove is only available for advisers.');
        return;
      }
      setRunning(true);
      setActionMsg('');

      const grades = getTargetGrades();
      // Resolve teacher_ids for the grades/section filter
      const teacherIds = await fetchAdviserTeacherIds(grades);
      if (!teacherIds.length) {
        setActionMsg('Nothing to remove.');
        return;
      }

      let del = supabase
        .from('teacher_schedules')
        .delete()
        .in('teacher_id', teacherIds)
        .in('slot_key', TEACHING_SLOT_KEYS);

      const { error } = await del;
      if (error) throw error;

      setActionMsg('Auto-schedule removed.');
      setReloadKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      setActionMsg('Failed to remove auto-schedule.');
    } finally {
      setRunning(false);
    }
  }; // filtered delete with .in to batch remove rows [web:98][web:104]

  // Helper to render the selected view (cards re-mount on reloadKey changes)
  const renderCards = () => {
    const pass = { search, subjectId, sectionId, selectedDept };
    if (facultyType === 'noAdvisory') {
      return (
        <Scheduling_Card_NoAdvisory key={`noadv-${reloadKey}`} {...pass} />
      );
    }

    if (grade === '7')
      return <Scheduling_Card_Gr7 key={`g7-${reloadKey}`} {...pass} />;
    if (grade === '8')
      return <Scheduling_Card_Gr8 key={`g8-${reloadKey}`} {...pass} />;
    if (grade === '9')
      return <Scheduling_Card_Gr9 key={`g9-${reloadKey}`} {...pass} />;
    if (grade === '10')
      return <Scheduling_Card_Gr10 key={`g10-${reloadKey}`} {...pass} />;

    // No grade selected: show all advisory grades (each keyed for independent re-mount)
    return (
      <>
        <div className="grade_7">
          <Scheduling_Card_Gr7 key={`g7-${reloadKey}`} {...pass} />
        </div>
        <div className="grade_8">
          <Scheduling_Card_Gr8 key={`g8-${reloadKey}`} {...pass} />
        </div>
        <div className="grade_9">
          <Scheduling_Card_Gr9 key={`g9-${reloadKey}`} {...pass} />
        </div>
        <div className="grade_10">
          <Scheduling_Card_Gr10 key={`g10-${reloadKey}`} {...pass} />
        </div>
      </>
    );
  }; // re-mount ensures each card reloads fresh data [web:24]

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <div className="adminSchedulesContainer">
        <h2>Schedules</h2>

        <div className="adminSchedulesSorter">
          <div className="adminScheduleSearch">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="adminScheduleSearchBar"
              placeholder="Search teacher name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loadingMeta}
            />
          </div>

          {/* Faculty type: Advisory vs Non-Advisory */}
          <div className="adminScheduleSortType">
            <label>Faculty Type</label>
            <select
              value={facultyType}
              onChange={(e) => setFacultyType(e.target.value)}
              disabled={loadingMeta}
            >
              <option value="advisory">Advisers</option>
              <option value="noAdvisory">Non-Advisers</option>
            </select>
          </div>

          {/* Department filter */}
          <div className="adminScheduleSortSubject">
            <label>Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={loadingMeta}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade filter: disabled for Non-Advisers (not grade-scoped) */}
          <div className="adminScheduleSortGrade">
            <label>Grade Level</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={loadingMeta || facultyType === 'noAdvisory'}
            >
              <option value="">All Grades</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
            </select>
          </div>

          {/* Section filter: uses grade-scoped list in advisory mode, all sections in non-advisory */}
          <div className="adminScheduleSortSection">
            <label>Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={
                loadingMeta ||
                (facultyType === 'advisory' && filteredSections.length === 0)
              }
            >
              <option value="">All Sections</option>
              {(facultyType === 'advisory' ? filteredSections : sections).map(
                (sec) => (
                  <option key={sec.section_id} value={sec.section_id}>
                    {`G${sec.grade_level} - ${sec.name}`}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Centralized Actions for Advisory mode */}
          <div
            className="adminScheduleActions"
            style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}
          >
            <button
              className="update-btn"
              onClick={() => handleAutoSchedule(true)}
              disabled={running || loadingMeta || facultyType !== 'advisory'}
              title="Dry run (no save)"
            >
              {running ? 'Running…' : 'Dry Run Auto-schedule'}
            </button>
            <button
              className="update-btn"
              onClick={() => handleAutoSchedule(false)}
              disabled={running || loadingMeta || facultyType !== 'advisory'}
              title="Auto-schedule selected grade or all grades"
            >
              {running ? 'Running…' : 'Auto-schedule'}
            </button>
            <button
              className="update-btn"
              onClick={handleClearAutoSchedule}
              disabled={running || loadingMeta || facultyType !== 'advisory'}
              title="Remove auto-scheduled slots"
            >
              {running ? 'Running…' : 'Remove Auto-schedule'}
            </button>
          </div>
        </div>

        {actionMsg ? (
          <div style={{ margin: '10px 0', color: '#2b7fed', fontSize: 13 }}>
            {actionMsg}
          </div>
        ) : null}

        <div className="gradeSchedulesContainer">{renderCards()}</div>
      </div>
    </>
  );
};
