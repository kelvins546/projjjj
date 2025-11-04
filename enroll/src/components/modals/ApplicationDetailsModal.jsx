// src/components/modals/ApplicationDetailsModal.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ApplicationDetailsModal.css';

const Row = ({ label, value }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8 }}>
    <div>
      <strong>{label}</strong>
    </div>
    <div>{value || '—'}</div>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ marginTop: 14 }}>
    <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
      {children}
    </div>
  </div>
);

const ApplicationDetailsModal = ({
  isOpen,
  onClose,
  enrollmentId,
  onResubmit,
}) => {
  const [loading, setLoading] = useState(false);

  // Enrollment summary
  const [enrollment, setEnrollment] = useState(null);

  // Student + DOB
  const [student, setStudent] = useState(null);
  const [dob, setDob] = useState(null);

  // Family, Health, Academic
  const [family, setFamily] = useState(null);
  const [health, setHealth] = useState(null);
  const [academic, setAcademic] = useState(null);

  // Errors (optional: show at top)
  const [err, setErr] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isOpen || !enrollmentId) return;

      setLoading(true);
      setErr(null);

      try {
        // 1) Enrollment (context/root)
        const { data: enr, error: enrErr } = await supabase
          .from('enrollments')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .maybeSingle(); // zero-or-one safe [web:170]
        if (!active) return;
        if (enrErr) throw enrErr;
        setEnrollment(enr || null);

        const applicantId = enr?.applicant_id || null;

        // 2) Student by applicant_id (might not exist yet for early applications)
        let s = null;
        if (applicantId) {
          const { data: sRow, error: sErr } = await supabase
            .from('students')
            .select('*')
            .eq('applicant_id', applicantId)
            .maybeSingle(); // zero-or-one safe [web:170]
          if (sErr) throw sErr;
          s = sRow || null;
        }
        if (!active) return;
        setStudent(s);

        // 3) DOB from users if student has user_id
        if (s?.user_id) {
          const { data: uRow, error: uErr } = await supabase
            .from('users')
            .select('date_of_birth')
            .eq('user_id', s.user_id)
            .maybeSingle(); // zero-or-one safe [web:170]
          if (uErr) throw uErr;
          if (!active) return;
          setDob(uRow?.date_of_birth || null);
        } else {
          setDob(null);
        }

        // 4) Family via OR on student_id/applicant_id (pick latest)
        const orFamily = [
          s?.student_id ? `student_id.eq.${s.student_id}` : null,
          applicantId ? `applicant_id.eq.${applicantId}` : null,
        ]
          .filter(Boolean)
          .join(',');
        if (orFamily) {
          const { data: fam, error: fErr } = await supabase
            .from('family_info')
            .select('*')
            .or(orFamily) // OR filter across ids [web:155]
            .order('family_id', { ascending: false })
            .limit(1)
            .maybeSingle(); // zero-or-one safe [web:170]
          if (fErr) throw fErr;
          if (!active) return;
          setFamily(fam || null);
        } else {
          setFamily(null);
        }

        // 5) Health via OR on student_id/applicant_id (pick latest)
        const orHealth = [
          s?.student_id ? `student_id.eq.${s.student_id}` : null,
          applicantId ? `applicant_id.eq.${applicantId}` : null,
        ]
          .filter(Boolean)
          .join(',');
        if (orHealth) {
          const { data: h, error: hErr } = await supabase
            .from('health_info')
            .select('*')
            .or(orHealth) // OR filter across ids [web:155]
            .order('health_id', { ascending: false })
            .limit(1)
            .maybeSingle(); // zero-or-one safe [web:170]
          if (hErr) throw hErr;
          if (!active) return;
          setHealth(h || null);
        } else {
          setHealth(null);
        }

        // 6) Academic: latest for student
        if (s?.student_id) {
          const { data: acadRows, error: aErr } = await supabase
            .from('academic_history')
            .select('*')
            .eq('student_id', s.student_id)
            .order('academic_id', { ascending: false })
            .limit(1);
          if (aErr) throw aErr;
          if (!active) return;
          setAcademic(acadRows?.[0] || null);
        } else {
          setAcademic(null);
        }
      } catch (e) {
        if (!active) return;
        setErr(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [isOpen, enrollmentId]);

  if (!isOpen) return null;

  const dt = enrollment?.application_date
    ? new Date(enrollment.application_date)
    : null;

  // derive address from students.address "street, barangay, city"
  const addrParts = (student?.address || '').split(',').map((x) => x.trim());
  const streetBlock = addrParts[0] || '';
  const barangay = addrParts[1] || '';
  const city = addrParts[2] || '';

  const safeDateTime = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app_view_title"
      aria-describedby="app_view_desc"
    >
      <div className="modal-content">
        <h2 id="app_view_title">Application Details</h2>
        <p id="app_view_desc" style={{ marginTop: 6 }}>
          Review your submitted application information.
        </p>

        {err && <div style={{ color: 'crimson', marginTop: 8 }}>{err}</div>}
        {loading && <div style={{ marginTop: 12 }}>Loading…</div>}

        {/* Enrollment summary */}
        {!loading && !enrollment && (
          <div style={{ marginTop: 12 }}>Application not found.</div>
        )}

        {!loading && enrollment && (
          <>
            <Section title="Submission">
              <Row label="Application ID:" value={enrollment.enrollment_id} />
              <Row label="Status:" value={enrollment.status} />
              <Row label="Grade Level:" value={enrollment.grade_level} />
              <Row label="School Year:" value={enrollment.school_year} />
              <Row
                label="Applied On:"
                value={dt ? safeDateTime(enrollment.application_date) : '—'}
              />
            </Section>

            {/* Student profile */}
            <Section title="Student Profile">
              <Row label="First Name:" value={student?.first_name} />
              <Row label="Middle Name:" value={student?.middle_name} />
              <Row label="Last Name:" value={student?.last_name} />
              <Row label="Suffix:" value={student?.suffix} />
              <Row label="LRN:" value={student?.lrn} />
              <Row label="Gender:" value={student?.gender} />
              <Row label="Date of Birth:" value={dob || '—'} />
              <Row label="Place of Birth:" value={student?.place_of_birth} />
              <Row label="Citizenship:" value={student?.citizenship} />
              <Row label="Civil Status:" value={student?.civil_status} />
              <Row label="Mother Tongue:" value={student?.mother_tongue} />
              <Row
                label="Indigenous Group:"
                value={student?.indigenous_group}
              />
            </Section>

            {/* Address */}
            <Section title="Address">
              <Row label="Street / Block:" value={streetBlock} />
              <Row label="Barangay:" value={barangay} />
              <Row label="City:" value={city} />
              <Row label="Raw Address:" value={student?.address} />
            </Section>

            {/* Family / Guardian */}
            <Section title="Family / Guardian">
              <Row label="Father's Name:" value={family?.father_name} />
              <Row
                label="Father's Occupation:"
                value={family?.father_occupation}
              />
              <Row label="Father's Contact:" value={family?.father_contact} />
              <Row label="Mother's Name:" value={family?.mother_name} />
              <Row
                label="Mother's Occupation:"
                value={family?.mother_occupation}
              />
              <Row label="Mother's Contact:" value={family?.mother_contact} />
              <Row label="Guardian's Name:" value={family?.guardian_name} />
              <Row
                label="Guardian's Relationship:"
                value={family?.guardian_relationship}
              />
              <Row
                label="Guardian's Contact:"
                value={family?.guardian_contact}
              />
              <Row
                label="Guardian's Occupation:"
                value={family?.guardian_occupation}
              />
              <Row
                label="Guardian Street/Block:"
                value={family?.guardian_street_block}
              />
              <Row
                label="Guardian Barangay:"
                value={family?.guardian_barangay}
              />
              <Row label="Guardian City:" value={family?.guardian_city} />
              <Row
                label="Emergency Contact Name:"
                value={family?.emergency_contact_name}
              />
              <Row
                label="Emergency Contact Number:"
                value={family?.emergency_contact_number}
              />
            </Section>

            {/* Health */}
            <Section title="Health Information">
              <Row
                label="Medical Conditions:"
                value={health?.medical_conditions}
              />
              <Row label="Blood Type:" value={health?.blood_type} />
            </Section>

            {/* Academic */}
            <Section title="Academic History (Latest)">
              <Row
                label="Former School Name:"
                value={academic?.former_school_name}
              />
              <Row
                label="Former School Address:"
                value={academic?.former_school_address}
              />
              <Row
                label="Last Grade Completed:"
                value={String(academic?.last_grade_level_completed ?? '')}
              />
              <Row
                label="Last School Year:"
                value={academic?.last_school_year_attended}
              />
              <Row
                label="General Average:"
                value={String(academic?.general_average ?? '')}
              />
            </Section>
          </>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 16,
          }}
        >
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetailsModal;
