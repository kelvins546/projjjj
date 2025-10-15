import './enrollment.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Confirmation_Modal } from '../../components/modals/Confirmation_Modal';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import emailjs from 'emailjs-com';
import { ImageModal } from '../../components/modals/ImageModal';

const GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const normalizeSY = (s) => (s || '').replace(/[–—−]/g, '-').trim();

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
    return list;
  }, [rows, searchText, gradeFilter, genderFilter, docCompleteOnly]);

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
          lrn: studentData.lrn || '', // ADDED: Student ID for template {{lrn}}
          password: studentData.last_name || '', // ADDED: Password for template {{password}}
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

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" activeSection="enrollment" />

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
            <p>Pending Applications</p>
          </div>
          <div className="stat-card">
            <h2>{totalEnrolled}</h2>
            <p>Total Enrolled Students</p>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ marginRight: 8 }}>School Year</label>
          <select
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
          >
            <option>2024-2025</option>
            <option>2025-2026</option>
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
            <div className="filter">
              <label>Application Date</label>
              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
              >
                <option>Newest</option>
                <option>Oldest</option>
              </select>
            </div>
            <div className="filter">
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
            <div className="filter">
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
                <th></th>
                <th scope="col">#</th>
                <th scope="col">Application Date</th>
                <th scope="col">Name</th>
                <th scope="col">LRN</th>
                <th scope="col">Student Status</th>
                <th scope="col">Grade Level</th>
                <th scope="col">PSA/Birthcert</th>
                <th scope="col">Report Card</th>
                <th scope="col">SF10</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
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
                    <td>
                      {r.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.applicant_id)}
                          onChange={() => toggleSelection(r.applicant_id)}
                        />
                      )}
                    </td>
                    <td>{index + 1}</td>
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
                    <td>
                      {r.status === 'pending' ? (
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
    </>
  );
};
