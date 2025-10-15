import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './student_homepage.css';
import { supabase } from '../../supabaseClient';

export const Student_Homepage = () => {
  const navigate = useNavigate();

  const [student, setStudent] = useState(null); // { student_id, applicant_id, first_name, last_name, middle_name?, suffix?, lrn, gender }
  const [latestAssign, setLatestAssign] = useState(null); // { school_year, section: { name, grade_level } | null }
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrMsg('');

        const userId = localStorage.getItem('user_id');
        if (!userId) {
          setErrMsg('Missing user session.');
          setLoading(false);
          return;
        }

        // 1) Fetch student profile by user_id (include applicant_id for enrollment fallback)
        const { data: stu, error: stuErr } = await supabase
          .from('students')
          .select(
            'student_id, applicant_id, first_name, last_name, middle_name, suffix, lrn, gender'
          )
          .eq('user_id', userId)
          .maybeSingle();
        if (stuErr) throw stuErr;

        if (!stu) {
          setErrMsg('Student profile not found.');
          setLoading(false);
          return;
        }

        // 2) Try latest assignment (join to sections to get grade_level)
        const { data: rows, error: secErr } = await supabase
          .from('student_sections')
          .select(
            `
            school_year,
            section:sections(
              name,
              grade_level
            )
          `
          )
          .eq('student_id', stu.student_id)
          .order('school_year', { ascending: false })
          .limit(1);
        if (secErr) throw secErr;

        let latest = rows && rows.length ? rows[0] : null;

        // 3) Fallback: if no assignment yet, use latest enrollment by applicant_id
        if (!latest && stu.applicant_id) {
          const { data: enroll, error: enErr } = await supabase
            .from('enrollments')
            .select('school_year, grade_level')
            .eq('applicant_id', stu.applicant_id)
            .order('application_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (enErr) throw enErr;
          if (enroll) {
            latest = {
              school_year: enroll.school_year,
              section: {
                name: null,
                // enrollments.grade_level is text in schema; render as-is
                grade_level: enroll.grade_level,
              },
            };
          }
        }

        if (mounted) {
          setStudent(stu);
          setLatestAssign(latest);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setErrMsg('Failed to load student data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const fullName = useMemo(() => {
    if (!student) return '';
    const {
      first_name = '',
      last_name = '',
      middle_name = '',
      suffix = '',
    } = student;
    const mi = middle_name ? `${middle_name[0].toUpperCase()}.` : '';
    return [first_name, mi, last_name, suffix].filter(Boolean).join(' ');
  }, [student]);

  const welcomeLine = useMemo(() => {
    if (!student) return '';
    const caps =
      `${(student.last_name || '').toUpperCase()} ${(student.first_name || '').toUpperCase()}`.trim();
    const lrn = student.lrn || '—';
    return `Welcome, ${caps} (${lrn})`;
  }, [student]);

  const schoolYear = latestAssign?.school_year || '—';
  const gradeLevel = latestAssign?.section?.grade_level ?? '—';
  const sectionName = latestAssign?.section?.name
    ? latestAssign.section.name
    : 'TBD';

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />

      <div className="studentHomepageContainer">
        <div className="studentWelcoming">
          <p>{loading ? 'Loading…' : errMsg || welcomeLine}</p>
        </div>

        {!loading && !errMsg && (
          <>
            <div className="studentCard">
              <div className="studentDataContainer">
                <div className="studentData">
                  <h2>Student Name:</h2>
                  <p>{fullName || '—'}</p>
                </div>
                <div className="studentData">
                  <h2>LRN:</h2>
                  <p>{student?.lrn || '—'}</p>
                </div>
                <div className="studentData">
                  <h2>Gender:</h2>
                  <p>{student?.gender || '—'}</p>
                </div>
              </div>

              <div className="studentDataContainer">
                <div className="studentData">
                  <h2>School Year:</h2>
                  <p>{schoolYear}</p>
                </div>
                <div className="studentData">
                  <h2>Grade Level:</h2>
                  <p>{gradeLevel}</p>
                </div>
                <div className="studentData">
                  <h2>Section:</h2>
                  <p>{sectionName}</p>
                </div>
              </div>
            </div>

            <div className="noticeBoxContainer">
              <div className="noticeBox">
                <div className="notice">
                  <h2>NOTICE OF ENROLLMENT</h2>
                  <p>
                    This is to formally inform all parents/guardians that the
                    Enrollment System is open and currently accepting
                    applications for the upcoming school year. You may proceed
                    by completing the online enrollment form and uploading all
                    required documents through this system. Please be reminded
                    that applications will be processed on a first come, first
                    served basis, subject to the availability of slots.
                    <br />
                    Thank you for your continued trust and support.
                  </p>
                </div>
                <div className="buttonContainer">
                  <button onClick={() => navigate('/Student_Enrollment')}>
                    Proceed to enrollment
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
