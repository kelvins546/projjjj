// StudentList.jsx
import { useState, useEffect, useMemo } from 'react';
import { ReusableModalBox } from '../modals/Reusable_Modal';
import { supabase } from '../../supabaseClient';
import './studentList.css';

const GRADES = [
  { label: 'Grade 7', value: 7 },
  { label: 'Grade 8', value: 8 },
  { label: 'Grade 9', value: 9 },
  { label: 'Grade 10', value: 10 },
];

const STATIC_SY = '2025-2026';

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentListGrade, setStudentListGrade] = useState('');
  const [studentListSection, setStudentListSection] = useState('');
  const [showOverrideStudent, setShowOverrideStudent] = useState(false);
  const [showApplyStudent, setShowApplyStudent] = useState(false);
  const [showApplyNotif, setShowApplyNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState(
    'Changes Applied Successfully!'
  );
  const [overrideStudentId, setOverrideStudentId] = useState(null);
  const [overrideStudentGrade, setOverrideStudentGrade] = useState(null);
  const [overrideTargetSectionId, setOverrideTargetSectionId] = useState('');
  const [pageStu, setPageStu] = useState(1);
  const [pageSizeStu, setPageSizeStu] = useState(10);

  const overrideSectionsForGrade = useMemo(() => {
    if (overrideStudentGrade == null) return [];
    return (sections || [])
      .filter((s) => Number(s.grade_level) === Number(overrideStudentGrade))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [sections, overrideStudentGrade]);

  const loadSections = async () => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('section_id, name, grade_level, is_star, adviser_id')
        .order('name', { ascending: true });
      if (error) throw error;
      setSections(data || []);
    } catch (e) {
      console.error('Failed to load sections:', e);
      setSections([]);
    }
  }; // [web:430][web:474]

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data: stuRows, error: eS } = await supabase
        .from('students')
        .select('student_id, user_id, gender, applicant_id, enrollment_id');
      if (eS) throw eS;
      if (!stuRows?.length) {
        setStudents([]);
        return;
      }

      const studentIds = stuRows.map((s) => s.student_id);
      const userIds = [
        ...new Set(stuRows.map((s) => s.user_id).filter(Boolean)),
      ];
      const applicantIds = [
        ...new Set(stuRows.map((s) => s.applicant_id).filter(Boolean)),
      ];

      const { data: userRows, error: eU } = await supabase
        .from('users')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);
      if (eU) throw eU;
      const usersById = new Map((userRows || []).map((u) => [u.user_id, u]));

      const { data: secRel, error: eSec } = await supabase
        .from('student_sections')
        .select(
          `student_id, school_year, section:sections(section_id, name, grade_level, is_star, adviser_id)`
        )
        .in('student_id', studentIds);
      if (eSec) throw eSec;

      const sectionsByStudent = new Map();
      const adviserIds = new Set();
      for (const rel of secRel || []) {
        const list = sectionsByStudent.get(rel.student_id) || [];
        list.push(rel);
        sectionsByStudent.set(rel.student_id, list);
        const advId = rel?.section?.adviser_id;
        if (advId) adviserIds.add(advId);
      }

      let teacherRows = [];
      if (adviserIds.size) {
        const { data: tRows, error: tErr } = await supabase
          .from('teachers')
          .select('teacher_id, user_id')
          .in('teacher_id', Array.from(adviserIds));
        if (tErr) throw tErr;
        teacherRows = tRows || [];
      }

      const adviserUserIds = Array.from(
        new Set(teacherRows.map((t) => t.user_id).filter(Boolean))
      );
      let adviserUsers = [];
      if (adviserUserIds.length) {
        const { data: uRows, error: uErr } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', adviserUserIds);
        if (uErr) throw uErr;
        adviserUsers = uRows || [];
      }
      const usersByUserId = new Map(adviserUsers.map((u) => [u.user_id, u]));
      const teacherNameById = new Map(
        teacherRows.map((t) => {
          const u = usersByUserId.get(t.user_id);
          return [
            t.teacher_id,
            u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '',
          ];
        })
      );

      let enrByApplicant = new Map();
      if (applicantIds.length) {
        const { data: enrRows, error: eE } = await supabase
          .from('enrollments')
          .select('applicant_id, school_year, grade_level, status')
          .in('applicant_id', applicantIds);
        if (eE) throw eE;

        const latest = new Map();
        for (const e of enrRows || []) {
          const key = e.applicant_id;
          const prev = latest.get(key);
          if (!prev) latest.set(key, e);
          else {
            const curSY = String(e.school_year || '');
            const prevSY = String(prev.school_year || '');
            if (curSY.localeCompare(prevSY) > 0) latest.set(key, e);
          }
        }
        enrByApplicant = latest;
      }

      const normalized = (stuRows || []).map((s) => {
        const user = usersById.get(s.user_id) || {};
        const rels = (sectionsByStudent.get(s.student_id) || []).sort((a, b) =>
          String(b?.school_year || '').localeCompare(
            String(a?.school_year || '')
          )
        );
        const rel = rels[0] || null;
        const sec = rel?.section || null;

        const fromSection = Number(sec?.grade_level);
        const enrRaw = s.applicant_id
          ? enrByApplicant.get(s.applicant_id)?.grade_level
          : null;
        const enrNum = (() => {
          const m = String(enrRaw ?? '').match(/\d+/);
          return m ? Number(m[0]) : NaN;
        })();
        const grade_level = Number.isFinite(fromSection)
          ? fromSection
          : Number.isFinite(enrNum)
            ? enrNum
            : '';
        const adviser_full_name = sec?.adviser_id
          ? teacherNameById.get(sec.adviser_id) || ''
          : '';

        return {
          student_id: s.student_id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          gender: s.gender || '—',
          grade_level,
          section: sec?.name || '',
          adviser_full_name,
          is_star: !!sec?.is_star,
        };
      });

      setStudents(normalized);
    } catch (e) {
      console.error('Failed to load students:', e?.message);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }; // [web:430]

  // Helper: run the existing per-grade logic, return summary
  const runForGrade = async (g) => {
    const { data: secRows, error: secErr } = await supabase
      .from('sections')
      .select('section_id, name, grade_level, is_star')
      .eq('grade_level', g)
      .order('name', { ascending: true });
    if (secErr) throw secErr;
    if (!secRows?.length) return { grade: g, rowsInserted: 0, starPlaced: 0 };

    const starSection = secRows.find((s) => s.is_star === true);
    const nonStarSections = secRows.filter((s) => s.is_star !== true);
    if (!starSection && !nonStarSections.length)
      return { grade: g, rowsInserted: 0, starPlaced: 0 };

    const STAR_CAP = 65;
    const NONSTAR_CAP = 45;

    const { data: enrRows, error: enrErr } = await supabase
      .from('enrollments')
      .select('applicant_id')
      .eq('grade_level', `Grade ${g}`)
      .eq('school_year', STATIC_SY);
    if (enrErr) throw enrErr;
    const applicantIds = (enrRows || [])
      .map((e) => e.applicant_id)
      .filter(Boolean);
    if (!applicantIds.length)
      return { grade: g, rowsInserted: 0, starPlaced: 0 };

    const { data: stuIdRows, error: mapErr } = await supabase
      .from('students')
      .select('student_id, applicant_id, gender')
      .in('applicant_id', applicantIds);
    if (mapErr) throw mapErr;
    const studentIdsForGrade = (stuIdRows || [])
      .map((r) => r.student_id)
      .filter(Boolean);
    if (!studentIdsForGrade.length)
      return { grade: g, rowsInserted: 0, starPlaced: 0 };
    const genderByStudent = new Map(
      stuIdRows.map((r) => [r.student_id, r.gender])
    );

    const { data: academicRows, error: acadErr } = await supabase
      .from('academic_history')
      .select('student_id, general_average')
      .in('student_id', studentIdsForGrade);
    if (acadErr) throw acadErr;
    const gaByStudent = new Map(
      (academicRows || []).map((a) => [
        a.student_id,
        Number(a.general_average || 0),
      ])
    );

    const studentsForAlgo = studentIdsForGrade.map((id) => ({
      student_id: id,
      gender: genderByStudent.get(id) || '',
      general_average: gaByStudent.get(id) || 0,
    }));
    if (!studentsForAlgo.length)
      return { grade: g, rowsInserted: 0, starPlaced: 0 };

    const isStarEligible = (s) => Number(s.general_average || 0) >= 95;
    const starQueue = studentsForAlgo.filter(isStarEligible);
    const nonStarQueue = studentsForAlgo.filter((s) => !isStarEligible(s));

    let starAssigned = [];
    if (starSection) {
      const starBoys = starQueue.filter((s) =>
        String(s.gender || '')
          .toLowerCase()
          .startsWith('m')
      );
      const starGirls = starQueue.filter((s) =>
        String(s.gender || '')
          .toLowerCase()
          .startsWith('f')
      );
      let sb = 0,
        sg = 0;
      while (
        starAssigned.length < STAR_CAP &&
        (sb < starBoys.length || sg < starGirls.length)
      ) {
        if (sb < starBoys.length && (sb <= sg || sg >= starGirls.length))
          starAssigned.push(starBoys[sb++]);
        else if (sg < starGirls.length) starAssigned.push(starGirls[sg++]);
        else break;
      }
    }
    const starAssignedIds = new Set(starAssigned.map((s) => s.student_id));
    const starOverflow = starQueue.filter(
      (s) => !starAssignedIds.has(s.student_id)
    );

    const nonStarPool = [...starOverflow, ...nonStarQueue];
    const boys = nonStarPool.filter((s) =>
      String(s.gender || '')
        .toLowerCase()
        .startsWith('m')
    );
    const girls = nonStarPool.filter((s) =>
      String(s.gender || '')
        .toLowerCase()
        .startsWith('f')
    );
    let bi = 0,
      gi = 0;
    const nonStarAssignments = [];
    for (const sec of nonStarSections) {
      let count = 0,
        bCount = 0,
        gCount = 0;
      while (count < NONSTAR_CAP && (bi < boys.length || gi < girls.length)) {
        const needBoy = bCount <= gCount;
        if (needBoy && bi < boys.length) {
          nonStarAssignments.push({
            student: boys[bi++],
            section_id: sec.section_id,
          });
          bCount++;
          count++;
        } else if (gi < girls.length) {
          nonStarAssignments.push({
            student: girls[gi++],
            section_id: sec.section_id,
          });
          gCount++;
          count++;
        } else if (bi < boys.length) {
          nonStarAssignments.push({
            student: boys[bi++],
            section_id: sec.section_id,
          });
          bCount++;
          count++;
        } else break;
      }
    }

    const sectionIds = secRows.map((s) => s.section_id);
    const { error: delErr } = await supabase
      .from('student_sections')
      .delete()
      .eq('school_year', STATIC_SY)
      .in('section_id', sectionIds);
    if (delErr) throw delErr;

    const rows = [];
    if (starSection) {
      for (const s of starAssigned) {
        rows.push({
          student_id: s.student_id,
          section_id: starSection.section_id,
          school_year: STATIC_SY,
        });
      }
    }
    for (const a of nonStarAssignments) {
      rows.push({
        student_id: a.student.student_id,
        section_id: a.section_id,
        school_year: STATIC_SY,
      });
    }
    if (rows.length) {
      const { error: insErr } = await supabase
        .from('student_sections')
        .insert(rows);
      if (insErr) throw insErr;
    }

    return {
      grade: g,
      rowsInserted: rows.length,
      starPlaced: starAssigned.length,
    };
  }; // [web:430][web:468]

  // Wrapper: run for one grade or all grades when gradeLevel is 0/empty
  const automateStudentSectioning = async (gradeLevel) => {
    try {
      let summaries = [];
      if (!gradeLevel) {
        for (const g of GRADES.map((x) => x.value)) {
          const s = await runForGrade(g);
          summaries.push(s);
        }
      } else {
        const s = await runForGrade(gradeLevel);
        summaries = [s];
      }

      await Promise.all([loadStudents(), loadSections()]);
      const total = summaries.reduce(
        (t, s) => ({
          rows: t.rows + s.rowsInserted,
          star: t.star + s.starPlaced,
        }),
        { rows: 0, star: 0 }
      );
      const detail = summaries
        .map((s) => `G${s.grade}: ${s.rowsInserted} (${s.star} STAR)`)
        .join(', ');
      setNotifMessage(
        `Automated sectioning complete: ${total.rows} assigned across ${summaries.length} grade(s); ${total.star} to STAR. ${detail}`
      );
      setShowApplyNotif(true);
    } catch (e) {
      console.error('Automate sectioning error:', e);
      setNotifMessage(e.message || 'Failed to automate sectioning.');
      setShowApplyNotif(true);
    }
  }; // [web:430]

  // Remove sectioning for one grade, or all if gradeLevel is 0/empty
  const removeStudentSectioning = async (gradeLevel) => {
    try {
      let secRows = [];
      if (!gradeLevel) {
        const { data, error } = await supabase
          .from('sections')
          .select('section_id, grade_level');
        if (error) throw error;
        secRows = data || [];
      } else {
        const { data, error } = await supabase
          .from('sections')
          .select('section_id, grade_level')
          .eq('grade_level', gradeLevel);
        if (error) throw error;
        secRows = data || [];
      }
      if (!secRows.length) {
        setNotifMessage(
          !gradeLevel
            ? 'No sections found.'
            : `No sections found for Grade ${gradeLevel}.`
        );
        setShowApplyNotif(true);
        return;
      }

      const sectionIds = secRows.map((s) => s.section_id);
      const { error: delErr, count } = await supabase
        .from('student_sections')
        .delete({ count: 'exact' })
        .eq('school_year', STATIC_SY)
        .in('section_id', sectionIds);
      if (delErr) throw delErr;

      await Promise.all([loadStudents(), loadSections()]);
      setNotifMessage(
        !gradeLevel
          ? `All section assignments removed across all grades. ${count || 0} assignments deleted.`
          : `All section assignments removed for Grade ${gradeLevel}. ${count || 0} assignments deleted.`
      );
      setShowApplyNotif(true);
    } catch (e) {
      console.error('Remove sectioning error:', e);
      setNotifMessage(e.message || 'Failed to remove sectioning.');
      setShowApplyNotif(true);
    }
  }; // [web:468][web:430]

  const applyOverrideStudent = async () => {
    try {
      if (!overrideStudentId || !overrideTargetSectionId) return;

      const targetSection = sections.find(
        (s) => Number(s.section_id) === Number(overrideTargetSectionId)
      );
      if (!targetSection) throw new Error('Section not found');
      if (Number(targetSection.grade_level) !== Number(overrideStudentGrade)) {
        throw new Error(
          `Please choose a Grade ${overrideStudentGrade} section only`
        );
      }

      await supabase
        .from('student_sections')
        .delete()
        .eq('student_id', overrideStudentId)
        .eq('school_year', STATIC_SY);

      const { error: insErr } = await supabase.from('student_sections').insert({
        student_id: overrideStudentId,
        section_id: targetSection.section_id,
        school_year: STATIC_SY,
      });
      if (insErr) throw insErr;

      await loadStudents();
      setShowOverrideStudent(false);
      setShowApplyStudent(false);
      setNotifMessage('Student section updated successfully!');
      setShowApplyNotif(true);
    } catch (e) {
      console.error(e);
      setShowOverrideStudent(false);
      setShowApplyStudent(false);
      setNotifMessage('Failed to update student section.');
      setShowApplyNotif(true);
    }
  }; // [web:430]

  const openOverrideStudent = (studentId) => {
    setOverrideStudentId(studentId);
    setOverrideTargetSectionId('');
    const stu = (students || []).find((s) => s.student_id === studentId);
    const g = Number(stu?.grade_level);
    setOverrideStudentGrade(Number.isFinite(g) ? g : null);
    setShowOverrideStudent(true);
  }; // [web:239]

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
  }, [students, studentSearch, studentListGrade, studentListSection]); // [web:239]

  const totalRowsStu = filteredStudents.length;
  const totalPagesStu = Math.max(1, Math.ceil(totalRowsStu / pageSizeStu));
  const startIdxStu = (pageStu - 1) * pageSizeStu;
  const endIdxStu = Math.min(startIdxStu + pageSizeStu, totalRowsStu);
  const pageRowsStu = filteredStudents.slice(startIdxStu, endIdxStu); // [web:239]

  useEffect(() => {
    setPageStu((p) => Math.min(Math.max(1, p), totalPagesStu));
  }, [totalPagesStu]); // [web:239]

  useEffect(() => {
    loadSections();
    loadStudents();
  }, []); // [web:430]

  const MAX_PAGES = 5;
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
  }; // [web:239]

  const gotoPageStu = (n) =>
    setPageStu(Math.min(Math.max(1, n), totalPagesStu)); // [web:239]
  const firstPageStu = () => gotoPageStu(1); // [web:239]
  const prevPageStu = () => gotoPageStu(pageStu - 1); // [web:239]
  const nextPageStu = () => gotoPageStu(pageStu + 1); // [web:239]
  const lastPageStu = () => gotoPageStu(totalPagesStu); // [web:239]

  return (
    <>
      <div className="studentList">
        <h2>Student List</h2>

        <div className="studentListCards">
          {GRADES.map((g) => (
            <div key={g.value} className={`studentListCard grade${g.value}`}>
              <p className="gradeLevel">{g.label}</p>
              <h2>
                {
                  students.filter(
                    (s) =>
                      Number(s.grade_level) === g.value &&
                      !(s.section || '').trim()
                  ).length
                }
              </h2>
              <p>Without Sections</p>
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

        <div className="studentActions">
          <button
            onClick={() =>
              automateStudentSectioning(Number(studentListGrade) || 0)
            }
          >
            {studentListGrade ? 'Automate Sectioning' : 'Automate All Grades'}
          </button>
          <button
            onClick={() =>
              removeStudentSectioning(Number(studentListGrade) || 0)
            }
          >
            {studentListGrade ? 'Remove Sectioning' : 'Remove All Sectioning'}
          </button>
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
                        onClick={() => openOverrideStudent(student.student_id)}
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
              value={pageSizeStu}
              onChange={(e) => {
                setPageSizeStu(parseInt(e.target.value, 10));
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
            >
              <ion-icon name="play-back-outline"></ion-icon>
            </button>
            <button
              className="pager-btn"
              onClick={prevPageStu}
              disabled={pageStu === 1}
            >
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>
            {getPageNumbersStu().map((pkey, idx) =>
              pkey === '…' ? (
                <span key={`ellipsis-stu-${idx}`} className="pager-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={`stu-${pkey}`}
                  className={`pager-page ${pageStu === pkey ? 'active' : ''}`}
                  onClick={() => gotoPageStu(pkey)}
                >
                  {pkey}
                </button>
              )
            )}
            <button
              className="pager-btn"
              onClick={nextPageStu}
              disabled={pageStu === totalPagesStu}
            >
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </button>
            <button
              className="pager-btn"
              onClick={lastPageStu}
              disabled={pageStu === totalPagesStu}
            >
              <ion-icon name="play-forward-outline"></ion-icon>
            </button>
          </div>
        </div>
      </div>

      {/* Override Modal */}
      <ReusableModalBox
        show={showOverrideStudent}
        onClose={() => setShowOverrideStudent(false)}
      >
        <div className="overrideStudent">
          <div className="overrideStudentHeader">
            <h2>Override Section Assignment</h2>
            <div style={{ fontSize: 12, color: '#667085' }}>
              {overrideStudentGrade != null
                ? `Grade ${overrideStudentGrade} sections`
                : 'Select a student with a valid grade'}
            </div>
          </div>
          <div className="overrideSelection">
            <label>Section</label>
            <select
              value={overrideTargetSectionId}
              onChange={(e) => setOverrideTargetSectionId(e.target.value)}
              disabled={overrideStudentGrade == null}
            >
              <option value="">
                {overrideStudentGrade == null
                  ? 'No grade detected'
                  : 'Select section'}
              </option>
              {overrideSectionsForGrade.map((s) => (
                <option key={s.section_id} value={s.section_id}>
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
              disabled={
                !overrideTargetSectionId || overrideStudentGrade == null
              }
            >
              Apply
            </button>
          </div>
        </div>
      </ReusableModalBox>

      {/* Confirm Apply */}
      <ReusableModalBox
        show={showApplyStudent}
        onClose={() => setShowApplyStudent(false)}
      >
        <div className="studentApply">
          <h2>Apply Changes?</h2>
          <div className="buttons">
            <button onClick={applyOverrideStudent}>Yes</button>
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

      {/* Notification */}
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
    </>
  );
};

export default StudentList;
