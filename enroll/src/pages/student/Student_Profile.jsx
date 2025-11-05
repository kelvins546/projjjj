// src/pages/student/Student_Profile.jsx
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';
import './student_profile.css';

const normalizeSY = (s) =>
  String(s || '')
    .replace(/[–—−]/g, '-')
    .trim();
const STATIC_SY = '2025-2026';

export const Student_Profile = () => {
  const [student, setStudent] = useState(null);
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState('/default-profile.png');
  const [loading, setLoading] = useState(true);

  // SY dropdown
  const [schoolYears, setSchoolYears] = useState([]);
  const [activeSY, setActiveSY] = useState(STATIC_SY);

  // Year-specific info
  const [section, setSection] = useState(null); // { name, grade_level }
  const [adviserName, setAdviserName] = useState('—');
  const [enrollmentStatus, setEnrollmentStatus] = useState('—');

  const fullName = useMemo(() => {
    if (!student) return '';
    const {
      first_name = '',
      middle_name = '',
      last_name = '',
      suffix = '',
    } = student;
    const mi = middle_name ? ` ${middle_name}` : '';
    return `${first_name}${mi} ${last_name} ${suffix || ''}`
      .replace(/\s+/g, ' ')
      .trim();
  }, [student]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      try {
        const userId = Number(localStorage.getItem('user_id'));
        if (!userId) {
          setLoading(false);
          return;
        }

        // User (email)
        const { data: uRows, error: uErr } = await supabase
          .from('users')
          .select('user_id, email, first_name, last_name, middle_name')
          .eq('user_id', userId)
          .order('user_id', { ascending: false })
          .limit(1);
        if (uErr) throw uErr;
        const u = uRows?.[0] || null;
        setUser(u);

        // Student by user
        const { data: sRows, error: sErr } = await supabase
          .from('students')
          .select(
            'student_id, applicant_id, lrn, last_name, first_name, middle_name, suffix, birthdate, profile_photo_url, user_id'
          )
          .eq('user_id', userId)
          .order('student_id', { ascending: false })
          .limit(1);
        if (sErr) throw sErr;
        const stu = sRows?.[0] || null;
        if (!stu) {
          setLoading(false);
          return;
        }
        setStudent(stu);
        if (stu?.profile_photo_url) setProfilePic(stu.profile_photo_url);

        // School year list for dropdown
        const { data: syList, error: syErr } = await supabase
          .from('school_years')
          .select('school_year, is_active, created_at')
          .order('created_at', { ascending: false });
        if (syErr) throw syErr;
        const list = (syList || []).map((r) => r.school_year);
        setSchoolYears(list);
        const activeRow = (syList || []).find((r) => r.is_active);
        setActiveSY(activeRow?.school_year || list?.[0] || STATIC_SY);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    const loadYearSpecific = async () => {
      if (!student?.student_id || !activeSY) return;
      try {
        // Student section for selected SY
        const { data: ssRows, error: ssErr } = await supabase
          .from('student_sections')
          .select('student_section_id, section_id, school_year')
          .eq('student_id', student.student_id)
          .eq('school_year', normalizeSY(activeSY))
          .order('student_section_id', { ascending: false })
          .limit(1);
        if (ssErr) throw ssErr;
        const ss = ssRows?.[0] || null;

        let sec = null;
        let adviser = '—';
        if (ss?.section_id) {
          const { data: secRows, error: secErr } = await supabase
            .from('sections')
            .select('section_id, name, grade_level, adviser_id')
            .eq('section_id', ss.section_id)
            .order('section_id', { ascending: false })
            .limit(1);
          if (secErr) throw secErr;
          sec = secRows?.[0] || null;
          setSection(sec);

          if (sec?.adviser_id) {
            const { data: tRows, error: tErr } = await supabase
              .from('teachers')
              .select('teacher_id, user_id')
              .eq('teacher_id', sec.adviser_id)
              .order('teacher_id', { ascending: false })
              .limit(1);
            if (tErr) throw tErr;
            const t = tRows?.[0] || null;

            if (t?.user_id) {
              const { data: nRows, error: nErr } = await supabase
                .from('users')
                .select('user_id, first_name, last_name')
                .eq('user_id', t.user_id)
                .order('user_id', { ascending: false })
                .limit(1);
              if (nErr) throw nErr;
              const nu = nRows?.[0] || null;
              adviser = nu
                ? `${nu.first_name || ''} ${nu.last_name || ''}`.trim()
                : '—';
            }
          }
        } else {
          setSection(null);
        }
        setAdviserName(adviser);

        // Enrollment status for selected SY (pending/approved/etc.)
        let status = '—';
        if (student.applicant_id) {
          const { data: eRows, error: eErr } = await supabase
            .from('enrollments')
            .select('enrollment_id, status, school_year, application_date')
            .eq('applicant_id', student.applicant_id)
            .eq('school_year', normalizeSY(activeSY))
            .order('application_date', { ascending: false })
            .limit(1);
          if (eErr) throw eErr;
          status = eRows?.[0]?.status || '—';
        }
        setEnrollmentStatus(status);
      } catch (e) {
        console.error(e);
        setSection(null);
        setAdviserName('—');
        setEnrollmentStatus('—');
      }
    };
    loadYearSpecific();
  }, [student?.student_id, student?.applicant_id, activeSY]);

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfilePic(URL.createObjectURL(file));
  };

  if (loading) return <LoadingPopup />;

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />
      <div className="applicantProfileContainer">
        <div className="applicantDetails">
          <div className="applicantDatas">
            <div
              className="applicantDataName"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ margin: 0 }}>{fullName || '—'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label
                  htmlFor="sy-select"
                  style={{ fontSize: 13, color: '#64748b' }}
                >
                  School Year:
                </label>
                <select
                  id="sy-select"
                  value={activeSY}
                  onChange={(e) => setActiveSY(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 14 }}
                >
                  {schoolYears.length === 0 && (
                    <option value={activeSY}>{activeSY}</option>
                  )}
                  {schoolYears.map((sy) => (
                    <option key={sy} value={sy}>
                      {sy}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">LRN:</p>
                <p className="userData">{student?.lrn || 'N/A'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Birthdate:</p>
                <p className="userData">{student?.birthdate || 'N/A'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Email:</p>
                <p className="userData">{user?.email || 'N/A'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Section ({activeSY}):</p>
                <p className="userData">{section?.name || 'Not assigned'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Grade Level ({activeSY}):</p>
                <p className="userData">{section?.grade_level ?? '—'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Adviser ({activeSY}):</p>
                <p className="userData">{adviserName}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Enrollment Status ({activeSY}):</p>
                <p className="userData" style={{ textTransform: 'capitalize' }}>
                  {enrollmentStatus}
                </p>
              </div>
            </div>
          </div>

          <div className="applicantPhotoContainer">
            <div className="applicantPhoto">
              <img src={profilePic} alt="Student" className="profilePicture" />
              <label htmlFor="photo-upload" className="cameraOverlay">
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePicChange}
                />
                <i className="fa fa-camera" aria-hidden="true"></i>
              </label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
