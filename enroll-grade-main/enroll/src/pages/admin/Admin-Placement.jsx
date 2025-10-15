import './admin_placement.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import { useState, useEffect, useMemo } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import { ReusableConfirmationModalBox } from '../../components/modals/Reusable_Confirmation_Modal';
import { supabase } from '../../supabaseClient';

const GRADES = [
  { label: 'Grade 7', value: 7 },
  { label: 'Grade 8', value: 8 },
  { label: 'Grade 9', value: 9 },
  { label: 'Grade 10', value: 10 },
];

export const Admin_Placement = () => {
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showOverrideSection, setShowOverrideSection] = useState(false);
  const [showOverrideStudent, setShowOverrideStudent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showApplySection, setShowApplySection] = useState(false);
  const [showApplyStudent, setShowApplyStudent] = useState(false);
  const [showApplyNotif, setShowApplyNotif] = useState(false);
  const [showAddNotif, setShowAddNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState(
    'Changes Applied Successfully!'
  );

  // Nav
  const [activeSection, setActiveSection] = useState('sectionList');

  // Filters and search (sections)
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionListGrade, setSectionListGrade] = useState('');
  // Replaced "sectionListSection" with star filter
  const [sectionStarFilter, setSectionStarFilter] = useState(''); // '', 'yes', 'no'

  // Filters and search (students)
  const [studentSearch, setStudentSearch] = useState('');
  const [studentListGrade, setStudentListGrade] = useState('');
  const [studentListSection, setStudentListSection] = useState('');

  // Data sets
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);

  // Loading
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // For override selections
  const [overrideSectionId, setOverrideSectionId] = useState(null);
  const [overrideTeacherId, setOverrideTeacherId] = useState('');
  const [overrideStudentId, setOverrideStudentId] = useState(null);
  const [overrideTargetSectionName, setOverrideTargetSectionName] =
    useState('');

  // Fetch sections with embedded adviser (teacher -> user)
  // IMPORTANT: Do NOT select is_star here since your DB doesn't have that column yet.
  const loadSections = async () => {
    setLoadingSections(true);
    try {
      const { data, error } = await supabase
        .from('sections')
        .select(
          `
          section_id,
          name,
          grade_level,
          adviser_id,
          adviser:teachers!sections_adviser_id_fkey(
            teacher_id,
            user:users!teachers_user_id_fkey(
              first_name,
              last_name
            )
          )
        `
        )
        .order('name');
      if (error) throw error;
      setSections(data || []);
    } catch (e) {
      console.error('Failed to load sections:', e);
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  // Fetch available teachers not yet advisers; attach display_name via users
  const loadAvailableTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('teacher_id, user_id, is_active, advisory_section_id')
        .is('advisory_section_id', null)
        .eq('is_active', true);
      if (error) throw error;

      const teacherUserIds = (data || []).map((t) => t.user_id);
      let nameByUser = new Map();
      if (teacherUserIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', teacherUserIds);
        nameByUser = new Map(
          (users || []).map((u) => [
            u.user_id,
            `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          ])
        );
      }
      const withNames = (data || []).map((t) => ({
        ...t,
        display_name: nameByUser.get(t.user_id) || `Teacher ${t.teacher_id}`,
      }));
      setTeachers(withNames);
    } catch (e) {
      console.error('Failed to load teachers:', e);
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Fetch students and embed their section plus adviser (teacher -> user); normalize a flat adviser_full_name
  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase.from('students').select(`
          student_id,
          first_name,
          last_name,
          gender,
          student_sections:student_sections(
            section:sections(
              name,
              grade_level,
              adviser:teachers!sections_adviser_id_fkey(
                user:users!teachers_user_id_fkey(first_name, last_name)
              )
            )
          )
        `);
      if (error) throw error;

      const normalized = (data || []).map((s) => {
        const rel = Array.isArray(s.student_sections)
          ? s.student_sections[0]
          : s.student_sections;
        const sec = rel?.section || null;
        const advUser = sec?.adviser?.user || null;
        return {
          student_id: s.student_id,
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          gender: s.gender || '—',
          grade_level:
            typeof sec?.grade_level === 'number' ? sec.grade_level : '',
          section: sec?.name || '',
          adviser_full_name: advUser
            ? `${advUser.first_name || ''} ${advUser.last_name || ''}`.trim()
            : '',
          is_star: false,
        };
      });

      setStudents(normalized);
    } catch (e) {
      console.error('Failed to load students:', e);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadSections();
    loadAvailableTeachers();
    loadStudents();
  }, []);

  // Derived filtering
  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    return sections.filter((s) => {
      const matchesText = !q || s.name.toLowerCase().includes(q);
      const matchesGrade =
        !sectionListGrade || Number(s.grade_level) === Number(sectionListGrade);
      // Star filter without DB column:
      // Treat truthy s.is_star as star; undefined => false (i.e., will show under "No")
      const matchesStar =
        sectionStarFilter === ''
          ? true
          : sectionStarFilter === 'yes'
            ? !!s.is_star
            : !s.is_star;
      return matchesText && matchesGrade && matchesStar;
    });
  }, [sections, sectionSearch, sectionListGrade, sectionStarFilter]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      const full = `${s.first_name} ${s.last_name}`.trim().toLowerCase();
      const matchesText = !q || full.includes(q);
      const matchesGrade =
        !studentListGrade || Number(s.grade_level) === Number(studentListGrade);
      const matchesSection =
        !studentListSection || s.section === studentListSection;
      return matchesText && matchesGrade && matchesSection;
    });
  }, [students, studentSearch, studentListGrade, studentListSection]);

  // Pagination (Sections)
  const [pageSec, setPageSec] = useState(1);
  const [pageSizeSec, setPageSizeSec] = useState(10);
  const totalRowsSec = filteredSections.length;
  const totalPagesSec = Math.max(1, Math.ceil(totalRowsSec / pageSizeSec));
  const startIdxSec = (pageSec - 1) * pageSizeSec;
  const endIdxSec = Math.min(startIdxSec + pageSizeSec, totalRowsSec);
  const pageRowsSec = filteredSections.slice(startIdxSec, endIdxSec);

  useEffect(() => {
    setPageSec((p) => Math.min(Math.max(1, p), totalPagesSec));
  }, [totalPagesSec]);

  const MAX_PAGES = 5;
  const getPageNumbersSec = () => {
    if (totalPagesSec <= MAX_PAGES)
      return Array.from({ length: totalPagesSec }, (_, i) => i + 1);
    const half = Math.floor(MAX_PAGES / 2);
    let start = Math.max(1, pageSec - half);
    let end = Math.min(totalPagesSec, start + MAX_PAGES - 1);
    if (end - start + 1 < MAX_PAGES) start = Math.max(1, end - MAX_PAGES + 1);
    const list = [];
    if (start > 1) {
      list.push(1);
      if (start > 2) list.push('…');
    }
    for (let i = start; i <= end; i++) list.push(i);
    if (end < totalPagesSec) {
      if (end < totalPagesSec - 1) list.push('…');
      list.push(totalPagesSec);
    }
    return list;
  };
  const gotoPageSec = (n) =>
    setPageSec(Math.min(Math.max(1, n), totalPagesSec));
  const firstPageSec = () => gotoPageSec(1);
  const prevPageSec = () => gotoPageSec(pageSec - 1);
  const nextPageSec = () => gotoPageSec(pageSec + 1);
  const lastPageSec = () => gotoPageSec(totalPagesSec);

  // Pagination (Students)
  const [pageStu, setPageStu] = useState(1);
  const [pageSizeStu, setPageSizeStu] = useState(10);
  const totalRowsStu = filteredStudents.length;
  const totalPagesStu = Math.max(1, Math.ceil(totalRowsStu / pageSizeStu));
  const startIdxStu = (pageStu - 1) * pageSizeStu;
  const endIdxStu = Math.min(startIdxStu + pageSizeStu, totalRowsStu);
  const pageRowsStu = filteredStudents.slice(startIdxStu, endIdxStu);

  useEffect(() => {
    setPageStu((p) => Math.min(Math.max(1, p), totalPagesStu));
  }, [totalPagesStu]);

  const getPageNumbersStu = () => {
    if (totalPagesStu <= MAX_PAGES)
      return Array.from({ length: totalPagesStu }, (_, i) => i + 1);
    const half = Math.floor(MAX_PAGES / 2);
    let start = Math.max(1, pageStu - half);
    let end = Math.min(totalPagesStu, start + MAX_PAGES - 1);
    if (end - start + 1 < MAX_PAGES) start = Math.max(1, end - MAX_PAGES + 1);
    const list = [];
    if (start > 1) {
      list.push(1);
      if (start > 2) list.push('…');
    }
    for (let i = start; i <= end; i++) list.push(i);
    if (end < totalPagesStu) {
      if (end < totalPagesStu - 1) list.push('…');
      list.push(totalPagesStu);
    }
    return list;
  };
  const gotoPageStu = (n) =>
    setPageStu(Math.min(Math.max(1, n), totalPagesStu));
  const firstPageStu = () => gotoPageStu(1);
  const prevPageStu = () => gotoPageStu(pageStu - 1);
  const nextPageStu = () => gotoPageStu(pageStu + 1);
  const lastPageStu = () => gotoPageStu(totalPagesStu);
  // Derived metrics for cards
  const assignedSectionsCount = sections.filter((s) => s.adviser_id).length;
  const unassignedSectionsCount = sections.filter((s) => !s.adviser_id).length;

  // Overlapping advisers: count distinct section_ids that appear more than once among active teachers' advisory_section_id
  const overlappingSectionIds = (() => {
    const map = new Map();
    teachers
      .filter((t) => t.is_active && t.advisory_section_id) // ensure you selected is_active, advisory_section_id in loadAvailableTeachers or another teacher fetch
      .forEach((t) => {
        const sid = t.advisory_section_id;
        map.set(sid, (map.get(sid) || 0) + 1);
      });
    return new Set(
      Array.from(map.entries())
        .filter(([, c]) => c > 1)
        .map(([sid]) => sid)
    );
  })();
  const overlappingSectionsCount = overlappingSectionIds.size;

  // Shuffle helper
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Automate sectioning: random assign available teachers to sections without adviser
  const automateSectioning = async () => {
    try {
      const targetSections = sections.filter((s) => !s.adviser_id);
      if (targetSections.length === 0) {
        setNotifMessage('No sections need advisers.');
        setShowApplyNotif(true);
        return;
      }
      const available = teachers.slice();
      if (available.length === 0) {
        setNotifMessage('No available teachers to assign.');
        setShowApplyNotif(true);
        return;
      }
      const shuffled = shuffle(available);
      const ops = [];
      for (let i = 0; i < targetSections.length; i++) {
        const section = targetSections[i];
        const teacher = shuffled[i % shuffled.length];
        ops.push(
          supabase
            .from('sections')
            .update({ adviser_id: teacher.teacher_id })
            .eq('section_id', section.section_id)
        );
        // Optional mirror update
        ops.push(
          supabase
            .from('teachers')
            .update({ advisory_section_id: section.section_id })
            .eq('teacher_id', teacher.teacher_id)
        );
      }
      const res = await Promise.all(ops);
      const err = res.find((r) => r?.error);
      if (err) throw err.error;

      await loadSections();
      await loadAvailableTeachers();

      setNotifMessage('Automated sectioning completed.');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setNotifMessage('Failed to automate sectioning.');
      setShowApplyNotif(true);
    }
  };

  // NEW: Randomize section (reassign advisers randomly among ALL active teachers)
  // This ignores "available" constraint and rebalances across the full teacher pool.
  const randomizeSectionAdvisers = async () => {
    try {
      // 1) Get all active teachers and current sections
      const { data: allTeachers, error: tErr } = await supabase
        .from('teachers')
        .select('teacher_id')
        .eq('is_active', true);
      if (tErr) throw tErr;

      if (!allTeachers?.length || !sections.length) {
        setNotifMessage('No teachers or sections to randomize.');
        setShowApplyNotif(true);
        return;
      }

      // 2) Clear current assignments using scoped WHERE
      // 2a) Clear teachers.advisory_section_id for ALL active teachers
      const teacherIds = allTeachers.map((t) => t.teacher_id);
      const clearTeachers = teacherIds.length
        ? await supabase
            .from('teachers')
            .update({ advisory_section_id: null })
            .in('teacher_id', teacherIds)
        : { error: null };
      if (clearTeachers.error) throw clearTeachers.error;

      // 2b) Clear sections.adviser_id only for the sections we are going to randomize
      const sectionIds = sections.map((s) => s.section_id);
      const clearSections = sectionIds.length
        ? await supabase
            .from('sections')
            .update({ adviser_id: null })
            .in('section_id', sectionIds)
        : { error: null };
      if (clearSections.error) throw clearSections.error;

      // 3) Shuffle teachers and build 1:1 assignments for up to sections.length
      const shuffled = [...allTeachers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const assignCount = Math.min(sections.length, shuffled.length);
      const pairs = sections.slice(0, assignCount).map((sec, idx) => ({
        section_id: sec.section_id,
        teacher_id: shuffled[idx].teacher_id,
      }));

      // 4) Apply assignments to sections
      const sectionOps = pairs.map((p) =>
        supabase
          .from('sections')
          .update({ adviser_id: p.teacher_id })
          .eq('section_id', p.section_id)
      );
      const sectionRes = await Promise.all(sectionOps);
      const sectionErr = sectionRes.find((r) => r?.error);
      if (sectionErr) throw sectionErr.error;

      // 5) Mirror on teachers (only the selected teachers get a section)
      const teacherOps = pairs.map((p) =>
        supabase
          .from('teachers')
          .update({ advisory_section_id: p.section_id })
          .eq('teacher_id', p.teacher_id)
      );
      const teacherRes = await Promise.all(teacherOps);
      const teacherErr = teacherRes.find((r) => r?.error);
      if (teacherErr) throw teacherErr.error;

      // 6) Refresh UI data
      await loadSections();
      await loadAvailableTeachers();

      setNotifMessage('Randomized adviser assignments across sections.');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setNotifMessage('Failed to randomize adviser assignments.');
      setShowApplyNotif(true);
    }
  };

  // NEW: Remove all advisers (clear sections.adviser_id and teachers.advisory_section_id)
  const removeAllAdvisers = async () => {
    try {
      const ops = [];
      if (sections.length) {
        const sectionIds = sections.map((s) => s.section_id);
        ops.push(
          supabase
            .from('sections')
            .update({ adviser_id: null })
            .in('section_id', sectionIds)
        );
      }
      const { data: assignedTeachers, error: tErr } = await supabase
        .from('teachers')
        .select('teacher_id')
        .not('advisory_section_id', 'is', null);
      if (tErr) throw tErr;
      if (assignedTeachers?.length) {
        const tids = assignedTeachers.map((t) => t.teacher_id);
        ops.push(
          supabase
            .from('teachers')
            .update({ advisory_section_id: null })
            .in('teacher_id', tids)
        );
      }
      if (ops.length) {
        const res = await Promise.all(ops);
        const err = res.find((r) => r?.error);
        if (err) throw err.error;
      }
      await loadSections();
      await loadAvailableTeachers();
      setNotifMessage('All advisers removed from sections.');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setNotifMessage('Failed to remove advisers.');
      setShowApplyNotif(true);
    }
  };

  // Open override helpers
  const openOverrideSection = (sectionId) => {
    setOverrideSectionId(sectionId);
    setOverrideTeacherId('');
    setShowOverrideSection(true);
  };
  const openOverrideStudent = (studentId) => {
    setOverrideStudentId(studentId);
    setOverrideTargetSectionName('');
    setShowOverrideStudent(true);
  };

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <Sub_Nav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="placement-container">
        {activeSection === 'sectionList' && (
          <>
            <ReusableConfirmationModalBox
              showConfirm={showConfirm}
              onCloseConfirm={() => setShowConfirm(false)}
            >
              <div>
                <h2>Add new section?</h2>
                <div className="buttons">
                  <button onClick={() => setShowAddNotif(true)}>Yes</button>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      color: 'black',
                      border: '1px solid black',
                    }}
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </ReusableConfirmationModalBox>

            <ReusableModalBox
              show={showModal}
              onClose={() => setShowModal(false)}
            >
              <div className="addNewSection">
                <div
                  className="back"
                  onClick={() => setShowModal(false)}
                  style={{ cursor: 'pointer' }}
                >
                  <i className="fa fa-chevron-left" aria-hidden="true"></i>
                </div>
                <div className="addNewSectionInput">
                  <label>Section Name</label>
                  <input />
                </div>
                <div className="addNewSectionInput">
                  <label>Grade Level</label>
                  <input />
                </div>
                <div className="addNewSectionInput">
                  <label>Number of Students</label>
                  <input />
                </div>
                <div className="addNewSectionInput">
                  <label>Adviser</label>
                  <input />
                </div>
                <div className="buttonContainer">
                  <button onClick={() => setShowConfirm(true)}>Add</button>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      color: 'black',
                      border: '1px solid black',
                      marginLeft: 8,
                    }}
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </ReusableModalBox>

            <ReusableModalBox
              show={showAddNotif}
              onClose={() => setShowAddNotif(false)}
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

            <div className="sectionList">
              <h2>Sections List</h2>

              <div className="sectionListCards">
                <div className="sectionListCard">
                  <div className="sectionListCardData">
                    <h2>{assignedSectionsCount}</h2>
                    <p>Sections with assigned advisers</p>
                  </div>

                  <div className="sectionListCardData">
                    <h2
                      style={{
                        color: unassignedSectionsCount > 0 ? 'red' : undefined,
                      }}
                    >
                      {unassignedSectionsCount}
                    </h2>
                    <p>Sections without assigned advisers</p>
                  </div>
                </div>

                <div className="sectionListCard">
                  <div className="sectionlistCardData">
                    <h2>{loadingTeachers ? '...' : teachers.length}</h2>
                    <p>Available teachers not yet assigned</p>
                  </div>
                </div>

                {/* New card: overlapping advisers */}
                <div className="sectionListCard">
                  <div className="sectionlistCardData">
                    <h2
                      style={{
                        color: overlappingSectionsCount > 0 ? 'red' : undefined,
                      }}
                    >
                      {overlappingSectionsCount}
                    </h2>
                    <p>Sections with overlapping advisers</p>
                  </div>
                </div>
              </div>

              <div className="sectionListSorter">
                <div className="sectionListSearch">
                  <i className="fa fa-search" aria-hidden="true"></i>
                  <input
                    className="sectionListSearchbar"
                    placeholder="Search section..."
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                  />
                </div>
                <div className="sectionListSort Grade">
                  <label>Grade</label>
                  <select
                    value={sectionListGrade}
                    onChange={(e) => setSectionListGrade(e.target.value)}
                  >
                    <option value="">All Grade</option>
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Replaced: Section select -> Star Section filter */}
                <div className="sectionListSort Section">
                  <label>Star Section</label>
                  <select
                    value={sectionStarFilter}
                    onChange={(e) => setSectionStarFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div className="sectionListTableContainer">
                <table>
                  <thead>
                    <tr>
                      <th rowSpan="2">Section</th>
                      <th rowSpan="2">Grade Level</th>
                      <th rowSpan="2">No. of Students</th>
                      <th rowSpan="2">Star Section</th>
                      <th colSpan="2">Assign Advisers</th>
                    </tr>
                    <tr>
                      <th>Advisers</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSections && (
                      <tr>
                        <td colSpan={6}>Loading...</td>
                      </tr>
                    )}
                    {!loadingSections && pageRowsSec.length === 0 && (
                      <tr>
                        <td colSpan={6}>No sections found.</td>
                      </tr>
                    )}
                    {!loadingSections &&
                      pageRowsSec.map((section) => (
                        <tr key={section.section_id}>
                          <td>{section.name}</td>
                          <td>{section.grade_level}</td>
                          <td>{section.num_students || '—'}</td>
                          <td>{section.is_star ? 'Yes' : 'No'}</td>
                          <td>
                            {section.adviser
                              ? `${section.adviser.user?.first_name || ''} ${section.adviser.user?.last_name || ''}`.trim() ||
                                '—'
                              : '—'}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                openOverrideSection(section.section_id)
                              }
                            >
                              Override
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Sections */}
              <div className="pagination-bar">
                <div className="pager-left">
                  <label className="pager-label">Rows per page</label>
                  <select
                    className="pager-size"
                    value={pageSizeSec}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      setPageSizeSec(newSize);
                      setPageSec(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pager-info">
                  {totalRowsSec === 0
                    ? 'Showing 0 of 0'
                    : `Showing ${startIdxSec + 1}–${endIdxSec} of ${totalRowsSec}`}
                </div>

                <div className="pager-right">
                  <button
                    className="pager-btn"
                    onClick={firstPageSec}
                    disabled={pageSec === 1}
                    aria-label="First page"
                  >
                    <ion-icon name="play-back-outline"></ion-icon>
                  </button>
                  <button
                    className="pager-btn"
                    onClick={prevPageSec}
                    disabled={pageSec === 1}
                    aria-label="Previous page"
                  >
                    <ion-icon name="chevron-back-outline"></ion-icon>
                  </button>

                  {getPageNumbersSec().map((pkey, idx) =>
                    pkey === '…' ? (
                      <span
                        key={`ellipsis-sec-${idx}`}
                        className="pager-ellipsis"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={`sec-${pkey}`}
                        className={`pager-page ${pageSec === pkey ? 'active' : ''}`}
                        onClick={() => gotoPageSec(pkey)}
                        aria-current={pageSec === pkey ? 'page' : undefined}
                      >
                        {pkey}
                      </button>
                    )
                  )}

                  <button
                    className="pager-btn"
                    onClick={nextPageSec}
                    disabled={pageSec === totalPagesSec}
                    aria-label="Next page"
                  >
                    <ion-icon name="chevron-forward-outline"></ion-icon>
                  </button>
                  <button
                    className="pager-btn"
                    onClick={lastPageSec}
                    disabled={pageSec === totalPagesSec}
                    aria-label="Last page"
                  >
                    <ion-icon name="play-forward-outline"></ion-icon>
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div
                className="button-container"
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
              >
                <button onClick={() => setShowModal(true)}>
                  Add new section
                </button>
                <button onClick={automateSectioning}>
                  Automate sectioning
                </button>
                <button onClick={randomizeSectionAdvisers}>
                  Randomize advisers
                </button>
                <button onClick={removeAllAdvisers}>Remove all advisers</button>
              </div>
            </div>

            {/* Override adviser modal */}
            <ReusableModalBox
              show={showOverrideSection}
              onClose={() => setShowOverrideSection(false)}
            >
              <div className="overrideSection">
                <div className="overrideSectionHeader">
                  <h2>Override Adviser Assignment</h2>
                </div>
                <div className="overrideSelection">
                  <label>Adviser</label>
                  <select
                    value={overrideTeacherId || ''}
                    onChange={(e) => setOverrideTeacherId(e.target.value)}
                  >
                    <option value="">Select adviser</option>
                    {teachers.map((t) => (
                      <option key={t.teacher_id} value={t.teacher_id}>
                        {t.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="buttonContainer">
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid black',
                      color: 'black',
                    }}
                    onClick={() => setShowOverrideSection(false)}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowApplySection(true)}
                    disabled={!overrideTeacherId}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </ReusableModalBox>

            {/* Confirm apply adviser change */}
            <ReusableModalBox
              show={showApplySection}
              onClose={() => setShowApplySection(false)}
            >
              <div className="sectionApply">
                <h2>Apply Changes?</h2>
                <div className="buttons">
                  <button
                    onClick={() => {
                      setShowApplySection(false);
                      setShowAddNotif(true);
                    }}
                  >
                    Yes
                  </button>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      color: 'black',
                      border: '1px solid black',
                    }}
                    onClick={() => setShowApplySection(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </ReusableModalBox>

            {/* Notifs */}
            <ReusableModalBox
              show={showAddNotif}
              onClose={() => setShowAddNotif(false)}
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

            <ReusableModalBox
              show={showApplyNotif}
              onClose={() => setShowApplyNotif(false)}
            >
              <div className="notif">
                <div className="img" style={{ paddingTop: '10px' }}>
                  <img
                    src="checkImg.png"
                    style={{ height: '50px', width: '50px' }}
                  />
                </div>
                <h2>{notifMessage}</h2>
              </div>
            </ReusableModalBox>
          </>
        )}

        {activeSection === 'studentList' && (
          <>
            <div className="studentList">
              <h2>Student List</h2>

              <div className="studentListCards">
                {GRADES.map((g) => (
                  <div
                    key={g.value}
                    className={`studentListCard grade${g.value}`}
                  >
                    <p className="gradeLevel">{g.label}</p>
                    <h2>
                      {
                        students.filter(
                          (s) => Number(s.grade_level) === g.value
                        ).length
                      }
                    </h2>
                    <p>Assigned Students</p>
                  </div>
                ))}
              </div>

              <div className="studentListSorter">
                <div className="studentListSearch">
                  <i className="fa fa-search" aria-hidden="true"></i>
                  <input
                    className="studentListSearchbar"
                    placeholder="Search student name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
                <div className="studentListSort Grade">
                  <label>Grade</label>
                  <select
                    value={studentListGrade}
                    onChange={(e) => setStudentListGrade(e.target.value)}
                  >
                    <option value="">All Grade</option>
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="studentListSort Section">
                  <label>Section</label>
                  <select
                    value={studentListSection}
                    onChange={(e) => setStudentListSection(e.target.value)}
                  >
                    <option value="">All Section</option>
                    {sections.map((s) => (
                      <option key={s.section_id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="studentListTableContainer">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Gender</th>
                      <th>Grade Level</th>
                      <th>Section</th>
                      <th>Star Section</th>
                      <th>Advisers</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStudents && (
                      <tr>
                        <td colSpan={7}>Loading...</td>
                      </tr>
                    )}
                    {!loadingStudents && pageRowsStu.length === 0 && (
                      <tr>
                        <td colSpan={7}>No students found.</td>
                      </tr>
                    )}
                    {!loadingStudents &&
                      pageRowsStu.map((student) => (
                        <tr key={student.student_id}>
                          <td>
                            {`${student.last_name || ''}, ${student.first_name || ''}`.trim()}
                          </td>
                          <td>{student.gender}</td>
                          <td>{student.grade_level || '—'}</td>
                          <td>{student.section || '—'}</td>
                          <td>{student.is_star ? 'Yes' : 'No'}</td>
                          <td>{student.adviser_full_name || '—'}</td>
                          <td>
                            <button
                              onClick={() =>
                                openOverrideStudent(student.student_id)
                              }
                            >
                              Override
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Students */}
              <div className="pagination-bar">
                <div className="pager-left">
                  <label className="pager-label">Rows per page</label>
                  <select
                    className="pager-size"
                    value={pageSizeStu}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      setPageSizeStu(newSize);
                      setPageStu(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pager-info">
                  {totalRowsStu === 0
                    ? 'Showing 0 of 0'
                    : `Showing ${startIdxStu + 1}–${endIdxStu} of ${totalRowsStu}`}
                </div>

                <div className="pager-right">
                  <button
                    className="pager-btn"
                    onClick={firstPageStu}
                    disabled={pageStu === 1}
                    aria-label="First page"
                  >
                    <ion-icon name="play-back-outline"></ion-icon>
                  </button>
                  <button
                    className="pager-btn"
                    onClick={prevPageStu}
                    disabled={pageStu === 1}
                    aria-label="Previous page"
                  >
                    <ion-icon name="chevron-back-outline"></ion-icon>
                  </button>

                  {getPageNumbersStu().map((pkey, idx) =>
                    pkey === '…' ? (
                      <span
                        key={`ellipsis-stu-${idx}`}
                        className="pager-ellipsis"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={`stu-${pkey}`}
                        className={`pager-page ${pageStu === pkey ? 'active' : ''}`}
                        onClick={() => gotoPageStu(pkey)}
                        aria-current={pageStu === pkey ? 'page' : undefined}
                      >
                        {pkey}
                      </button>
                    )
                  )}

                  <button
                    className="pager-btn"
                    onClick={nextPageStu}
                    disabled={pageStu === totalPagesStu}
                    aria-label="Next page"
                  >
                    <ion-icon name="chevron-forward-outline"></ion-icon>
                  </button>
                  <button
                    className="pager-btn"
                    onClick={lastPageStu}
                    disabled={pageStu === totalPagesStu}
                    aria-label="Last page"
                  >
                    <ion-icon name="play-forward-outline"></ion-icon>
                  </button>
                </div>
              </div>
            </div>

            {/* Override student modal */}
            <ReusableModalBox
              show={showOverrideStudent}
              onClose={() => setShowOverrideStudent(false)}
            >
              <div className="overrideStudent">
                <div className="overrideStudentHeader">
                  <h2>Override Section Assignment</h2>
                </div>
                <div className="overrideSelection">
                  <label>Section</label>
                  <select
                    value={overrideTargetSectionName}
                    onChange={(e) =>
                      setOverrideTargetSectionName(e.target.value)
                    }
                  >
                    <option value="">Select section</option>
                    {sections.map((s) => (
                      <option key={s.section_id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="buttonContainer">
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid black',
                      color: 'black',
                    }}
                    onClick={() => setShowOverrideStudent(false)}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowApplyStudent(true)}
                    disabled={!overrideTargetSectionName}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </ReusableModalBox>

            {/* Confirm apply student change */}
            <ReusableModalBox
              show={showApplyStudent}
              onClose={() => setShowApplyStudent(false)}
            >
              <div className="studentApply">
                <h2>Apply Changes?</h2>
                <div className="buttons">
                  <button
                    onClick={() => {
                      setShowApplyStudent(false);
                      setShowApplyNotif(true);
                    }}
                  >
                    Yes
                  </button>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      color: 'black',
                      border: '1px solid black',
                    }}
                    onClick={() => setShowApplyStudent(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </ReusableModalBox>

            {/* Notif */}
            <ReusableModalBox
              show={showApplyNotif}
              onClose={() => setShowApplyNotif(false)}
            >
              <div className="notif">
                <div className="img" style={{ paddingTop: '10px' }}>
                  <img
                    src="checkImg.png"
                    style={{ height: '50px', width: '50px' }}
                  />
                </div>
                <h2>{notifMessage}</h2>
              </div>
            </ReusableModalBox>
          </>
        )}
      </div>
    </>
  );
};
