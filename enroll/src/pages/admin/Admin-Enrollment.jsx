import './enrollment.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Confirmation_Modal } from '../../components/modals/Confirmation_Modal';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import emailjs from 'emailjs-com';
import { ImageModal } from '../../components/modals/ImageModal';
import EnrollmentSuccessModal from '../../components/modals/EnrollmentSuccessModal';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';

const GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const normalizeSY = (s) => (s || '').replace(/[–—−]/g, '-').trim();

// Inline notify modal (collects choice + notes)
const NotifyModal = ({
  open,
  row,
  choice,
  notes,
  setChoice,
  setNotes,
  onClose,
  onContinue, // proceed to confirm
  busy,
}) => {
  if (!open || !row) return null;
  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 520 }}
      >
        <h3 style={{ margin: 0 }}>Notify Applicant</h3>
        <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
          {row.name} • {row.email} • {row.grade_level}
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="notifyReason"
              value="refer"
              checked={choice === 'refer'}
              onChange={(e) => setChoice(e.target.value)}
            />
            <span>Refer to other school (slots are full)</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="notifyReason"
              value="resubmit"
              checked={choice === 'resubmit'}
              onChange={(e) => setChoice(e.target.value)}
            />
            <span>Please resubmit documents (unclear)</span>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              color: '#475569',
              marginBottom: 4,
            }}
          >
            Optional notes to include
          </label>
          <textarea
            rows={4}
            style={{ width: '100%' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add specific guidance or instructions…"
          />
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="modal-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="modal-btn primary"
            onClick={onContinue}
            disabled={busy}
          >
            {busy ? 'Preparing…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Admin_Enrollment = () => {
  const [modalImage, setModalImage] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({
    type: 'single',
    ids: [],
  });

  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [searchText, setSearchText] = useState('');
  const [dateSort, setDateSort] = useState('Newest');
  const [gradeFilter, setGradeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [docCompleteOnly, setDocCompleteOnly] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [docsByStudent, setDocsByStudent] = useState(new Map());
  const [studentByApplicant, setStudentByApplicant] = useState(new Map());
  const [resubmitCount, setResubmitCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending'); // default: show Pending

  // Notify state
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyRow, setNotifyRow] = useState(null);
  const [notifyChoice, setNotifyChoice] = useState('refer'); // 'refer' | 'resubmit'
  const [notifyNotes, setNotifyNotes] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);

  // Notify confirm/success
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false);
  const [notifyConfirmBusy, setNotifyConfirmBusy] = useState(false);
  const [showNotifySuccess, setShowNotifySuccess] = useState(false);

  // Enrollment window per SY
  const [windowRow, setWindowRow] = useState(null); // { school_year, start_at, end_at, is_open }
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [winStart, setWinStart] = useState(''); // 'YYYY-MM-DDTHH:mm'
  const [winEnd, setWinEnd] = useState(''); // 'YYYY-MM-DDTHH:mm'
  const [winOpen, setWinOpen] = useState(false);

  // Open/close confirm + success for Enrollment Settings
  const [winAction, setWinAction] = useState(null); // 'open' | 'close' | null
  const [showWinConfirm, setShowWinConfirm] = useState(false);
  const [winConfirmBusy, setWinConfirmBusy] = useState(false);
  const [showWinSuccess, setShowWinSuccess] = useState(false);
  const [winSuccessMsg, setWinSuccessMsg] = useState('');

  // Build options like '2025-2026'
  const makeSyOptions = (
    centerYear = new Date().getFullYear(),
    back = 1,
    forward = 3
  ) => {
    const opts = [];
    for (let y = centerYear - back; y <= centerYear + forward; y++) {
      opts.push(`${y}-${y + 1}`);
    }
    return opts;
  };

  // Load window for selected SY
  const loadEnrollmentWindow = async () => {
    setLoadingWindow(true);
    try {
      const sy = normalizeSY(schoolYear);
      const { data, error } = await supabase
        .from('enrollment_windows')
        .select('school_year, start_at, end_at, is_open')
        .eq('school_year', sy)
        .maybeSingle();
      if (error) throw error;

      setWindowRow(data || null);

      const toInput = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        const pad = (n) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      };
      setWinStart(toInput(data?.start_at));
      setWinEnd(toInput(data?.end_at));
      setWinOpen(!!data?.is_open);
    } finally {
      setLoadingWindow(false);
    }
  };

  useEffect(() => {
    loadEnrollmentWindow();
  }, [schoolYear]);

  const openWindowModal = () => setShowWindowModal(true);
  const closeWindowModal = () => setShowWindowModal(false);

  // Create/Update window for this SY
  const saveEnrollmentWindow = async () => {
    const sy = normalizeSY(schoolYear);
    if (!winStart || !winEnd) throw new Error('Enrollment window is required'); // [attached_file:498]

    await ensureSchoolYearRow(sy); // make FK parent exist [attached_file:498]

    const payload = {
      school_year: sy,
      start_at: new Date(winStart).toISOString(),
      end_at: new Date(winEnd).toISOString(),
      is_open: !!winOpen,
    }; // [attached_file:498]

    const { error } = await supabase
      .from('enrollment_windows')
      .upsert(payload, { onConflict: 'school_year' }); // [attached_file:498]
    if (error) throw error; // [attached_file:498]

    await loadEnrollmentWindow(); // [attached_file:498]
  }; // keep modal open/closed logic in the callers so you can show confirms/success [attached_file:498]

  // One-click open/close for current SY
  // In Admin_Enrollment
  const setOpenClosed = async (nextOpen) => {
    const sy = normalizeSY(schoolYear);
    if (!windowRow) {
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { error: upErr } = await supabase.from('enrollment_windows').upsert(
        {
          school_year: sy,
          start_at: now.toISOString(),
          end_at: in7.toISOString(),
          is_open: !!nextOpen,
        },
        { onConflict: 'school_year' }
      );
      if (upErr) throw upErr;
    } else {
      // If opening and dates don’t cover now, bump them to cover now
      let patch = { is_open: !!nextOpen };
      if (nextOpen) {
        const now = Date.now();
        const s = windowRow.start_at ? Date.parse(windowRow.start_at) : 0;
        const e = windowRow.end_at ? Date.parse(windowRow.end_at) : 0;
        if (!(now >= s && now <= e)) {
          const start = new Date();
          const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          patch = {
            ...patch,
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          };
        }
      }
      const { error } = await supabase
        .from('enrollment_windows')
        .update(patch)
        .eq('school_year', sy);
      if (error) throw error;
    }
    await loadEnrollmentWindow();
  };

  const saveAndOpenNow = async () => {
    await saveEnrollmentWindow();
    await setOpenClosed(true);
  };

  const saveAndCloseNow = async () => {
    await saveEnrollmentWindow();
    await setOpenClosed(false);
  };

  // Stats
  const loadStats = async () => {
    setError('');
    try {
      const sy = normalizeSY(schoolYear);

      const { count: pend, error: ePend } = await supabase
        .from('enrollments')
        .select('enrollment_id', { count: 'exact', head: true })
        .eq('school_year', sy)
        .eq('status', 'pending');
      if (ePend) throw ePend;
      setPendingCount(pend || 0);

      const { count: resub, error: eResub } = await supabase
        .from('enrollments')
        .select('enrollment_id', { count: 'exact', head: true })
        .eq('school_year', sy)
        .eq('status', 'resubmit');
      if (eResub) throw eResub;
      setResubmitCount(resub || 0);

      const { count: enrolledCount, error: eEnr } = await supabase
        .from('enrollments')
        .select('enrollment_id', { count: 'exact', head: true })
        .eq('school_year', sy)
        .eq('status', 'approved');
      if (eEnr) throw eEnr;
      setTotalEnrolled(enrolledCount || 0);
    } catch {
      setError('Failed to load stats.');
    }
  };
  // Ask for confirmation from inside the modal
  const askConfirmOpen = () => {
    setWinAction('open');
    setShowWinConfirm(true);
  };
  const askConfirmClose = () => {
    setWinAction('close');
    setShowWinConfirm(true);
  };

  // Perform the chosen action after confirmation
  const doConfirmedOpenClose = async () => {
    if (!winAction) return;
    setWinConfirmBusy(true);
    try {
      // Always persist the window fields first
      await saveEnrollmentWindow();
      // Then toggle the status
      await setOpenClosed(winAction === 'open');
      // Close the settings modal and show success
      setShowWindowModal(false);
      setWinSuccessMsg(
        `Enrollment ${winAction === 'open' ? 'opened' : 'closed'} for ${normalizeSY(schoolYear)}.`
      );
      setShowWinSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setWinConfirmBusy(false);
      setShowWinConfirm(false);
      setWinAction(null);
    }
  };

  // Rows
  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const sy = normalizeSY(schoolYear);
      let q = supabase
        .from('enrollments')
        .select(
          'enrollment_id, applicant_id, school_year, grade_level, application_date, status, is_transferee'
        )
        .eq('school_year', sy);

      if (dateSort === 'Newest')
        q = q.order('application_date', { ascending: false });
      if (dateSort === 'Oldest')
        q = q.order('application_date', { ascending: true });

      const { data: enrollments, error: eEnr } = await q;
      if (eEnr) throw eEnr;

      if (!enrollments?.length) {
        setRows([]);
        setLoading(false);
        setDocsByStudent(new Map());
        setStudentByApplicant(new Map());
        return;
      }

      const filteredEnrollments = (enrollments || []).filter(
        (e) => e.status !== 'approved'
      );
      const appIds = filteredEnrollments.map((e) => e.applicant_id);

      const { data: apps, error: eApps } = await supabase
        .from('applicants')
        .select('applicant_id, user_id')
        .in('applicant_id', appIds);
      if (eApps) throw eApps;

      const { data: users, error: eUsers } = await supabase
        .from('users')
        .select('user_id, email, first_name, last_name, middle_name');
      if (eUsers) throw eUsers;
      const usersById = new Map((users || []).map((u) => [u.user_id, u]));

      const { data: students, error: eStud } = await supabase
        .from('students')
        .select('student_id, applicant_id, lrn, gender, last_name');
      if (eStud) throw eStud;
      const studentApplicantMap = new Map(
        (students || []).map((s) => [s.applicant_id, s])
      );
      setStudentByApplicant(studentApplicantMap);

      const { data: docs, error: eDocs } = await supabase
        .from('documents')
        .select('student_id, document_type, file_path');
      if (eDocs) throw eDocs;
      const docsMap = new Map();
      (docs || []).forEach((d) => {
        const arr = docsMap.get(d.student_id) || [];
        arr.push(d);
        docsMap.set(d.student_id, arr);
      });
      setDocsByStudent(docsMap);

      const built = filteredEnrollments.map((e) => {
        const app = (apps || []).find((a) => a.applicant_id === e.applicant_id);
        const user = app ? usersById.get(app.user_id) : null;
        const stud = studentApplicantMap.get(e.applicant_id);

        const studDocs = stud ? docsMap.get(stud.student_id) || [] : [];
        const hasPSA = studDocs.some(
          (d) => d.document_type === 'psa_birth_cert'
        );
        const hasCard = studDocs.some((d) => d.document_type === 'report_card');
        const hasSF10 = studDocs.some((d) => d.document_type === 'sf10');

        return {
          enrollment_id: e.enrollment_id,
          applicant_id: e.applicant_id,
          date: e.application_date ? new Date(e.application_date) : null,
          name: user
            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
            : `Applicant ${e.applicant_id}`,
          lrn: stud?.lrn || '—',
          gender: stud?.gender || '—',
          student_status: e.is_transferee ? 'Transferee' : 'New',
          grade_level: e.grade_level,
          hasPSA,
          hasCard,
          hasSF10,
          complete: hasPSA && hasCard && hasSF10,
          status: e.status || 'pending',
          email: user?.email || '',
        };
      });

      setRows(built);
    } catch {
      setError('Failed to load enrollment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [schoolYear]);

  useEffect(() => {
    loadRows();
  }, [schoolYear, dateSort]);

  // Selection helpers
  const toggleSelection = (applicant_id) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(applicant_id)) s.delete(applicant_id);
      else s.add(applicant_id);
      return s;
    });
  };

  const allSelected = useMemo(() => {
    const ids = rows
      .filter((r) => r.status === 'pending')
      .map((r) => r.applicant_id);
    if (!ids.length) return false;
    return ids.every((id) => selected.has(id));
  }, [rows, selected]);

  const toggleSelectAll = () => {
    const ids = rows
      .filter((r) => r.status === 'pending')
      .map((r) => r.applicant_id);
    setSelected((prev) => {
      const s = new Set(prev);
      if (allSelected) ids.forEach((id) => s.delete(id));
      else ids.forEach((id) => s.add(id));
      return s;
    });
  };

  // Visible rows + paging
  const visibleRows = useMemo(() => {
    let list = rows;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.lrn.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
      );
    }
    if (gradeFilter) list = list.filter((r) => r.grade_level === gradeFilter);
    if (genderFilter)
      list = list.filter(
        (r) => (r.gender || '').toLowerCase() === genderFilter.toLowerCase()
      );
    if (docCompleteOnly) list = list.filter((r) => r.complete);
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [
    rows,
    searchText,
    gradeFilter,
    genderFilter,
    docCompleteOnly,
    statusFilter,
  ]);

  const totalRows = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pageRows = visibleRows.slice(startIdx, endIdx);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const MAX_PAGES = 5;
  const getPageNumbers = () => {
    if (totalPages <= MAX_PAGES)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(MAX_PAGES / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + MAX_PAGES - 1);
    if (end - start + 1 < MAX_PAGES) start = Math.max(1, end - MAX_PAGES + 1);
    const pages = [];
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('…');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('…');
      pages.push(totalPages);
    }
    return pages;
  };

  const gotoPage = (n) => setPage(Math.min(Math.max(1, n), totalPages));
  const firstPage = () => gotoPage(1);
  const prevPage = () => gotoPage(page - 1);
  const nextPage = () => gotoPage(page + 1);
  const lastPage = () => gotoPage(totalPages);

  // Approvals
  const approveEnrollments = async (enrollmentIds) => {
    if (!enrollmentIds.length) return;
    setModalBusy(true);
    setError('');
    try {
      for (const enrollment_id of enrollmentIds) {
        const { data: enrollmentData, error: fetchErr } = await supabase
          .from('enrollments')
          .select('*')
          .eq('enrollment_id', enrollment_id)
          .single();
        if (fetchErr) throw fetchErr;

        const { data: applicantData, error: eApplicant } = await supabase
          .from('applicants')
          .select('*')
          .eq('applicant_id', enrollmentData.applicant_id)
          .single();
        if (eApplicant) throw eApplicant;

        const { data: userData, error: eUser } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', applicantData.user_id)
          .single();
        if (eUser) throw eUser;

        const { data: studentData, error: eStudent } = await supabase
          .from('students')
          .select('*')
          .eq('applicant_id', enrollmentData.applicant_id)
          .single();
        if (eStudent) throw eStudent;

        const { error: updEnrollErr } = await supabase
          .from('enrollments')
          .update({
            status: 'approved',
            adviser_approved: true,
            dept_head_approved: true,
            principal_approved: true,
          })
          .eq('enrollment_id', enrollment_id);
        if (updEnrollErr) throw updEnrollErr;

        const userUpdate = {
          role: 'student',
          password_hash: studentData.last_name,
        };
        const { error: updUserErr } = await supabase
          .from('users')
          .update(userUpdate)
          .eq('user_id', applicantData.user_id);
        if (updUserErr) throw updUserErr;

        const { error: updApplicantErr } = await supabase
          .from('users')
          .update({ applicant_id: studentData.lrn })
          .eq('user_id', applicantData.user_id);
        if (updApplicantErr) throw updApplicantErr;

        const templateParams = {
          to_name: `${userData.first_name} ${userData.last_name}`,
          to_email: userData.email,
          school_year: enrollmentData.school_year,
          grade_level: enrollmentData.grade_level,
          enrollment_id: enrollment_id,
          lrn: studentData.lrn || '',
          password: studentData.last_name || '',
        };

        try {
          await emailjs.send(
            'service_q1ngnvg',
            'template_hovzt9m',
            templateParams,
            'EXXWbe2NSHxvbalnb'
          );
        } catch (emailErr) {
          console.error('Email send error:', emailErr);
        }
      }

      setRows((prev) =>
        prev.map((r) =>
          enrollmentIds.includes(r.enrollment_id)
            ? { ...r, status: 'approved' }
            : r
        )
      );

      setSelected((prev) => {
        const s = new Set(prev);
        visibleRows.forEach((r) => {
          if (enrollmentIds.includes(r.enrollment_id)) s.delete(r.applicant_id);
        });
        return s;
      });

      setShowConfirmation(false);
      await loadStats();
      await loadRows();
    } catch (err) {
      setError(
        'Failed to approve enrollment(s): ' + (err.message || err.toString())
      );
    } finally {
      setModalBusy(false);
    }
  };

  const handleSingleAccept = (enrollment_id) => {
    setConfirmPayload({ type: 'single', ids: [enrollment_id] });
    setShowConfirmation(true);
  };

  const handleBulkAccept = () => {
    const toApprove = visibleRows
      .filter((r) => r.status === 'pending' && selected.has(r.applicant_id))
      .map((r) => r.enrollment_id);
    if (!toApprove.length) return;
    setConfirmPayload({ type: 'bulk', ids: toApprove });
    setShowConfirmation(true);
  };

  const onConfirm = () => approveEnrollments(confirmPayload.ids);

  function getPublicUrl(file_path) {
    const { data } = supabase.storage
      .from('enrollment-uploads')
      .getPublicUrl(file_path);
    return data.publicUrl;
  }

  const choiceCopy = (choice) => {
    if (choice === 'refer') {
      return `Thank you for your application. At this time, all available slots for your chosen grade level are full. We kindly advise you to consider applying to other nearby schools. We appreciate your interest and wish you the best in your enrollment journey.`;
    }
    return `Thank you for your submission. Some of your uploaded documents are unclear or incomplete. Please resubmit clear copies (e.g., PSA Birth Certificate, Report Card, and SF10) so we can proceed with your application. If you need assistance, please reply to this email.`;
  };

  const openNotify = (row) => {
    setNotifyRow(row);
    setNotifyChoice('refer');
    setNotifyNotes('');
    setNotifyOpen(true);
  };
  const closeNotify = () => {
    setNotifyOpen(false);
    setNotifyRow(null);
    setNotifyNotes('');
  };

  // Email notify (returns boolean)
  const actuallySendNotification = async () => {
    if (!notifyRow) return false;
    setNotifyBusy(true);
    setError('');
    try {
      const paramsBase = {
        to_name: notifyRow.name || 'Applicant',
        to_email: notifyRow.email,
        school_year: schoolYear,
        grade_level: notifyRow.grade_level,
        email_title: 'Enrollment Notice',
        year: new Date().getFullYear(),
        optional_note: (notifyNotes || '').trim(),
      };

      const VARIANTS = {
        refer: {
          header_subtitle: 'Enrollment Update',
          intro_text: `Thank you for your interest in enrolling for the ${schoolYear} school year.`,
          notice_text:
            'We regret to inform you that all available slots are currently filled.',
          body_text_1:
            'We encourage you to apply to other schools in your area to ensure your continued learning this year.',
          body_text_2: 'Thank you for your time and understanding.',
        },
        resubmit: {
          header_subtitle: 'Enrollment Clarification Required',
          intro_text: `We reviewed your application for the ${schoolYear} school year, but some submitted documents were unclear or incomplete.`,
          notice_text:
            'Please review your documents and resubmit the required files for verification.',
          body_text_1:
            'Once you have uploaded the corrected documents, our team will process your application as soon as possible.',
          body_text_2:
            'If you need guidance, please refer to the enrollment portal or contact our support team.',
        },
      };

      const variant = VARIANTS[notifyChoice] || VARIANTS.refer;

      await emailjs.send(
        'service_q1ngnvg',
        'template_xra0h2d',
        { ...paramsBase, ...variant },
        'EXXWbe2NSHxvbalnb'
      );

      try {
        await supabase.from('enrollment_notifications').insert({
          enrollment_id: notifyRow.enrollment_id,
          applicant_id: notifyRow.applicant_id,
          school_year: normalizeSY(schoolYear),
          reason: notifyChoice,
          notes: notifyNotes?.trim() || null,
          recipient_email: notifyRow.email,
          sent_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn(
          'Log notify error (non-fatal):',
          logErr?.message || logErr
        );
      }

      closeNotify();
      return true;
    } catch (err) {
      console.error(err);
      setError('Failed to send notification: ' + (err?.message || String(err)));
      return false;
    } finally {
      setNotifyBusy(false);
    }
  };

  // Mark for resubmission
  const markEnrollmentForResubmit = async () => {
    if (!notifyRow?.enrollment_id) return;
    try {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'resubmit' })
        .eq('enrollment_id', notifyRow.enrollment_id);
      if (error) console.warn('Status update failed:', error.message);

      setRows((prev) =>
        prev.map((r) =>
          r.enrollment_id === notifyRow.enrollment_id
            ? { ...r, status: 'resubmit' }
            : r
        )
      );
      await loadStats();
    } catch (e) {
      console.warn('Resubmit status error:', e?.message || String(e));
    }
  }; // helpers — place near other helpers
  const parseSY = (syStr) => {
    // '2025-2026' -> { y1: 2025, y2: 2026 }
    const m = String(syStr || '').match(/^(\d{4})-(\d{4})$/);
    if (!m) return null;
    return { y1: parseInt(m[1], 10), y2: parseInt(m[2], 10) };
  }; // [attached_file:498]

  const ensureSchoolYearRow = async (syStr) => {
    // enrollment_windows has FK to school_years, so ensure it exists before window upsert
    const sy = normalizeSY(syStr);
    const yrs = parseSY(sy);
    if (!yrs) throw new Error('Invalid School Year format'); // [attached_file:498]
    // pick a conventional SY span (adjust if your school uses different dates)
    const sy_start = new Date(Date.UTC(yrs.y1, 6, 1))
      .toISOString()
      .slice(0, 10); // Jul 1 YYYY [attached_file:498]
    const sy_end = new Date(Date.UTC(yrs.y2, 5, 30)).toISOString().slice(0, 10); // Jun 30 YYYY+1 [attached_file:498]
    // Try reading first; if missing, insert
    const { data: existing, error: readErr } = await supabase
      .from('school_years')
      .select('school_year')
      .eq('school_year', sy)
      .maybeSingle(); // [attached_file:498]
    if (readErr) throw readErr; // [attached_file:498]
    if (!existing) {
      const { error: upErr } = await supabase
        .from('school_years')
        .upsert(
          { school_year: sy, sy_start, sy_end, is_active: false },
          { onConflict: 'school_year' }
        ); // [attached_file:498]
      if (upErr) throw upErr; // [attached_file:498]
    }
  }; // [attached_file:498]

  // Confirm -> send -> update status if needed -> show success
  const confirmAndSendNotification = async () => {
    setNotifyConfirmBusy(true);
    const ok = await actuallySendNotification();
    setNotifyConfirmBusy(false);
    setShowNotifyConfirm(false);

    if (ok && notifyChoice === 'resubmit') {
      await markEnrollmentForResubmit();
    }
    if (ok) {
      setShowNotifySuccess(true);
      await loadRows();
    }
  };
  return (
    <>
      <LoadingPopup
        show={loading}
        message="Loading Please Wait..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" activeSection="enrollment" />

      {/* Existing approval confirmation */}
      {showConfirmation && (
        <Confirmation_Modal
          show={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={onConfirm}
          busy={modalBusy}
          title={
            confirmPayload.type === 'bulk'
              ? 'Approve selected applications?'
              : 'Approve this application?'
          }
          description="This will mark the enrollment(s) as approved and set adviser/dept/principal flags."
        />
      )}

      <ImageModal
        isOpen={!!modalImage}
        imageUrl={modalImage}
        onClose={() => setModalImage(null)}
      />

      <div className="admin-enrollment-container">
        <div className="stats-container">
          <div className="stat-card">
            <h2>{pendingCount}</h2>
            <p className="cardPending">Pending Applications</p>
          </div>
          <div className="stat-card">
            <h2>{totalEnrolled}</h2>
            <p className="cardEnrolled">Total Enrolled Students</p>
          </div>
          <div className="enrollment-stat-card">
            <h2 style={{ color: windowRow?.is_open ? '#16a34a' : '#ef4444' }}>
              {loadingWindow ? '…' : windowRow?.is_open ? 'OPEN' : 'CLOSED'}
            </h2>
            <p>Enrollment Status</p>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <button onClick={openWindowModal}>Open Enrollment</button>
              <button
                onClick={() => setOpenClosed(!windowRow?.is_open)}
                disabled={loadingWindow || !windowRow}
                style={{
                  backgroundColor: windowRow?.is_open ? '#ef4444' : '#16a34a',
                }}
              >
                {windowRow?.is_open ? 'Close Now' : 'Open Now'}
              </button>
            </div>
          </div>
        </div>

        <div className="sort" style={{ marginBottom: 12 }}>
          <label style={{ marginRight: 8 }}>School Year</label>
          <select
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
          >
            <option>2024-2025</option>
            <option>2025-2026</option>
            <option>2026-2027s</option>
          </select>
        </div>

        <div className="enrollmentFilter">
          <div className="search-bar">
            <i className="fa fa-search"></i>
            <input
              type="text"
              placeholder="Search by name, LRN, or email..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="enrollmentFilters">
            <div className="sort">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="resubmit">Resubmit</option>
              </select>
            </div>
            <div className="sort">
              <label>Application Date</label>
              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
              >
                <option>Newest</option>
                <option>Oldest</option>
              </select>
            </div>
            <div className="sort">
              <label>Select Grade Level</label>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="">Grade</option>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="sort">
              <label>Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-controls">
          <div className="left-controls">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
            />{' '}
            <span>Select All</span>
            <span className="doc-completeness">Document Completeness</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={docCompleteOnly}
                onChange={(e) => setDocCompleteOnly(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <button
            className="bulk-accept"
            onClick={handleBulkAccept}
            disabled={
              visibleRows.filter(
                (r) => r.status === 'pending' && selected.has(r.applicant_id)
              ).length === 0
            }
          >
            Bulk Accept
          </button>
        </div>

        <div className="table-container">
          <table className="enrollment-table">
            <thead>
              <tr>
                <th className="column1"></th>
                <th className="column2" scope="col">
                  #
                </th>
                <th scope="col">Application Date</th>
                <th scope="col">Name</th>
                <th scope="col">LRN</th>
                <th scope="col">Student Status</th>
                <th scope="col">Grade Level</th>
                <th scope="col">PSA / Birthcert</th>
                <th scope="col">Report Card</th>
                <th scope="col">SF10</th>
                <th scope="col">Status</th>
                <th className="column3" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12}>Loading...</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12}>No records found.</td>
                </tr>
              ) : (
                pageRows.map((r, index) => (
                  <tr key={r.enrollment_id}>
                    <td className="column1">
                      {r.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.applicant_id)}
                          onChange={() => toggleSelection(r.applicant_id)}
                        />
                      )}
                    </td>
                    <td className="column2">{index + 1}</td>
                    <td>
                      {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                    </td>
                    <td>{r.name}</td>
                    <td>{r.lrn}</td>
                    <td>{r.student_status}</td>
                    <td>{r.grade_level}</td>

                    {/* PSA / Birth Certificate */}
                    <td>
                      {r.hasPSA
                        ? (() => {
                            const studId = studentByApplicant.get(
                              r.applicant_id
                            )?.student_id;
                            const docsArr = docsByStudent.get(studId) || [];
                            const doc = docsArr.find(
                              (d) => d.document_type === 'psa_birth_cert'
                            );
                            if (!doc) return '—';
                            const url = getPublicUrl(doc.file_path);
                            return (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setModalImage(url);
                                }}
                              >
                                view
                              </a>
                            );
                          })()
                        : '—'}
                    </td>

                    {/* Report Card */}
                    <td>
                      {r.hasCard
                        ? (() => {
                            const studId = studentByApplicant.get(
                              r.applicant_id
                            )?.student_id;
                            const docsArr = docsByStudent.get(studId) || [];
                            const doc = docsArr.find(
                              (d) => d.document_type === 'report_card'
                            );
                            if (!doc) return '—';
                            const url = getPublicUrl(doc.file_path);
                            return (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setModalImage(url);
                                }}
                              >
                                view
                              </a>
                            );
                          })()
                        : '—'}
                    </td>

                    {/* SF10 */}
                    <td>
                      {r.hasSF10
                        ? (() => {
                            const studId = studentByApplicant.get(
                              r.applicant_id
                            )?.student_id;
                            const docsArr = docsByStudent.get(studId) || [];
                            const doc = docsArr.find(
                              (d) => d.document_type === 'sf10'
                            );
                            if (!doc) return '—';
                            const url = getPublicUrl(doc.file_path);
                            return (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setModalImage(url);
                                }}
                              >
                                view
                              </a>
                            );
                          })()
                        : '—'}
                    </td>

                    <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                    <td className="column3">
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="accept-btn"
                            onClick={() => {
                              setConfirmPayload({
                                type: 'single',
                                ids: [r.enrollment_id],
                              });
                              setShowConfirmation(true);
                            }}
                          >
                            Accept
                          </button>
                          <button
                            className="notify-btn"
                            onClick={() => openNotify(r)}
                            title="Send a notification to the applicant"
                          >
                            Notify
                          </button>
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <div className="pager-left">
            <label className="pager-label">Rows per page</label>
            <select
              className="pager-size"
              value={pageSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setPageSize(newSize);
                setPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="pager-info">
            {totalRows === 0
              ? 'Showing 0 of 0'
              : `Showing ${startIdx + 1}–${endIdx} of ${totalRows}`}
          </div>

          <div className="pager-right">
            <button
              className="pager-btn"
              onClick={firstPage}
              disabled={page === 1}
              aria-label="First page"
            >
              <ion-icon name="play-back-outline"></ion-icon>
            </button>

            <button
              className="pager-btn"
              onClick={prevPage}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>

            {getPageNumbers().map((pkey, idx) =>
              pkey === '…' ? (
                <span key={`ellipsis-${idx}`} className="pager-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={pkey}
                  className={`pager-page ${page === pkey ? 'active' : ''}`}
                  onClick={() => gotoPage(pkey)}
                  aria-current={page === pkey ? 'page' : undefined}
                >
                  {pkey}
                </button>
              )
            )}

            <button
              className="pager-btn"
              onClick={nextPage}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </button>

            <button
              className="pager-btn"
              onClick={lastPage}
              disabled={page === totalPages}
              aria-label="Last page"
            >
              <ion-icon name="play-forward-outline"></ion-icon>
            </button>
          </div>
        </div>
      </div>
      {/* Enrollment Settings modal (year-only + open/close inside) */}
      {showWindowModal && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 520 }}
          >
            <h3 style={{ margin: 0 }}>
              Enrollment Settings ({normalizeSY(schoolYear)})
            </h3>

            {/* School Year (year-only, e.g., 2025-2026) */}
            <div
              className="sort"
              style={{ marginTop: 12, display: 'grid', gap: 12 }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span>School Year</span>
                <select
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                >
                  {makeSyOptions().map((sy) => (
                    <option key={sy} value={sy}>
                      {sy}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Enrollment Window for selected year */}
            <div
              className="sort"
              style={{ marginTop: 12, display: 'grid', gap: 12 }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Enrollment Start</span>
                <input
                  className="calendar"
                  type="datetime-local"
                  value={winStart}
                  onChange={(e) => setWinStart(e.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Enrollment End</span>
                <input
                  className="calendar"
                  type="datetime-local"
                  value={winEnd}
                  onChange={(e) => setWinEnd(e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={winOpen}
                  onChange={(e) => setWinOpen(e.target.checked)}
                />
                <span>Mark enrollment as Open</span>
              </label>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Current status:{' '}
                {loadingWindow ? '…' : windowRow?.is_open ? 'OPEN' : 'CLOSED'}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                style={{
                  border: '1px solid black',
                  color: 'black',
                  backgroundColor: '#fff',
                }}
                onClick={closeWindowModal}
              >
                Cancel
              </button>

              {/* Save + Open now */}
              <button
                onClick={async () => {
                  try {
                    await saveEnrollmentWindow();
                    await setOpenClosed(true);
                    setShowWindowModal(false);
                    setWinSuccessMsg(
                      `Enrollment opened for ${normalizeSY(schoolYear)}.`
                    );
                    setShowWinSuccess(true);
                  } catch (e) {
                    console.error(e);
                    setError(e?.message || String(e));
                  }
                }}
                style={{ backgroundColor: '#16a34a', color: '#fff' }}
                disabled={!winStart || !winEnd}
                title="Save window and open enrollment now"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      <Confirmation_Modal
        show={showWinConfirm}
        onClose={() => {
          setShowWinConfirm(false);
          setWinAction(null);
        }}
        onConfirm={doConfirmedOpenClose}
        busy={winConfirmBusy}
        title={
          winAction === 'open'
            ? 'Open enrollment now?'
            : 'Close enrollment now?'
        }
        description={
          winAction === 'open'
            ? `This will mark ${normalizeSY(schoolYear)} as OPEN and allow approvals during the configured window.`
            : `This will mark ${normalizeSY(schoolYear)} as CLOSED and block approvals until reopened.`
        }
      />

      {/* Step 1: collect details */}
      <NotifyModal
        open={notifyOpen}
        row={notifyRow}
        choice={notifyChoice}
        notes={notifyNotes}
        setChoice={setNotifyChoice}
        setNotes={setNotifyNotes}
        busy={notifyBusy}
        onClose={closeNotify}
        onContinue={() => setShowNotifyConfirm(true)}
      />

      {/* Step 2: confirm */}
      <Confirmation_Modal
        show={showNotifyConfirm}
        onClose={() => setShowNotifyConfirm(false)}
        onConfirm={confirmAndSendNotification}
        busy={notifyConfirmBusy}
        title="Send this notification?"
        description={
          notifyRow
            ? `Send a "${notifyChoice === 'refer' ? 'Refer to other school' : 'Resubmit documents'}" email to ${notifyRow.name} (${notifyRow.email}) for ${notifyRow.grade_level}?`
            : 'Send this notification now?'
        }
      />

      {/* Step 3: success */}
      <EnrollmentSuccessModal
        show={showNotifySuccess}
        onClose={() => setShowNotifySuccess(false)}
        message="Notification sent successfully."
      />
    </>
  );
};
