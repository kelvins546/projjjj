// src/pages/applicant/Applicant_Homepage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import AlreadyEnrolledModal from '../../components/modals/AlreadyEnrolledModal';
import ApplicationDetailsModal from '../../components/modals/ApplicationDetailsModal';
import './applicant_homepage.css';
import { supabase } from '../../supabaseClient';

export const Applicant_Homepage = () => {
  const [enrollment, setEnrollment] = useState(null);
  const [modalOpen, setModalOpen] = useState(false); // "Already enrolled" modal
  const [student, setStudent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false); // "View Application" modal
  const [detailsId, setDetailsId] = useState(null);

  // Active school year + window + gate
  const [activeSY, setActiveSY] = useState(null); // { school_year, sy_start, sy_end, is_active }
  const [win, setWin] = useState(null); // { school_year, start_at, end_at, is_open }
  const [canApply, setCanApply] = useState(false); // computed gate
  const [loadingGate, setLoadingGate] = useState(true);

  // Closed modal state
  const [closedOpen, setClosedOpen] = useState(false);

  const navigate = useNavigate();

  // Helpers
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
    const load = async () => {
      try {
        setLoadingGate(true);

        const userId = Number(localStorage.getItem('user_id'));

        // 1) Student
        const s = await firstRow('students', (r) =>
          r
            .select(
              'student_id, applicant_id, first_name, last_name, lrn, gender, user_id'
            )
            .eq('user_id', userId)
            .order('student_id', { ascending: false })
            .limit(1)
        );
        setStudent(s);

        // 2) Latest enrollment for this applicant (if any)
        if (s?.applicant_id) {
          const enr = await firstRow('enrollments', (r) =>
            r
              .select('*')
              .eq('applicant_id', s.applicant_id)
              .order('application_date', { ascending: false })
              .limit(1)
          );
          setEnrollment(enr);
        } else {
          setEnrollment(null);
        }

        // 3) Active SY and best matching window (open now > active SY latest > latest created)
        const sy = await firstRow('school_years', (r) =>
          r
            .select('school_year, sy_start, sy_end, is_active, created_at')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
        );
        setActiveSY(sy);

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
        if (!w && sy?.school_year) {
          w = await firstRow('enrollment_windows', (r) =>
            r
              .select('school_year, start_at, end_at, is_open, created_at')
              .eq('school_year', sy.school_year)
              .order('created_at', { ascending: false })
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

        setWin(w);
        setCanApply(recomputeGate(w));
      } catch (err) {
        console.error(err);
        setCanApply(false);
      } finally {
        setLoadingGate(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    setCanApply(recomputeGate(win));
  }, [win]);

  const handleProceedNew = () => {
    navigate('/Applicant_enroll1');
  };

  const goToResubmit = (id) => {
    const targetId = id ?? enrollment?.enrollment_id;
    if (!targetId) return;
    localStorage.setItem('resubmit_enrollment_id', String(targetId));
    navigate('/Applicant_enroll1', {
      state: {
        resubmit: true,
        enrollment_id: targetId,
        applicant_id: student?.applicant_id || null,
      },
    });
  };

  // CTA guarded: if closed, show modal instead of navigating
  const onCtaClick = () => {
    if (!canApply) {
      setClosedOpen(true);
      return;
    }
    if (!enrollment) {
      handleProceedNew();
    } else if (enrollment.status === 'resubmit') {
      goToResubmit();
    } else {
      setModalOpen(true);
    }
  };

  // Closed modal (inline)
  const ClosedEnrollmentModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-card" style={{ maxWidth: 520 }}>
          <h3 style={{ margin: 0 }}>Enrollment is closed</h3>
          <p style={{ marginTop: 8, color: '#475569' }}>
            Enrollment for {activeSY?.school_year || 'the active school year'}{' '}
            is currently closed. Please check back during the official
            enrollment window.
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
            <div style={{ marginTop: 4 }}>
              If you already submitted documents and were asked to resubmit, you
              can try again once the window reopens.
            </div>
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
      <Header userRole="applicant" />
      <Navigation_Bar userRole="applicant" />

      {/* Already enrolled modal */}
      <AlreadyEnrolledModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* View Application modal */}
      <ApplicationDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        enrollmentId={detailsId}
        onResubmit={goToResubmit}
      />

      {/* Closed window modal */}
      <ClosedEnrollmentModal
        isOpen={closedOpen}
        onClose={() => setClosedOpen(false)}
      />

      <div className="mainContent">
        <div className="background">
          <div className="noticeBox">
            <div className="notice">
              <h2>NOTICE OF ENROLLMENT</h2>
              {loadingGate ? (
                <p>Checking enrollment window…</p>
              ) : canApply ? (
                <p>
                  The Enrollment System is open and currently accepting
                  applications for the upcoming school year (
                  {activeSY?.school_year || '—'}). Applications are processed on
                  a first‑come, first‑served basis, subject to slot
                  availability.
                </p>
              ) : (
                <p style={{ color: '#b91c1c' }}>
                  Enrollment is closed
                  {activeSY?.school_year ? ` for ${activeSY.school_year}` : ''}.
                  Click the button to see the schedule and details.
                </p>
              )}
              {!loadingGate && win && (
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Window: {fmtDT(win?.start_at)} → {fmtDT(win?.end_at)}
                </p>
              )}
            </div>

            <div className="buttonContainerCard">
              <button
                onClick={onCtaClick}
                title={
                  canApply
                    ? ''
                    : 'Enrollment is currently closed. Click for details.'
                }
              >
                {enrollment?.status === 'resubmit'
                  ? 'Resubmit now'
                  : 'Proceed to enrollment'}
              </button>
            </div>
          </div>

          {enrollment && student && (
            <div className="enrollment-application-card">
              {/* Top row: Date + Status */}
              <div className="enroll-card-row">
                <div>
                  <strong>Date of application:</strong>{' '}
                  {enrollment.application_date
                    ? new Date(enrollment.application_date).toLocaleDateString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'long',
                          day: '2-digit',
                        }
                      ) +
                      ' ' +
                      new Date(enrollment.application_date).toLocaleTimeString(
                        'en-US',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        }
                      )
                    : ''}
                </div>

                <div>
                  <img
                    src={
                      enrollment.status === 'resubmit'
                        ? '/warning.png'
                        : '/pending.png'
                    }
                    alt="Status Icon"
                    style={{
                      width: 18,
                      height: 18,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                  <strong>Status:</strong>{' '}
                  <span style={{ fontStyle: 'italic' }}>
                    {enrollment.status.charAt(0).toUpperCase() +
                      enrollment.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Middle row: Main details */}
              <div className="enroll-card-row">
                <div className="enroll-info">
                  <div>
                    <strong>Name:</strong> {student.first_name}{' '}
                    {student.last_name}
                  </div>
                  <div>
                    <strong>Grade Level:</strong> {enrollment.grade_level}
                  </div>
                  <div>
                    <strong>School Year:</strong> {enrollment.school_year}
                  </div>
                </div>

                <div className="enroll-actions"></div>
              </div>

              {/* Bottom row: Next Step */}
              <div className="enroll-card-row" style={{ marginTop: 8 }}>
                <div>
                  <strong>Next Step:</strong>{' '}
                  {enrollment.status === 'resubmit'
                    ? 'Please resubmit your details and re‑upload the required documents.'
                    : 'Please wait for verification. You will receive an email once reviewed.'}
                </div>

                <div className="enroll-actions" style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setDetailsId(enrollment.enrollment_id);
                      setDetailsOpen(true);
                    }}
                  >
                    View Application
                  </button>
                  {enrollment.status === 'resubmit' && (
                    <button
                      onClick={() => {
                        if (!canApply) {
                          setClosedOpen(true);
                          return;
                        }
                        goToResubmit();
                      }}
                      title={
                        canApply
                          ? ''
                          : 'Enrollment is currently closed. Click for details.'
                      }
                    >
                      Resubmit now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
