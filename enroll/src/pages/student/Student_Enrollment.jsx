// src/pages/student/Student_Enrollment.jsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Enrollment_Container } from '../../components/containers/Enrollment_Container';
import EnrollmentSuccessModal from '../../components/modals/EnrollmentSuccessModal';
import './student_enrollment.css';
import { supabase } from '../../supabaseClient';

// Helpers
const normalizeSY = (s) =>
  String(s || '')
    .replace(/[–—−]/g, '-')
    .trim();
const parseStartYear = (sy) => {
  const m = String(sy || '').match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : NaN;
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const STORAGE_BUCKET =
  import.meta.env.VITE_STORAGE_BUCKET || 'enrollment-uploads';

export const Student_Enrollment = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Step routing
  const isStep2Path = location.pathname.endsWith('/step-2');
  const [enrollmentStep, setEnrollmentStep] = useState(isStep2Path ? 2 : 1);
  useEffect(() => setEnrollmentStep(isStep2Path ? 2 : 1), [isStep2Path]);

  // UI
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busySubmit, setBusySubmit] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const MAX_SIZE_MB = 10;

  // Identity
  const [studentId, setStudentId] = useState(null);
  const [applicantId, setApplicantId] = useState(null);

  // Display
  const [lrn, setLrn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [nextGrade, setNextGrade] = useState('');

  // Acknowledgements
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [agreeAccept, setAgreeAccept] = useState(false);

  // Doc selection
  const [iD, setId] = useState('');

  // Report Card
  const [reportFile, setReportFile] = useState(null);
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('');
  const [reportPreview, setReportPreview] = useState('');
  const [reportErr, setReportErr] = useState('');

  // Government ID
  const [govFile, setGovFile] = useState(null);
  const [govName, setGovName] = useState('');
  const [govType, setGovType] = useState('');
  const [govPreview, setGovPreview] = useState('');
  const [govErr, setGovErr] = useState('');

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (reportPreview) URL.revokeObjectURL(reportPreview);
      if (govPreview) URL.revokeObjectURL(govPreview);
    };
  }, [reportPreview, govPreview]);

  // Validate and preview
  const validateAndPreview = (
    file,
    setFile,
    setName,
    setType,
    setPreview,
    setFieldErr
  ) => {
    if (!file) {
      setFile(null);
      setName('');
      setType('');
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return '';
      });
      setFieldErr('');
      return;
    }
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('video/')) {
      setFile(null);
      setName('');
      setType('');
      setFieldErr(
        'Invalid file: videos are not allowed. Only PDF, JPG, and PNG are accepted.'
      );
      return;
    }
    if (!ALLOWED_TYPES.includes(type)) {
      setFile(null);
      setName('');
      setType('');
      setFieldErr('Invalid file type. Allowed: PDF, JPG, PNG.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFile(null);
      setName('');
      setType('');
      setFieldErr(`Max file size is ${MAX_SIZE_MB}MB.`);
      return;
    }
    setFieldErr('');
    setFile(file);
    setName(file.name);
    setType(type);
    const url = URL.createObjectURL(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  };

  const onReportChange = (e) => {
    const f = e.target.files?.[0];
    validateAndPreview(
      f,
      setReportFile,
      setReportName,
      setReportType,
      setReportPreview,
      setReportErr
    );
  };
  const onGovChange = (e) => {
    const f = e.target.files?.[0];
    validateAndPreview(
      f,
      setGovFile,
      setGovName,
      setGovType,
      setGovPreview,
      setGovErr
    );
  };

  const clearReport = () => {
    setReportFile(null);
    setReportName('');
    setReportType('');
    setReportErr('');
    setReportPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return '';
    });
    const input = document.getElementById('reportUpload');
    if (input) input.value = '';
  };
  const clearGov = () => {
    setGovFile(null);
    setGovName('');
    setGovType('');
    setGovErr('');
    setGovPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return '';
    });
    const input = document.getElementById('govFileUpload');
    if (input) input.value = '';
  };

  // Load student and compute next grade
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr('');
      try {
        const targetSY = normalizeSY(location.state?.school_year || '');
        setSchoolYear(targetSY || '');

        const userId = localStorage.getItem('user_id');
        if (!userId) {
          setErr('Missing user session.');
          setLoading(false);
          return;
        }

        const { data: s, error: sErr } = await supabase
          .from('students')
          .select(
            'student_id, applicant_id, lrn, first_name, middle_name, last_name, suffix'
          )
          .eq('user_id', userId)
          .maybeSingle();
        if (sErr) throw sErr;
        if (!s?.student_id) {
          setErr('Student profile not found.');
          setLoading(false);
          return;
        }

        setStudentId(s.student_id);
        setApplicantId(s.applicant_id || null);
        setLrn(s.lrn || '');
        setFirstName(s.first_name || '');
        setMiddleName(s.middle_name || '');
        setLastName(s.last_name || '');
        setSuffix(s.suffix || '');

        const { data: rows, error: secErr } = await supabase
          .from('student_sections')
          .select('school_year, section:sections(grade_level)')
          .eq('student_id', s.student_id)
          .order('school_year', { ascending: false })
          .limit(1);
        if (secErr) throw secErr;

        const latest = rows?.[0] || null;
        const baseGrade = Number(latest?.section?.grade_level) || NaN;
        const currentStart = parseStartYear(latest?.school_year);
        const targetStart = parseStartYear(targetSY);

        let next = '';
        if (Number.isFinite(baseGrade)) {
          if (!Number.isNaN(currentStart) && !Number.isNaN(targetStart)) {
            const delta = Math.max(0, targetStart - currentStart);
            next = String(Math.min(10, baseGrade + delta));
          } else {
            next = String(Math.min(10, baseGrade + 1));
          }
        }
        setNextGrade(next);
      } catch (e) {
        console.error(e);
        setErr(e?.message || 'Failed to load student data.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [location.state?.school_year]);

  // Step navigation
  const goNext = () =>
    navigate('/Student_Enrollment/step-2', {
      state: { school_year: schoolYear },
    });
  const goBack = () =>
    navigate('/Student_Enrollment', { state: { school_year: schoolYear } });

  // Submit
  const canSubmitStep2 =
    !!iD && !!govFile && !govErr && agreePolicy && agreeAccept;

  const handleSubmit = async () => {
    try {
      setSubmitErr('');
      if (!canSubmitStep2) {
        setSubmitErr(
          !iD
            ? 'Please select a Government ID type.'
            : !govFile
              ? 'Please upload a valid Government ID (PDF/JPG/PNG).'
              : !agreePolicy || !agreeAccept
                ? 'Please check both acknowledgement boxes.'
                : 'Please complete all required fields.'
        );
        return;
      }
      if (!studentId) {
        setSubmitErr('Missing student profile.');
        return;
      }
      if (!schoolYear) {
        setSubmitErr('Missing target School Year.');
        return;
      }

      setBusySubmit(true);

      // Uploads
      const bucket = STORAGE_BUCKET;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const basePath = `${studentId}/${schoolYear}`;

      let reportPath = '';
      if (reportFile) {
        reportPath = `${basePath}/report-${ts}-${reportFile.name}`;
        const { error: up1Err } = await supabase.storage
          .from(bucket)
          .upload(reportPath, reportFile, {
            contentType: reportType || reportFile.type,
            upsert: true,
          });
        if (up1Err?.message?.includes('Bucket not found'))
          throw new Error(
            `Storage bucket "${bucket}" not found. Contact the registrar.`
          );
        if (up1Err) throw up1Err;
      }

      let govPath = '';
      if (govFile) {
        govPath = `${basePath}/gov-${ts}-${govFile.name}`;
        const { error: up2Err } = await supabase.storage
          .from(bucket)
          .upload(govPath, govFile, {
            contentType: govType || govFile.type,
            upsert: true,
          });
        if (up2Err?.message?.includes('Bucket not found'))
          throw new Error(
            `Storage bucket "${bucket}" not found. Contact the registrar.`
          );
        if (up2Err) throw up2Err;
      }

      // Persist file refs
      if (reportPath) {
        const { error: docErr } = await supabase.from('documents').insert({
          student_id: studentId,
          document_type: 'report_card',
          file_path: reportPath,
        });
        if (docErr) throw docErr;
      }

      if (applicantId) {
        const { error: appErr } = await supabase
          .from('applicants')
          .update({ government_id: iD, government_id_file: govPath || null })
          .eq('applicant_id', applicantId);
        if (appErr) throw appErr;
      }

      // Insert enrollment (valid columns only)
      const payload = {
        applicant_id: applicantId,
        school_year: schoolYear,
        grade_level: String(nextGrade || ''),
        application_date: new Date().toISOString(),
        status: 'pending',
        confirmed_by_guardian: true,
      };
      const { error: insErr } = await supabase
        .from('enrollments')
        .insert(payload);
      if (insErr) throw insErr;

      // Success
      clearReport();
      clearGov();
      setShowSuccess(true);
    } catch (e) {
      console.error(e);
      setSubmitErr(e?.message || 'Failed to submit enrollment.');
    } finally {
      setBusySubmit(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate('/Student_Homepage');
  };

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />
      <div className="studentEnrollmentContainer">
        <div className="pageTitle">
          {enrollmentStep === 1 ? (
            <Link to="/Student_Homepage">
              <i className="fa fa-chevron-left" aria-hidden="true" />
            </Link>
          ) : (
            <button className="btn-ghost" onClick={goBack} aria-label="Back">
              <i className="fa fa-chevron-left" aria-hidden="true" />
            </button>
          )}
          <h2>Enrollment Form</h2>
        </div>

        <div className="enrollmentArea">
          <Enrollment_Container>
            {enrollmentStep === 1 && (
              <div className="studentInfoContainer">
                <h1>Student Information</h1>
                {!!err && (
                  <p style={{ color: '#b91c1c', marginBottom: 8 }}>{err}</p>
                )}

                <div className="studentInfo">
                  <div className="studentDataInfos">
                    <div className="student_Data">
                      <label>LRN</label>
                      <input value={lrn} disabled />
                    </div>
                    <div className="student_Data">
                      <label>Incoming Grade</label>
                      <input
                        value={nextGrade ? `Grade ${nextGrade}` : ''}
                        placeholder={loading ? 'Loading…' : ''}
                        disabled
                      />
                    </div>
                    <div className="student_Data">
                      <label>School Year</label>
                      <input
                        value={schoolYear}
                        placeholder={loading ? 'Loading…' : ''}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="studentDataInfos">
                    <div className="student_Data">
                      <label>Last Name</label>
                      <input value={lastName} disabled />
                    </div>
                    <div className="student_Data">
                      <label>First Name</label>
                      <input value={firstName} disabled />
                    </div>
                    <div className="student_Data">
                      <label>Middle Name</label>
                      <input value={middleName} disabled />
                    </div>
                    <div className="student_Data">
                      <label>Suffix</label>
                      <input
                        type="text"
                        className="suffix"
                        value={suffix}
                        disabled
                      />
                    </div>
                  </div>

                  {/* Report Card upload */}
                  <div className="studentDocs">
                    <div className="cardUpload">
                      <div className="document_Label">
                        <label>Report Card:</label>
                      </div>
                      <div
                        className="document_Upload_Button"
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <input
                          type="file"
                          id="reportUpload"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={onReportChange}
                          hidden
                        />
                        <label
                          htmlFor="reportUpload"
                          className="upload-btn-Card"
                        >
                          Upload File
                        </label>
                        {reportName && (
                          <span style={{ fontSize: 13, color: '#334155' }}>
                            {reportName}
                          </span>
                        )}
                        {reportName && (
                          <button
                            type="button"
                            onClick={clearReport}
                            className="btn-ghost"
                            style={{ fontSize: 12 }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {!!reportErr && (
                        <div
                          style={{
                            color: '#b91c1c',
                            fontSize: 12,
                            marginTop: 6,
                          }}
                        >
                          {reportErr}
                        </div>
                      )}
                      {reportPreview && (
                        <div style={{ marginTop: 10 }}>
                          {reportType === 'application/pdf' ? (
                            <embed
                              src={reportPreview}
                              type="application/pdf"
                              width="100%"
                              height="220"
                            />
                          ) : (
                            <img
                              src={reportPreview}
                              alt="Report card preview"
                              style={{
                                maxWidth: '100%',
                                height: 180,
                                objectFit: 'contain',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="buttons_Container">
                  <div className="buttons">
                    <button
                      onClick={goNext}
                      disabled={loading}
                      title={loading ? 'Loading student data…' : ''}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {enrollmentStep === 2 && (
              <div className="agreementContainer">
                <div className="agreement">
                  <p>
                    As the parent/guardian of the above-named student, I hereby
                    acknowledge and agree to the following:
                  </p>
                </div>

                <p>
                  <strong>Acknowledgement</strong>
                </p>
                <div className="acknowledge_Infos">
                  <div className="acknowledge_Info">
                    <input
                      id="ack-policy"
                      type="checkbox"
                      checked={agreePolicy}
                      onChange={(e) => setAgreePolicy(e.target.checked)}
                      required
                    />
                    <label htmlFor="ack-policy">
                      I have read, understood, and agreed to abide by the
                      policies, rules, and regulations of the school.
                    </label>
                  </div>
                  <div className="acknowledge_Info">
                    <input
                      id="ack-accept"
                      type="checkbox"
                      checked={agreeAccept}
                      onChange={(e) => setAgreeAccept(e.target.checked)}
                      required
                    />
                    <label htmlFor="ack-accept">
                      I understand that enrollment signifies acceptance of this
                      agreement.
                    </label>
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: '17px' }}>
                    Please upload a valid Government-issued ID to continue.
                  </p>
                </div>

                {/* Government ID upload */}
                <div className="upload_ID">
                  <div className="id_Select">
                    <label htmlFor="gov-id-type">Government ID</label>
                    <select
                      id="gov-id-type"
                      value={iD}
                      onChange={(e) => setId(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select ID
                      </option>
                      <option>Passport</option>
                      <option>National ID</option>
                      <option>Voter's ID</option>
                      <option>UMID</option>
                    </select>
                  </div>

                  <div className="government_ID_Upload">
                    <input
                      type="file"
                      id="govFileUpload"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={onGovChange}
                      hidden
                    />
                    <label
                      htmlFor="govFileUpload"
                      className="upload-btn-Gov-ID"
                    >
                      Upload File
                    </label>

                    {govName && (
                      <div
                        style={{ fontSize: 13, color: '#334155', marginTop: 6 }}
                      >
                        {govName}
                      </div>
                    )}
                    {!!govErr && (
                      <div
                        role="alert"
                        style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}
                      >
                        {govErr}
                      </div>
                    )}

                    {govPreview && (
                      <div style={{ marginTop: 10 }}>
                        {govType === 'application/pdf' ? (
                          <embed
                            src={govPreview}
                            type="application/pdf"
                            width="100%"
                            height="220"
                          />
                        ) : (
                          <img
                            src={govPreview}
                            alt="Government ID preview"
                            style={{
                              maxWidth: '100%',
                              height: 180,
                              objectFit: 'contain',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                            }}
                          />
                        )}
                      </div>
                    )}
                    {govName && (
                      <button
                        type="button"
                        onClick={clearGov}
                        className="btn-ghost"
                        style={{ fontSize: 12, marginTop: 8 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {!!submitErr && (
                  <div
                    role="alert"
                    style={{ color: '#b91c1c', fontSize: 12, marginTop: 10 }}
                  >
                    {submitErr}
                  </div>
                )}

                <div className="buttons_Container">
                  <div className="buttons">
                    <button onClick={goBack}>Back</button>
                    <button
                      onClick={handleSubmit}
                      disabled={busySubmit || !canSubmitStep2}
                      title={
                        busySubmit
                          ? 'Submitting…'
                          : !canSubmitStep2
                            ? !iD
                              ? 'Select a Government ID type.'
                              : !govFile
                                ? 'Upload a valid ID file (PDF/JPG/PNG).'
                                : !agreePolicy || !agreeAccept
                                  ? 'Acknowledge both statements.'
                                  : 'Complete all requirements.'
                            : ''
                      }
                    >
                      {busySubmit ? 'Submitting…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Enrollment_Container>
        </div>
      </div>

      {/* Success modal: OK routes home */}
      <EnrollmentSuccessModal
        open={showSuccess}
        title="Enrollment submitted"
        message="Your enrollment has been submitted successfully. You will be notified once it’s reviewed."
        onOk={handleSuccessClose}
        onContinue={handleSuccessClose}
        onClose={handleSuccessClose}
      />
    </>
  );
};
