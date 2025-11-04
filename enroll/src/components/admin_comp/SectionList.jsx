// SectionList.jsx
import { useState, useEffect, useMemo } from 'react';
import { ReusableModalBox } from '../modals/Reusable_Modal';
import { ReusableConfirmationModalBox } from '../modals/Reusable_Confirmation_Modal';
import { supabase } from '../../supabaseClient';
import './sectionList.css';

const GRADES = [
  { label: 'Grade 7', value: 7 },
  { label: 'Grade 8', value: 8 },
  { label: 'Grade 9', value: 9 },
  { label: 'Grade 10', value: 10 },
];

const SectionList = () => {
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showRemoveTeachersConfirm, setShowRemoveTeachersConfirm] =
    useState(false);
  const [removingTeachers, setRemovingTeachers] = useState(false);
  const [teachersWithAssignments, setTeachersWithAssignments] = useState(0);

  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionListGrade, setSectionListGrade] = useState('');
  const [sectionStarFilter, setSectionStarFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showOverrideSection, setShowOverrideSection] = useState(false);
  const [showApplySection, setShowApplySection] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddNotif, setShowAddNotif] = useState(false);
  const [showApplyNotif, setShowApplyNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState(
    'Changes Applied Successfully!'
  );

  const [overrideSectionId, setOverrideSectionId] = useState(null);
  const [overrideTeacherId, setOverrideTeacherId] = useState('');

  const [pageSec, setPageSec] = useState(1);
  const [pageSizeSec, setPageSizeSec] = useState(10);

  // Load count of teachers with section assignments
  const loadTeachersWithAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .select('teacher_id')
        .eq('school_year', '2025-2026');

      if (error) throw error;

      const uniqueTeachers = new Set((data || []).map((t) => t.teacher_id));
      setTeachersWithAssignments(uniqueTeachers.size);
    } catch (e) {
      console.error('Failed to load teachers with assignments:', e);
      setTeachersWithAssignments(0);
    }
  };

  const removeAllTeacherAssignments = async () => {
    setRemovingTeachers(true);
    try {
      const { error } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('school_year', '2025-2026');

      if (error) throw error;

      await loadTeachersWithAssignments();

      setShowRemoveTeachersConfirm(false);
      setNotifMessage('All teacher assignments removed for 2025-2026.');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setShowRemoveTeachersConfirm(false);
      setNotifMessage('Failed to remove teacher assignments.');
      setShowApplyNotif(true);
    } finally {
      setRemovingTeachers(false);
    }
  };
  const SY = '2025-2026';
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
        is_star,
        adviser_id,
        adviser:teachers!sections_adviser_id_fkey(
          teacher_id,
          user:users!teachers_user_id_fkey(first_name,last_name)
        ),
        students_count:student_sections!left(count)
      `
        )
        .eq('student_sections.school_year', SY) // filter only the child rows counted
        .order('name', { ascending: true });
      if (error) throw error;

      const withCounts = (data || []).map((s) => ({
        ...s,
        num_students: s.students_count?.[0]?.count ?? 0, // flatten aggregate
      }));

      setSections(withCounts);
    } catch (e) {
      console.error('Failed to load sections:', e?.message);
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  };
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

  const applyOverrideAdviser = async () => {
    try {
      if (!overrideSectionId || !overrideTeacherId) return;

      const { data: sec, error: secErr } = await supabase
        .from('sections')
        .select('section_id, adviser_id')
        .eq('section_id', overrideSectionId)
        .single();
      if (secErr) throw secErr;

      const prevAdviserId = sec?.adviser_id || null;
      const newAdviserId = Number(overrideTeacherId);

      const { data: newTeacher } = await supabase
        .from('teachers')
        .select('advisory_section_id')
        .eq('teacher_id', newAdviserId)
        .single();

      const ops = [];

      if (prevAdviserId && prevAdviserId !== newAdviserId) {
        ops.push(
          supabase
            .from('teachers')
            .update({ advisory_section_id: null })
            .eq('teacher_id', prevAdviserId)
        );
      }

      if (
        newTeacher?.advisory_section_id &&
        newTeacher.advisory_section_id !== overrideSectionId
      ) {
        ops.push(
          supabase
            .from('sections')
            .update({ adviser_id: null })
            .eq('section_id', newTeacher.advisory_section_id)
        );
        ops.push(
          supabase
            .from('teachers')
            .update({ advisory_section_id: null })
            .eq('teacher_id', newAdviserId)
        );
      }

      ops.push(
        supabase
          .from('sections')
          .update({ adviser_id: newAdviserId })
          .eq('section_id', overrideSectionId)
      );
      ops.push(
        supabase
          .from('teachers')
          .update({ advisory_section_id: overrideSectionId })
          .eq('teacher_id', newAdviserId)
      );

      const results = await Promise.all(ops);
      const failed = results.find((r) => r?.error);
      if (failed?.error) throw failed.error;

      await Promise.all([loadSections(), loadAvailableTeachers()]);

      setShowOverrideSection(false);
      setShowApplySection(false);
      setNotifMessage('Changes Applied Successfully!');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setShowOverrideSection(false);
      setShowApplySection(false);
      setNotifMessage('Failed to apply adviser override.');
      setShowApplyNotif(true);
    }
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

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

  const randomizeSectionAdvisers = async () => {
    try {
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

      const teacherIds = allTeachers.map((t) => t.teacher_id);
      const clearTeachers = teacherIds.length
        ? await supabase
            .from('teachers')
            .update({ advisory_section_id: null })
            .in('teacher_id', teacherIds)
        : { error: null };
      if (clearTeachers.error) throw clearTeachers.error;

      const sectionIds = sections.map((s) => s.section_id);
      const clearSections = sectionIds.length
        ? await supabase
            .from('sections')
            .update({ adviser_id: null })
            .in('section_id', sectionIds)
        : { error: null };
      if (clearSections.error) throw clearSections.error;

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

      const sectionOps = pairs.map((p) =>
        supabase
          .from('sections')
          .update({ adviser_id: p.teacher_id })
          .eq('section_id', p.section_id)
      );
      const sectionRes = await Promise.all(sectionOps);
      const sectionErr = sectionRes.find((r) => r?.error);
      if (sectionErr) throw sectionErr.error;

      const teacherOps = pairs.map((p) =>
        supabase
          .from('teachers')
          .update({ advisory_section_id: p.section_id })
          .eq('teacher_id', p.teacher_id)
      );
      const teacherRes = await Promise.all(teacherOps);
      const teacherErr = teacherRes.find((r) => r?.error);
      if (teacherErr) throw teacherErr.error;

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

  const openOverrideSection = (sectionId) => {
    setOverrideSectionId(sectionId);
    setOverrideTeacherId('');
    setShowOverrideSection(true);
  };

  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    return sections.filter((s) => {
      const matchesText = !q || s.name.toLowerCase().includes(q);
      const matchesGrade =
        !sectionListGrade || Number(s.grade_level) === Number(sectionListGrade);
      const matchesStar =
        sectionStarFilter === ''
          ? true
          : sectionStarFilter === 'yes'
            ? !!s.is_star
            : !s.is_star;
      return matchesText && matchesGrade && matchesStar;
    });
  }, [sections, sectionSearch, sectionListGrade, sectionStarFilter]);

  const assignedSectionsCount = sections.filter((s) => s.adviser_id).length;
  const unassignedSectionsCount = sections.filter((s) => !s.adviser_id).length;

  const overlappingSectionIds = (() => {
    const map = new Map();
    teachers
      .filter((t) => t.is_active && t.advisory_section_id)
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

  useEffect(() => {
    loadSections();
    loadAvailableTeachers();
    loadTeachersWithAssignments();
  }, []);

  return (
    <>
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

          <div className="sectionListCard">
            <div className="sectionlistCardData">
              <h2>{teachersWithAssignments}</h2>
              <p>Teachers with section assignments</p>
            </div>
          </div>

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
                        onClick={() => openOverrideSection(section.section_id)}
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

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
                <span key={`ellipsis-sec-${idx}`} className="pager-ellipsis">
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

        <div
          className="button-container"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}
        >
          <button onClick={() => setShowModal(true)}>Add new section</button>
          <button onClick={automateSectioning}>Automate sectioning</button>
          <button onClick={randomizeSectionAdvisers}>Randomize advisers</button>
          <button onClick={removeAllAdvisers}>Remove all advisers</button>
          <button
            onClick={() => setShowRemoveTeachersConfirm(true)}
            style={{ backgroundColor: '#d9534f', borderColor: '#d9534f' }}
          >
            Remove All Teacher Assignments
          </button>
        </div>
      </div>

      <ReusableModalBox show={showModal} onClose={() => setShowModal(false)}>
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

      <ReusableModalBox
        show={showApplySection}
        onClose={() => setShowApplySection(false)}
      >
        <div className="sectionApply">
          <h2>Apply Changes?</h2>
          <div className="buttons">
            <button
              onClick={() => setShowApplySection(false)}
              style={{
                backgroundColor: 'transparent',
                color: 'black',
                border: '1px solid black',
              }}
            >
              Cancel
            </button>
            <button onClick={applyOverrideAdviser}>Yes</button>
          </div>
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
              alt="Success"
              style={{ height: '50px', width: '50px' }}
            />
          </div>
          <h2>{notifMessage}</h2>
        </div>
      </ReusableModalBox>

      <ReusableModalBox
        show={showRemoveTeachersConfirm}
        onClose={() => setShowRemoveTeachersConfirm(false)}
      >
        <div className="sectionApply">
          <h2>Remove All Teacher Assignments?</h2>
          <p style={{ color: '#d9534f', fontWeight: 'bold', marginTop: 10 }}>
            ⚠️ WARNING: This will permanently delete all teacher-subject-section
            assignments for 2025-2026. This action cannot be undone!
          </p>
          <div className="buttons" style={{ marginTop: 20 }}>
            <button
              onClick={() => setShowRemoveTeachersConfirm(false)}
              disabled={removingTeachers}
              style={{
                backgroundColor: 'transparent',
                color: 'black',
                border: '1px solid black',
              }}
            >
              Cancel
            </button>
            <button
              onClick={removeAllTeacherAssignments}
              disabled={removingTeachers}
              style={{ backgroundColor: '#d9534f' }}
            >
              {removingTeachers ? 'Removing...' : 'Remove All'}
            </button>
          </div>
        </div>
      </ReusableModalBox>
    </>
  );
};

export default SectionList;
