// src/pages/student/Student_Homepage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './student_homepage.css';
import { supabase } from '../../supabaseClient';

export const Student_Homepage = () => {
  const navigate = useNavigate();

  const [student, setStudent] = useState(null); // { student_id, applicant_id, ... }
  const [latestAssign, setLatestAssign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // Window + gate
  const [activeSY, setActiveSY] = useState(null); // { school_year }
  const [win, setWin] = useState(null); // { school_year, start_at, end_at, is_open }
  const [canApply, setCanApply] = useState(false);
  const [loadingGate, setLoadingGate] = useState(true);
  const [alreadyInTarget, setAlreadyInTarget] = useState(false);

  // Closed/already modal
  const [closedOpen, setClosedOpen] = useState(false);

  // Helpers
  const normalizeSY = (s) =>
    String(s || '')
      .replace(/[–—−]/g, '-')
      .trim();

  // Never uses single()/maybeSingle(); always returns first row or null
  const firstRow = async (table, builder) => {
    const q = builder(supabase.from(table));
    const { data, error } = await q;
    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : data || null;
  };

  const recomputeGate = (w) => {
    if (!w?.is_open) return false;
    const now = Date.now();
    const s = w.start_at ? Date.parse(w.start_at) : 0;
    const e = w.end_at ? Date.parse(w.end_at) : 0;
    return now >= s && now <= e;
  };

  const fmtDT = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

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

        // 1) Student profile (pick one)
        const stu = await firstRow('students', (r) =>
          r
            .select(
              'student_id, applicant_id, first_name, last_name, middle_name, suffix, lrn, gender, user_id'
            )
            .eq('user_id', userId)
            .order('student_id', { ascending: false })
            .limit(1)
        );
        if (!stu) {
          setErrMsg('Student profile not found.');
          setLoading(false);
          return;
        }

        // 2) Latest section assignment (array API is fine here)
        const { data: rows, error: secErr } = await supabase
          .from('student_sections')
          .select('school_year, section:sections(name,grade_level)')
          .eq('student_id', stu.student_id)
          .order('school_year', { ascending: false })
          .limit(1);
        if (secErr) throw secErr;
        let latest = rows && rows.length ? rows[0] : null;

        // 3) Fallback via latest enrollment
        if (!latest && stu.applicant_id) {
          const enroll = await firstRow('enrollments', (r) =>
            r
              .select('school_year, grade_level')
              .eq('applicant_id', stu.applicant_id)
              .order('application_date', { ascending: false })
              .limit(1)
          );
          if (enroll) {
            latest = {
              school_year: enroll.school_year,
              section: { name: null, grade_level: enroll.grade_level },
            };
          }
        }

        // 4) Gate window: prefer one that is open now; else active SY; else latest created
        setLoadingGate(true);

        const syActive = await firstRow('school_years', (r) =>
          r
            .select('school_year, sy_start, sy_end, is_active, created_at')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
        );

        const nowIso = new Date().toISOString();
        const openNow = await firstRow('enrollment_windows', (r) =>
          r
            .select('school_year, start_at, end_at, is_open, created_at')
            .eq('is_open', true)
            .lte('start_at', nowIso)
            .gte('end_at', nowIso)
            .order('start_at', { ascending: false })
            .limit(1)
        );

        let w = openNow;
        if (!w && syActive?.school_year) {
          w = await firstRow('enrollment_windows', (r) =>
            r
              .select('school_year, start_at, end_at, is_open')
              .eq('school_year', normalizeSY(syActive.school_year))
              .limit(1)
          );
        }
        if (!w) {
          w = await firstRow('enrollment_windows', (r) =>
            r
              .select('school_year, start_at, end_at, is_open, created_at')
              .order('created_at', { ascending: false })
              .limit(1)
          );
        }

        const displaySY = openNow
          ? { school_year: openNow.school_year }
          : syActive || (w ? { school_year: w.school_year } : null);

        const gate = recomputeGate(w);

        // 5) Already for target SY? either has a section OR a blocking enrollment (pending/approved)
        let already = false;
        if (w?.school_year && stu?.student_id) {
          // section placed (if duplicates exist, take latest id)
          const ss = await firstRow('student_sections', (r) =>
            r
              .select('student_section_id')
              .eq('student_id', stu.student_id)
              .eq('school_year', normalizeSY(w.school_year))
              .order('student_section_id', { ascending: false })
              .limit(1)
          );
          already = !!ss?.student_section_id;

          // blocking enrollment
          if (!already && stu.applicant_id) {
            const enr = await firstRow('enrollments', (r) =>
              r
                .select('enrollment_id, status')
                .eq('applicant_id', stu.applicant_id)
                .eq('school_year', normalizeSY(w.school_year))
                .in('status', ['pending', 'approved'])
                .order('application_date', { ascending: false })
                .limit(1)
            );
            already = !!enr?.enrollment_id;
          }
        }

        if (mounted) {
          setStudent(stu);
          setLatestAssign(latest);
          setActiveSY(displaySY);
          setWin(w);
          setAlreadyInTarget(already);
          setCanApply(gate && !already);
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setErrMsg('Failed to load student data.');
          setCanApply(false);
          setAlreadyInTarget(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setLoadingGate(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCanApply(recomputeGate(win) && !alreadyInTarget);
  }, [win, alreadyInTarget]);

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

  const onProceed = () => {
    if (!canApply) {
      setClosedOpen(true);
      return;
    }
    const targetSY = win?.school_year || activeSY?.school_year || null;
    navigate('/Student_Enrollment', { state: { school_year: targetSY } });
  };

  const ClosedEnrollmentModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-card" style={{ maxWidth: 520 }}>
          <h3 style={{ margin: 0 }}>
            {alreadyInTarget
              ? 'Already enrolled for this School Year'
              : 'Enrollment is closed'}
          </h3>
          <p style={{ marginTop: 8, color: '#475569' }}>
            {alreadyInTarget
              ? `You are already assigned/enrolled for ${win?.school_year || activeSY?.school_year || 'this school year'}.`
              : `Enrollment for ${activeSY?.school_year || 'the active school year'} is currently closed. Please check back during the official enrollment window.`}
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 12,
              marginTop: 8,
              fontSize: 14,
              color: '#334155',
            }}
          >
            <div>
              <strong>Window:</strong> {fmtDT(win?.start_at)} →{' '}
              {fmtDT(win?.end_at)}
            </div>
            {!alreadyInTarget && (
              <div style={{ marginTop: 4 }}>
                If you were asked to resubmit, you can try again once the window
                reopens.
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 14,
            }}
          >
            <button onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />

      <ClosedEnrollmentModal
        isOpen={closedOpen}
        onClose={() => setClosedOpen(false)}
      />

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
                  {loadingGate ? (
                    <p>Checking enrollment window…</p>
                  ) : canApply ? (
                    <p>
                      The Enrollment System is open and currently accepting
                      applications for the upcoming school year (
                      {win?.school_year || activeSY?.school_year || '—'}).
                      Applications are processed on a first‑come, first‑served
                      basis, subject to slot availability.
                    </p>
                  ) : alreadyInTarget ? (
                    <p style={{ color: '#b91c1c' }}>
                      You are already enrolled/assigned for{' '}
                      {win?.school_year ||
                        activeSY?.school_year ||
                        'this school year'}
                      .
                    </p>
                  ) : (
                    <p style={{ color: '#b91c1c' }}>
                      Enrollment is closed
                      {win?.school_year || activeSY?.school_year
                        ? ` for ${win?.school_year || activeSY?.school_year}`
                        : ''}
                      . Click the button to see the schedule and details.
                    </p>
                  )}
                </div>
                <div className="buttonContainerCard">
                  {canApply ? (
                    <button onClick={onProceed}>Proceed to enrollment</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClosedOpen(true)}
                      className="btn-ghost"
                      title={
                        alreadyInTarget
                          ? 'Already enrolled for this school year.'
                          : 'Enrollment is currently closed. Click to view details.'
                      }
                    >
                      View enrollment details
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
