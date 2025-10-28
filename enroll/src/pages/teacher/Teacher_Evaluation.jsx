import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './teacher_evaluation.css';
import { useState, useEffect } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import { supabase } from '../../supabaseClient';

const STATIC_SY = '2025-2026';

export const Teacher_Evaluation = () => {
  const [showViewGrade, setShowViewGrade] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveNotif, setShowApproveNotif] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adviserSection, setAdviserSection] = useState(null);
  const [subjectTeachers, setSubjectTeachers] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalStatus, setApprovalStatus] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const userId = Number(
          localStorage.getItem('user_id') || localStorage.getItem('app_user_id')
        );

        const { data: teacher } = await supabase
          .from('teachers')
          .select('teacher_id')
          .eq('user_id', userId)
          .single();
        if (!teacher) return;

        const { data: section } = await supabase
          .from('sections')
          .select('section_id, name, grade_level')
          .eq('adviser_id', teacher.teacher_id)
          .single();
        if (!section) return;

        if (mounted) setAdviserSection(section);

        const { data: teacherSubjects } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id, teacher_id, subject_id')
          .eq('section_id', section.section_id)
          .eq('school_year', STATIC_SY)
          .eq('is_hgp', false);

        if (!teacherSubjects || teacherSubjects.length === 0) {
          if (mounted) setSubjectTeachers([]);
          setLoading(false);
          return;
        }

        const teacherIds = [
          ...new Set(teacherSubjects.map((ts) => ts.teacher_id)),
        ];
        const subjectIds = [
          ...new Set(teacherSubjects.map((ts) => ts.subject_id)),
        ];

        const { data: teachers } = await supabase
          .from('teachers')
          .select('teacher_id, user_id')
          .in('teacher_id', teacherIds);
        const teacherUserIds = [...new Set(teachers.map((t) => t.user_id))];
        const { data: users } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', teacherUserIds);
        const { data: subjects } = await supabase
          .from('subjects')
          .select('subject_id, name')
          .in('subject_id', subjectIds);

        const teacherMap = new Map(
          teachers.map((t) => [t.teacher_id, t.user_id])
        );
        const userMap = new Map(
          users.map((u) => [
            u.user_id,
            `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          ])
        );
        const subjectMap = new Map(subjects.map((s) => [s.subject_id, s.name]));

        const subjectData = teacherSubjects.map((ts) => ({
          teacher_subject_id: ts.teacher_subject_id,
          teacher_id: ts.teacher_id,
          teacher_name: userMap.get(teacherMap.get(ts.teacher_id)) || 'Unknown',
          subject_id: ts.subject_id,
          subject_name: subjectMap.get(ts.subject_id) || 'Unknown',
        }));

        const approvalStatusMap = {};
        for (const ts of teacherSubjects) {
          const { data: gradeRows } = await supabase
            .from('grades')
            .select('adviser_approved')
            .eq('teacher_subject_id', ts.teacher_subject_id)
            .eq('school_year', STATIC_SY)
            .limit(1);
          approvalStatusMap[ts.teacher_subject_id] =
            gradeRows &&
            gradeRows.length > 0 &&
            gradeRows[0].adviser_approved === true;
        }

        if (mounted) {
          setSubjectTeachers(subjectData);
          setApprovalStatus(approvalStatusMap);
        }
      } catch (e) {
        console.error('Error loading evaluation data:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadSubjectGrades = async (subjectTeacher) => {
    setSelectedSubject(subjectTeacher);
    setLoading(true);
    try {
      const { data: studs } = await supabase
        .from('students')
        .select(
          'student_id, lrn, first_name, last_name, student_sections!inner(section_id, school_year)'
        )
        .eq('student_sections.section_id', adviserSection.section_id)
        .eq('student_sections.school_year', STATIC_SY)
        .order('last_name', { ascending: true });

      setStudents(studs || []);

      const { data: gRows } = await supabase
        .from('grades')
        .select('student_id, quarter, grade')
        .eq('teacher_subject_id', subjectTeacher.teacher_subject_id)
        .eq('school_year', STATIC_SY);

      const gradeMap = {};
      (gRows || []).forEach((g) => {
        if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
        gradeMap[g.student_id][g.quarter] = g.grade;
      });

      setGrades(gradeMap);
    } catch (e) {
      console.error('Error loading grades:', e);
      setStudents([]);
      setGrades({});
    } finally {
      setLoading(false);
    }
  };

  const computeFinal = (studentId) => {
    const row = grades[studentId] || {};
    const arr = [row[1], row[2], row[3], row[4]].filter(
      (x) => typeof x === 'number'
    );
    if (!arr.length) return '';
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  };

  const computeRemarks = (finalGrade) => {
    if (!finalGrade) return '';
    return finalGrade >= 75 ? 'Passed' : 'Failed';
  };

  const approveGrades = async () => {
    if (!selectedSubject) return;
    try {
      const { error } = await supabase
        .from('grades')
        .update({ adviser_approved: true })
        .eq('teacher_subject_id', selectedSubject.teacher_subject_id)
        .eq('school_year', STATIC_SY);
      if (error) throw error;

      setApprovalStatus((prev) => ({
        ...prev,
        [selectedSubject.teacher_subject_id]: true,
      }));

      setShowApproveConfirm(false);
      setShowViewGrade(false);
      setShowApproveNotif(true);
    } catch (e) {
      console.error('Error approving grades:', e);
      alert('Failed to approve grades: ' + e.message);
    }
  };

  const isApproved = (teacherSubjectId) =>
    approvalStatus[teacherSubjectId] === true;

  const filteredSubjects = subjectTeachers.filter((st) => {
    const matchSearch = search
      ? st.subject_name.toLowerCase().includes(search.toLowerCase()) ||
        st.teacher_name.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchSubject = subjectFilter
      ? st.subject_name === subjectFilter
      : true;
    const matchStatus =
      statusFilter === ''
        ? true
        : statusFilter === 'approved'
          ? isApproved(st.teacher_subject_id)
          : !isApproved(st.teacher_subject_id);
    return matchSearch && matchSubject && matchStatus;
  });

  return (
    <>
      <Header userRole="teacher" />
      <Navigation_Bar userRole="teacher" />
      <div className="teacherEvaluationContainer">
        <div className="title">
          <h2>
            My Advisory -{' '}
            {adviserSection
              ? `${adviserSection.name} (Grade ${adviserSection.grade_level})`
              : 'Loading...'}
          </h2>
        </div>
        <div className="sorters">
          <div className="search">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="Searchbar"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sorter">
            <label>Faculty/Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All Subjects</option>
              {[...new Set(subjectTeachers.map((st) => st.subject_name))].map(
                (name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="sorter">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <div className="evaluationArea">
          {loading && <p>Loading...</p>}
          {!loading && filteredSubjects.length === 0 && (
            <p>No subjects found</p>
          )}
          {!loading &&
            filteredSubjects.map((st) => (
              <div key={st.teacher_subject_id} className="subjectCard">
                <div className="subjectCardContent">
                  <h3>{st.subject_name}</h3>
                  <p>Teacher: {st.teacher_name}</p>
                  {isApproved(st.teacher_subject_id) && (
                    <p
                      style={{
                        color: '#28a745',
                        fontWeight: 'bold',
                        marginTop: '5px',
                      }}
                    >
                      Approved
                    </p>
                  )}
                  {!isApproved(st.teacher_subject_id) && (
                    <p
                      style={{
                        color: '#ff9800',
                        fontWeight: 'bold',
                        marginTop: '5px',
                      }}
                    >
                      Pending
                    </p>
                  )}
                </div>
                <div className="subjectCardButtons">
                  <button
                    className="viewGradesBtn"
                    onClick={async () => {
                      await loadSubjectGrades(st);
                      setShowViewGrade(true);
                    }}
                  >
                    View Grades
                  </button>
                  <button
                    className="approveGradesBtn"
                    onClick={async () => {
                      await loadSubjectGrades(st);
                      setShowApproveConfirm(true);
                    }}
                    disabled={isApproved(st.teacher_subject_id)}
                    style={{
                      opacity: isApproved(st.teacher_subject_id) ? 0.5 : 1,
                      cursor: isApproved(st.teacher_subject_id)
                        ? 'not-allowed'
                        : 'pointer',
                    }}
                  >
                    {isApproved(st.teacher_subject_id)
                      ? 'Already Approved'
                      : 'Approve Grades'}
                  </button>
                </div>
              </div>
            ))}
        </div>

        <ReusableModalBox
          show={showViewGrade}
          onClose={() => setShowViewGrade(false)}
        >
          <div className="viewGrade">
            <h3 style={{ marginBottom: '20px' }}>
              {selectedSubject?.subject_name} - {selectedSubject?.teacher_name}
            </h3>
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
                  {students.map((s, idx) => {
                    const row = grades[s.student_id] || {};
                    const finalGrade = computeFinal(s.student_id);
                    return (
                      <tr key={s.student_id}>
                        <td>{s.lrn}</td>
                        <td>
                          {idx + 1}. {s.last_name?.toUpperCase()},{' '}
                          {s.first_name}
                        </td>
                        <td>{row[1] || ''}</td>
                        <td>{row[2] || ''}</td>
                        <td>{row[3] || ''}</td>
                        <td>{row[4] || ''}</td>
                        <td>{finalGrade}</td>
                        <td>{computeRemarks(finalGrade)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className="modalButtons"
              style={{
                marginTop: '20px',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowViewGrade(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ccc',
                  background: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewGrade(false);
                  setShowApproveConfirm(true);
                }}
                disabled={isApproved(selectedSubject?.teacher_subject_id)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: isApproved(selectedSubject?.teacher_subject_id)
                    ? '#ccc'
                    : '#28a745',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: isApproved(selectedSubject?.teacher_subject_id)
                    ? 'not-allowed'
                    : 'pointer',
                }}
              >
                {isApproved(selectedSubject?.teacher_subject_id)
                  ? 'Already Approved'
                  : 'Approve Grades'}
              </button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showApproveConfirm}
          onClose={() => setShowApproveConfirm(false)}
        >
          <div className="confirmSubmit">
            <p>
              You're about to approve the grades for{' '}
              {selectedSubject?.subject_name}. Proceed?
            </p>
            <div className="btnContainer">
              <button
                className="cancel"
                onClick={() => setShowApproveConfirm(false)}
              >
                Cancel
              </button>
              <button onClick={approveGrades}>Proceed</button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showApproveNotif}
          onClose={() => setShowApproveNotif(false)}
        >
          <div className="notif">
            <div className="img" style={{ paddingTop: '10px' }}>
              <img
                src="checkImg.png"
                style={{ height: '50px', width: '50px' }}
              />
            </div>
            <h2>Successfully Approved!</h2>
          </div>
        </ReusableModalBox>
      </div>
    </>
  );
};
