import './masterlist.css';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

export const MasterList = ({
  showMasterList,
  closeMasterList,
  sectionId,
  sectionName,
  gradeLevel,
}) => {
  const STATIC_SY = '2025-2026';

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [students, setStudents] = useState([]);

  const [resolvedSectionName, setResolvedSectionName] = useState(
    sectionName || '—'
  );
  const [resolvedGrade, setResolvedGrade] = useState(gradeLevel || '');
  const [roomLabel, setRoomLabel] = useState('—');
  const [teacherDept, setTeacherDept] = useState('—');
  const [teacherId, setTeacherId] = useState(null);

  useEffect(() => {
    if (!showMasterList) return;
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
            department:departments(name)
          `
          )
          .eq('user_id', uidNum)
          .single();

        if (!mounted) return;
        setTeacherId(trow?.teacher_id || null);
        setTeacherDept(trow?.department?.name || '—');
      } catch {
        if (mounted) {
          setTeacherId(null);
          setTeacherDept('—');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showMasterList]);

  useEffect(() => {
    if (!showMasterList || !teacherId || !sectionId) return;
    let mounted = true;
    (async () => {
      try {
        const { data: schedRows } = await supabase
          .from('teacher_schedules')
          .select(
            `
            section_id,
            section:sections(
              section_id,
              name,
              grade_level,
              room_label
            )
          `
          )
          .eq('teacher_id', teacherId)
          .eq('section_id', sectionId)
          .limit(1);

        const sec =
          Array.isArray(schedRows) && schedRows.length
            ? schedRows[0]?.section || null
            : null;

        if (mounted) {
          if (sec) {
            setResolvedSectionName(sec.name || sectionName || '—');
            setResolvedGrade(Number(sec.grade_level) || gradeLevel || '');
            setRoomLabel(sec.room_label || '—');
          } else {
            const { data: secRow } = await supabase
              .from('sections')
              .select('name, grade_level, room_label')
              .eq('section_id', sectionId)
              .single();
            setResolvedSectionName(secRow?.name || sectionName || '—');
            setResolvedGrade(Number(secRow?.grade_level) || gradeLevel || '');
            setRoomLabel(secRow?.room_label || '—');
          }
        }
      } catch {
        if (mounted) {
          setResolvedSectionName(sectionName || '—');
          setResolvedGrade(gradeLevel || '');
          setRoomLabel('—');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showMasterList, teacherId, sectionId, sectionName, gradeLevel]);

  useEffect(() => {
    if (!showMasterList || !sectionId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrMsg('');
      try {
        const { data, error } = await supabase
          .from('students')
          .select(
            `
            student_id,
            first_name,
            last_name,
            gender,
            student_sections:student_sections!inner(section_id, school_year)
          `
          )
          .eq('student_sections.section_id', sectionId)
          .eq('student_sections.school_year', STATIC_SY)
          .order('last_name', { ascending: true });
        if (error) throw error;
        if (mounted) setStudents(data || []);
      } catch {
        if (mounted) setErrMsg('Failed to load masterlist.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showMasterList, sectionId]);

  const boys = useMemo(
    () =>
      students.filter((s) =>
        String(s.gender || '')
          .toLowerCase()
          .startsWith('m')
      ),
    [students]
  );
  const girls = useMemo(
    () =>
      students.filter((s) =>
        String(s.gender || '')
          .toLowerCase()
          .startsWith('f')
      ),
    [students]
  );

  if (!showMasterList) return null;

  const titleSY = STATIC_SY;
  const titleSection =
    resolvedSectionName || (sectionId ? `Section ${sectionId}` : 'Section —');
  const titleGrade = resolvedGrade ? `Grade ${resolvedGrade}` : '';

  return (
    <div className="masterListOverlay" onClick={closeMasterList}>
      <div className="masterListContainer" onClick={(e) => e.stopPropagation()}>
        <div className="masterListTitle">
          <div className="masterlistHeader">
            <div className="educInfo">
              <img className="educSeal" src="/DeptEduc_Seal.png"></img>
              <div className="masterlistheaderText">
                <span>Republic of the Philippines</span>
                <span className="depEd">Department of Education</span>
                <span>National Capital Region</span>
              </div>
              <img src="/schoollogo.png"></img>
            </div>
            <div className="schoolsDiv">
              <h2>SCHOOLS DIVISION OFFICE OF CALOOCAN CITY</h2>
              <p>North II</p>
            </div>
          </div>
          <h2>BENIGNO AQUINO JR. HIGH SCHOOL</h2>
          <p className="schoolYear">{`SY ${titleSY}`}</p>
          <p>{`${titleGrade ? titleGrade + ' - ' : ''}${titleSection} - MASTERLIST`}</p>
          <p>{`Department: ${teacherDept}`}</p>
          <p>{`Room: ${roomLabel}`}</p>
        </div>

        <div className="studentList">
          {loading ? (
            <div style={{ padding: 8 }}>
              <p>Loading…</p>
            </div>
          ) : errMsg ? (
            <div style={{ padding: 8 }}>
              <p>{errMsg}</p>
            </div>
          ) : (
            <table className="masterlist-table">
              <colgroup>
                <col className="col-num" />
                <col className="col-name" />
                <col className="col-num" />
                <col className="col-name" />
              </colgroup>

              <thead>
                <tr>
                  <th colSpan="2">BOYS</th>
                  <th colSpan="2">GIRLS</th>
                </tr>
                <tr>
                  <th className="column1">#</th>
                  <th>NAME</th>
                  <th className="column1">#</th>
                  <th>NAME</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({
                  length: Math.max(boys.length, girls.length),
                }).map((_, i) => (
                  <tr key={i}>
                    <td className="column1">{boys[i] ? i + 1 : ''}</td>
                    <td>
                      {boys[i]
                        ? `${boys[i].last_name?.toUpperCase() || ''}, ${boys[i].first_name || ''}`
                        : ''}
                    </td>
                    <td className="column1">{girls[i] ? i + 1 : ''}</td>
                    <td>
                      {girls[i]
                        ? `${girls[i].last_name?.toUpperCase() || ''}, ${girls[i].first_name || ''}`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="masterListBtns">
          <button onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </div>
  );
};
