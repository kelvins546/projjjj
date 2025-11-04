import './enrollment_form.css';
import { Enrollment_Container } from '../containers/Enrollment_Container';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import EnrollmentSuccessModal from '../modals/EnrollmentSuccessModal';
import { DateTime } from 'luxon';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../loaders/LoadingPopup';

/* ===== Validators & preview helpers ===== */

// Allowed types and size (10 MB)
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;

// Image detector (robust to empty/unknown MIME)
const isImage = (f) =>
  !!f &&
  ((f.type && f.type.startsWith('image/')) ||
    /\.(jpe?g|png)$/i.test(f.name || ''));

// Tiny hook to manage blob URLs safely
const useObjectUrl = (file) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
};

// Normalize any date-like value for <input type="date" />
const toInputDate = (v) => {
  if (!v) return '';
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s)
    ? s.slice(0, 10)
    : new Date(v).toISOString().slice(0, 10);
};

// Storage: upload a file (throw on error so try/catch shows alert)
async function uploadDocumentFile(file, student_id, document_type) {
  if (!file) return null; // guard [web:202]
  const fileExt = (file.name || 'file').split('.').pop();
  const fileName = `${student_id}_${document_type}_${Date.now()}.${fileExt}`;
  const filePath = `${student_id}/${document_type}/${fileName}`;
  const { error } = await supabase.storage
    .from('enrollment-uploads')
    .upload(filePath, file);
  if (error) throw new Error(`Storage upload failed: ${error.message}`); // bubble up [web:139]
  return filePath;
}

// Replace-or-insert one document row per type (throw on error)
async function replaceDoc(student_id, document_type, file) {
  if (!file) return null;
  const filePath = await uploadDocumentFile(file, student_id, document_type); // may throw [web:202]
  const { error: delErr } = await supabase
    .from('documents')
    .delete()
    .eq('student_id', student_id)
    .eq('document_type', document_type);
  if (delErr) throw new Error(`Delete doc failed: ${delErr.message}`); // bubble up [web:139]
  const { error: insErr } = await supabase
    .from('documents')
    .insert([{ student_id, document_type, file_path: filePath }]);
  if (insErr) throw new Error(`Insert doc failed: ${insErr.message}`); // bubble up [web:139]
  return filePath;
}

export const Enrollment_Form = ({
  step,
  setStep,
  initialData = {},
  resubmit = false,
  resubmitEnrollmentId = null,
}) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedSchoolYear] = useState('2025-2026');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (userId) setCurrentUserId(userId);
  }, []);

  // Fields
  const [medicalConditions, setMedicalConditions] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState('');
  const [lRN, setLRN] = useState('');
  const [grade, setGrade] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState(''); // users.date_of_birth
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [streetBlock, setStreetBlock] = useState('');
  const [city, setCity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [citizenship, setCitizenship] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [indigenousGroup, setIndigenousGroup] = useState('');

  const [fatherName, setFatherName] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [fatherContact, setFatherContact] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');
  const [motherContact, setMotherContact] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianOccupation, setGuardianOccupation] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianStreetBlock, setGuardianStreetBlock] = useState('');
  const [guardianCity, setGuardianCity] = useState('');
  const [guardianBarangay, setGuardianBarangay] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const [formerSchoolName, setFormerSchoolName] = useState('');
  const [formerSchoolAddress, setFormerSchoolAddress] = useState('');
  const [lastGradeCompleted, setLastGradeCompleted] = useState('');
  const [lastSchoolYear, setLastSchoolYear] = useState('');
  const [average, setAverage] = useState('');

  // Files
  const [psaFile, setPsaFile] = useState(null);
  const [reportCardFile, setReportCardFile] = useState(null);
  const [sf10File, setSf10File] = useState(null);
  const [idPhotoFile, setIdPhotoFile] = useState(null);
  const [govIdFile, setGovIdFile] = useState(null);
  // Blob URLs for previews
  const psaUrl = useObjectUrl(psaFile);
  const cardUrl = useObjectUrl(reportCardFile);
  const sf10Url = useObjectUrl(sf10File);
  const idUrl = useObjectUrl(idPhotoFile);
  const govIdUrl = useObjectUrl(govIdFile); // <-- add this [web:115]

  const [checkedPolicies, setCheckedPolicies] = useState({
    policy1: false,
    policy2: false,
  });
  const [governmentIdType, setGovernmentIdType] = useState('');

  const [errors, setErrors] = useState({});

  // Validated file change handler (label optional)
  const handleFileChange = (e, setter, label) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setter(null);
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      if (label)
        setErrors((p) => ({
          ...p,
          [label]: 'Only JPEG, PNG, or PDF files are allowed.',
        }));
      e.target.value = '';
      setter(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      if (label)
        setErrors((p) => ({
          ...p,
          [label]: `File must be ≤ ${Math.floor(MAX_BYTES / (1024 * 1024))} MB.`,
        }));
      e.target.value = '';
      setter(null);
      return;
    }
    if (label)
      setErrors((p) => {
        const cp = { ...p };
        delete cp[label];
        return cp;
      });
    setter(file);
  };

  /* ===== Prefill (resubmit and initial) ===== */
  useEffect(() => {
    const prefill = async () => {
      // Seed from initialData if provided (do NOT return early)
      if (initialData && Object.keys(initialData).length) {
        setFirstName(initialData.first_name || '');
        setMiddleName(initialData.middle_name || '');
        setLastName(initialData.last_name || '');
        setSuffix(initialData.suffix || '');
        setGender(initialData.gender || '');
        setBirthdate(toInputDate(initialData.date_of_birth));
        setCitizenship(initialData.citizenship || '');
        setMotherTongue(initialData.mother_tongue || '');
        setIndigenousGroup(initialData.indigenous_group || '');
      }

      try {
        const userId = localStorage.getItem('user_id');

        // Student profile (students has no date_of_birth column)
        const { data: student } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(); // zero-or-one [web:170]

        if (student) {
          setLRN((v) => v || student.lrn || '');
          setFirstName((v) => v || student.first_name || '');
          setMiddleName((v) => v || student.middle_name || '');
          setLastName((v) => v || student.last_name || '');
          setSuffix((v) => v || student.suffix || '');
          setGender(
            (v) =>
              v || (student.gender || '').replace(/^\w/, (c) => c.toUpperCase())
          );
          setPlaceOfBirth((v) => v || student.place_of_birth || '');
          setCitizenship((v) => v || student.citizenship || '');
          setCivilStatus((v) => v || student.civil_status || '');
          setMotherTongue((v) => v || student.mother_tongue || '');
          setIndigenousGroup((v) => v || student.indigenous_group || '');
          const parts = (student.address || '').split(',').map((x) => x.trim());
          if (parts.length === 3) {
            setStreetBlock((v) => v || parts[0] || '');
            setBarangay((v) => v || parts[1] || '');
            setCity((v) => v || parts[2] || '');
          }
        }

        // Applicant (for OR fallback)
        const { data: applicantRow } = await supabase
          .from('applicants')
          .select('applicant_id')
          .eq('user_id', userId)
          .maybeSingle(); // zero-or-one [web:170]

        // Birthdate from users.date_of_birth
        const { data: userRow } = await supabase
          .from('users')
          .select('date_of_birth')
          .eq('user_id', userId)
          .maybeSingle(); // zero-or-one [web:170]
        setBirthdate((v) => v || toInputDate(userRow?.date_of_birth));

        // FAMILY: student_id OR applicant_id → newest
        const orFamily = [
          student?.student_id ? `student_id.eq.${student.student_id}` : null,
          applicantRow?.applicant_id
            ? `applicant_id.eq.${applicantRow.applicant_id}`
            : null,
        ]
          .filter(Boolean)
          .join(',');

        if (orFamily) {
          const { data: family } = await supabase
            .from('family_info')
            .select('*')
            .or(orFamily) // PostgREST OR filter [web:155]
            .order('family_id', { ascending: false })
            .limit(1)
            .maybeSingle(); // zero-or-one [web:170]

          if (family) {
            setFatherName((v) => v || family.father_name || '');
            setFatherOccupation((v) => v || family.father_occupation || '');
            setFatherContact((v) => v || family.father_contact || '');
            setMotherName((v) => v || family.mother_name || '');
            setMotherOccupation((v) => v || family.mother_occupation || '');
            setMotherContact((v) => v || family.mother_contact || '');
            setGuardianName((v) => v || family.guardian_name || '');
            setGuardianRelationship(
              (v) => v || family.guardian_relationship || ''
            );
            setGuardianContact((v) => v || family.guardian_contact || '');
            setGuardianOccupation((v) => v || family.guardian_occupation || '');
            setGuardianStreetBlock(
              (v) => v || family.guardian_street_block || ''
            );
            setGuardianCity((v) => v || family.guardian_city || '');
            setGuardianBarangay((v) => v || family.guardian_barangay || '');
            setEmergencyName((v) => v || family.emergency_contact_name || '');
            setEmergencyContact(
              (v) => v || family.emergency_contact_number || ''
            );
          }
        }

        // HEALTH: student_id OR applicant_id → newest
        const orHealth = [
          student?.student_id ? `student_id.eq.${student.student_id}` : null,
          applicantRow?.applicant_id
            ? `applicant_id.eq.${applicantRow.applicant_id}`
            : null,
        ]
          .filter(Boolean)
          .join(',');

        if (orHealth) {
          const { data: health } = await supabase
            .from('health_info')
            .select('*')
            .or(orHealth) // PostgREST OR filter [web:155]
            .order('health_id', { ascending: false })
            .limit(1)
            .maybeSingle(); // zero-or-one [web:170]

          if (health) {
            setMedicalConditions((v) => v || health.medical_conditions || '');
            setBloodType((v) => v || health.blood_type || '');
          }
        }

        // Academic (latest)
        if (student?.student_id) {
          const { data: acadRows } = await supabase
            .from('academic_history')
            .select('*')
            .eq('student_id', student.student_id)
            .order('academic_id', { ascending: false })
            .limit(1);
          const acad = acadRows?.[0];
          if (acad) {
            setFormerSchoolName((v) => v || acad.former_school_name || '');
            setFormerSchoolAddress(
              (v) => v || acad.former_school_address || ''
            );
            setLastGradeCompleted(
              (v) => v || String(acad.last_grade_level_completed || '') || ''
            );
            setLastSchoolYear((v) => v || acad.last_school_year_attended || '');
            setAverage((v) => v || String(acad.general_average ?? '') || '');
          }
        }

        // Enrollment (prefill grade on resubmit)
        if (resubmit && resubmitEnrollmentId) {
          const { data: enr } = await supabase
            .from('enrollments')
            .select('*')
            .eq('enrollment_id', resubmitEnrollmentId)
            .maybeSingle(); // zero-or-one [web:170]
          if (enr?.grade_level) setGrade((v) => v || enr.grade_level);
        }

        // Clear files for fresh re-upload
        setPsaFile(null);
        setReportCardFile(null);
        setSf10File(null);
        setIdPhotoFile(null);
      } catch (e) {
        console.warn('prefill error:', e?.message || String(e));
      }
    };
    prefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resubmit, resubmitEnrollmentId]);

  /* ===== Draft autosave (hydrate + persist) ===== */
  useEffect(() => {
    if (!currentUserId) return;
    try {
      const raw = localStorage.getItem(`enrollment_draft_${currentUserId}`);
      if (!raw) return;
      const d = JSON.parse(raw);

      setLRN((v) => v || d.lRN || '');
      setGrade((v) => v || d.grade || '');
      setLastName((v) => v || d.lastName || '');
      setFirstName((v) => v || d.firstName || '');
      setMiddleName((v) => v || d.middleName || '');
      setSuffix((v) => v || d.suffix || '');
      setGender((v) => v || d.gender || '');
      setBirthdate((v) => v || d.birthdate || '');
      setPlaceOfBirth((v) => v || d.placeOfBirth || '');
      setStreetBlock((v) => v || d.streetBlock || '');
      setBarangay((v) => v || d.barangay || '');
      setCity((v) => v || d.city || '');
      setCivilStatus((v) => v || d.civilStatus || '');
      setCitizenship((v) => v || d.citizenship || '');
      setMotherTongue((v) => v || d.motherTongue || '');
      setIndigenousGroup((v) => v || d.indigenousGroup || '');
      setFatherName((v) => v || d.fatherName || '');
      setFatherOccupation((v) => v || d.fatherOccupation || '');
      setFatherContact((v) => v || d.fatherContact || '');
      setMotherName((v) => v || d.motherName || '');
      setMotherOccupation((v) => v || d.motherOccupation || '');
      setMotherContact((v) => v || d.motherContact || '');
      setGuardianName((v) => v || d.guardianName || '');
      setGuardianOccupation((v) => v || d.guardianOccupation || '');
      setGuardianContact((v) => v || d.guardianContact || '');
      setGuardianRelationship((v) => v || d.guardianRelationship || '');
      setGuardianStreetBlock((v) => v || d.guardianStreetBlock || '');
      setGuardianCity((v) => v || d.guardianCity || '');
      setGuardianBarangay((v) => v || d.guardianBarangay || '');
      setEmergencyName((v) => v || d.emergencyName || '');
      setEmergencyContact((v) => v || d.emergencyContact || '');
      setFormerSchoolName((v) => v || d.formerSchoolName || '');
      setFormerSchoolAddress((v) => v || d.formerSchoolAddress || '');
      setLastGradeCompleted((v) => v || d.lastGradeCompleted || '');
      setLastSchoolYear((v) => v || d.lastSchoolYear || '');
      setAverage((v) => v || d.average || '');
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const t = setTimeout(() => {
      const d = {
        lRN,
        grade,
        lastName,
        firstName,
        middleName,
        suffix,
        gender,
        birthdate,
        placeOfBirth,
        streetBlock,
        barangay,
        city,
        civilStatus,
        citizenship,
        motherTongue,
        indigenousGroup,
        fatherName,
        fatherOccupation,
        fatherContact,
        motherName,
        motherOccupation,
        motherContact,
        guardianName,
        guardianOccupation,
        guardianContact,
        guardianRelationship,
        guardianStreetBlock,
        guardianCity,
        guardianBarangay,
        emergencyName,
        emergencyContact,
        formerSchoolName,
        formerSchoolAddress,
        lastGradeCompleted,
        lastSchoolYear,
        average,
      };
      localStorage.setItem(
        `enrollment_draft_${currentUserId}`,
        JSON.stringify(d)
      );
    }, 300);
    return () => clearTimeout(t);
  }, [
    currentUserId,
    lRN,
    grade,
    lastName,
    firstName,
    middleName,
    suffix,
    gender,
    birthdate,
    placeOfBirth,
    streetBlock,
    barangay,
    city,
    civilStatus,
    citizenship,
    motherTongue,
    indigenousGroup,
    fatherName,
    fatherOccupation,
    fatherContact,
    motherName,
    motherOccupation,
    motherContact,
    guardianName,
    guardianOccupation,
    guardianContact,
    guardianRelationship,
    guardianStreetBlock,
    guardianCity,
    guardianBarangay,
    emergencyName,
    emergencyContact,
    formerSchoolName,
    formerSchoolAddress,
    lastGradeCompleted,
    lastSchoolYear,
    average,
  ]);

  /* ===== Validations & navigation ===== */
  const validateStep1 = () => {
    let tempErrors = {};
    if (!lRN.trim()) tempErrors.lRN = 'LRN is required.';
    if (!grade.trim()) tempErrors.grade = 'Grade is required.';
    if (!lastName.trim()) tempErrors.lastName = 'Last Name is required.';
    if (!firstName.trim()) tempErrors.firstName = 'First Name is required.';
    if (!gender.trim()) tempErrors.gender = 'Gender is required.';
    if (!birthdate.trim()) tempErrors.birthdate = 'Birthdate is required.';
    if (!placeOfBirth.trim())
      tempErrors.placeOfBirth = 'Place of birth is required.';
    if (!streetBlock.trim())
      tempErrors.streetBlock = 'Street/Block is required.';
    if (!city.trim()) tempErrors.city = 'City is required.';
    if (!barangay.trim()) tempErrors.barangay = 'Barangay is required.';
    if (!civilStatus.trim())
      tempErrors.civilStatus = 'Civil status is required.';
    if (!citizenship.trim())
      tempErrors.citizenship = 'Citizenship is required.';
    if (!motherTongue.trim())
      tempErrors.motherTongue = 'Mother Tongue is required.';
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const validateStep2 = () => {
    let tempErrors = {};
    if (!fatherName.trim())
      tempErrors.fatherName = "Father's Name is required.";
    if (!fatherOccupation.trim())
      tempErrors.fatherOccupation = "Father's Occupation is required.";
    if (!fatherContact.trim())
      tempErrors.fatherContact = "Father's Contact is required.";
    if (!motherName.trim())
      tempErrors.motherName = "Mother's Name is required.";
    if (!motherOccupation.trim())
      tempErrors.motherOccupation = "Mother's Occupation is required.";
    if (!motherContact.trim())
      tempErrors.motherContact = "Mother's Contact is required.";
    if (!guardianName.trim())
      tempErrors.guardianName = "Guardian's Name is required.";
    if (!guardianContact.trim())
      tempErrors.guardianContact = "Guardian's Contact is required.";
    if (!guardianRelationship.trim())
      tempErrors.guardianRelationship = "Guardian's Relationship is required.";
    if (!emergencyName.trim())
      tempErrors.emergencyName = 'Emergency Contact Name is required.';
    if (!emergencyContact.trim())
      tempErrors.emergencyContact = 'Emergency Contact Number is required.';
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const validateStep3 = () => {
    let tempErrors = {};
    if (!formerSchoolName.trim())
      tempErrors.formerSchoolName = 'Former School Name is required.';
    if (!formerSchoolAddress.trim())
      tempErrors.formerSchoolAddress = 'Former School Address is required.';
    if (!lastGradeCompleted.trim())
      tempErrors.lastGradeCompleted = 'Last Grade Completed is required.';
    if (!lastSchoolYear.trim())
      tempErrors.lastSchoolYear = 'Last School Year Attended is required.';
    if (!average.trim()) tempErrors.average = 'Average is required.';
    if (!psaFile) tempErrors.psaFile = 'PSA / Birth Certificate is required.';
    if (!reportCardFile)
      tempErrors.reportCardFile = 'Report Card / Form 138 is required.';
    if (!sf10File) tempErrors.sf10File = 'SF10 is required.';
    if (!idPhotoFile) tempErrors.idPhotoFile = 'ID Photo is required.';
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const validateStep4 = () => {
    let tempErrors = {};
    if (!checkedPolicies.policy1 || !checkedPolicies.policy2)
      tempErrors.policies = 'You must agree to all policies.';
    if (!governmentIdType.trim())
      tempErrors.governmentIdType = 'Please select a government ID.';
    if (!govIdFile)
      tempErrors.govIdFile = 'Uploading government ID file is required.';
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const handleBack = () => {
    if (step === 1) navigate('/applicant_homepage');
    else setStep(step - 1);
  };

  /* ===== Submit ===== */
  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!currentUserId) {
        alert('Please log in before submitting the form.');
        return;
      }

      // Final file validation BEFORE any uploads or DB writes
      const invalids = [];
      const checkFile = (f, key, allowPdf = true) => {
        if (!f) return;
        if (!ALLOWED_MIME.has(f.type)) invalids.push(`${key}: invalid type`);
        if (!allowPdf && f.type === 'application/pdf')
          invalids.push(`${key}: must be an image (JPEG/PNG)`);
        if (f.size > MAX_BYTES) invalids.push(`${key}: too large`);
      };
      checkFile(psaFile, 'PSA Birth Cert');
      checkFile(reportCardFile, 'Report Card');
      checkFile(sf10File, 'SF10');
      checkFile(idPhotoFile, 'ID Photo', false);
      if (invalids.length) {
        alert(`Please fix file uploads:\n- ${invalids.join('\n- ')}`);
        return;
      }

      const manilaNow = DateTime.now().setZone('Asia/Manila').toISO();

      // Applicant upsert
      const applicantPayload = {
        user_id: currentUserId,
        agreed_policy_1: checkedPolicies.policy1,
        agreed_policy_2: checkedPolicies.policy2,
        government_id: governmentIdType,
        government_id_file: govIdFile ? govIdFile.name : null,
      };
      const { data: applicantRow, error: appError } = await supabase
        .from('applicants')
        .upsert(applicantPayload, { onConflict: 'user_id' })
        .select('applicant_id')
        .single();
      if (appError) {
        alert('Failed to save applicant: ' + appError.message);
        return;
      }

      // Student upsert (students has no date_of_birth)
      const studentPayload = {
        user_id: currentUserId,
        applicant_id: applicantRow ? applicantRow.applicant_id : null,
        lrn: lRN,
        place_of_birth: placeOfBirth,
        gender: gender.toLowerCase(),
        address: `${streetBlock}, ${barangay}, ${city}`,
        citizenship,
        civil_status: civilStatus,
        mother_tongue: motherTongue,
        indigenous_group: indigenousGroup,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        suffix: suffix,
      };
      const { data: student, error: studentError } = await supabase
        .from('students')
        .upsert(studentPayload, { onConflict: 'user_id' })
        .select('student_id')
        .single();
      if (studentError) {
        alert('Failed to save student info: ' + studentError.message);
        return;
      }

      // Update users.date_of_birth (authoritative)
      const { error: userUpdErr } = await supabase
        .from('users')
        .update({ date_of_birth: birthdate })
        .eq('user_id', currentUserId);
      if (userUpdErr) {
        alert('Failed to save birthdate: ' + userUpdErr.message);
        return;
      }

      // Enrollment create or update
      if (resubmit && resubmitEnrollmentId) {
        const { error: updErr } = await supabase
          .from('enrollments')
          .update({
            status: 'pending',
            application_date: manilaNow,
            grade_level: grade,
            school_year: selectedSchoolYear,
          })
          .eq('enrollment_id', resubmitEnrollmentId);
        if (updErr) {
          alert('Failed to update enrollment: ' + updErr.message);
          return;
        }
      } else {
        const enrollmentPayload = {
          applicant_id: applicantRow ? applicantRow.applicant_id : null,
          school_year: selectedSchoolYear,
          grade_level: grade,
          application_date: manilaNow,
          status: 'pending',
          adviser_approved: false,
          dept_head_approved: false,
          principal_approved: false,
          is_transferee: false,
          confirmed_by_guardian: false,
        };
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert([enrollmentPayload]);
        if (enrollmentError) {
          alert('Failed to save enrollment: ' + enrollmentError.message);
          return;
        }
      }

      // Health upsert
      const healthPayload = {
        student_id: student.student_id,
        applicant_id: applicantRow?.applicant_id || null,
        medical_conditions: medicalConditions,
        blood_type: bloodType,
      };
      const { error: healthError } = await supabase
        .from('health_info')
        .upsert(healthPayload, { onConflict: 'student_id' });
      if (healthError) {
        alert('Failed to save health info: ' + healthError.message);
        return;
      }

      // Family upsert (includes guardian occupation + address)
      const familyPayload = {
        student_id: student.student_id,
        applicant_id: applicantRow?.applicant_id || null,
        father_name: fatherName,
        father_occupation: fatherOccupation,
        father_contact: fatherContact,
        mother_name: motherName,
        mother_occupation: motherOccupation,
        mother_contact: motherContact,
        guardian_name: guardianName,
        guardian_relationship: guardianRelationship,
        guardian_contact: guardianContact,
        guardian_occupation: guardianOccupation,
        guardian_street_block: guardianStreetBlock,
        guardian_city: guardianCity,
        guardian_barangay: guardianBarangay,
        emergency_contact_name: emergencyName,
        emergency_contact_number: emergencyContact,
      };
      const { error: familyError } = await supabase
        .from('family_info')
        .upsert(familyPayload, { onConflict: 'student_id' });
      if (familyError) {
        alert('Failed to save family info: ' + familyError.message);
        return;
      }

      // Academic insert
      const academicPayload = {
        student_id: student.student_id,
        applicant_id: applicantRow?.applicant_id || null,
        former_school_name: formerSchoolName,
        former_school_address: formerSchoolAddress,
        last_grade_level_completed: Number(lastGradeCompleted),
        last_school_year_attended: lastSchoolYear,
        general_average: Number(average),
      };
      const { error: acadError } = await supabase
        .from('academic_history')
        .insert([academicPayload]);
      if (acadError) {
        alert('Failed to save academic history: ' + acadError.message);
        return;
      }

      // Documents re-upload: replace old rows per type
      if (psaFile)
        await replaceDoc(student.student_id, 'psa_birth_cert', psaFile);
      if (reportCardFile)
        await replaceDoc(student.student_id, 'report_card', reportCardFile);
      if (sf10File) await replaceDoc(student.student_id, 'sf10', sf10File);
      if (idPhotoFile)
        await replaceDoc(student.student_id, 'id_photo', idPhotoFile);

      setShowSuccessModal(true);
      if (currentUserId)
        localStorage.removeItem(`enrollment_draft_${currentUserId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* ===== Render (keep your existing Step 1/2/3/4 UI; below are preview snippets) ===== */

  return (
    <Enrollment_Container>
      <LoadingPopup
        show={busy}
        message="Submitting the Enrollment Form..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <EnrollmentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />

      {step === 1 && (
        <>
          <div className="studentInfoContainer">
            <div className="stepper">
              <h2>Step 1 out of 4</h2>
            </div>
            <h1>Student Information</h1>
            <div className="student_Infos">
              <div className="student_Info first">
                <div className="inputGroup">
                  <label htmlFor="lRN">LRN*</label>
                  <input
                    id="lRN"
                    type="text"
                    value={lRN}
                    maxLength={12}
                    pattern="[0-9]*"
                    onChange={(e) => setLRN(e.target.value)}
                    required
                    placeholder="Enter LRN"
                  />
                  {errors.lRN && <p className="error">{errors.lRN}</p>}
                </div>
                <div className="inputGroup">
                  <label htmlFor="grade">Select Grade Level*</label>
                  <select
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Grade
                    </option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                  </select>
                  {errors.grade && <p className="error">{errors.grade}</p>}
                </div>
              </div>
              <div className="student_Info">
                <div className="inputGroup">
                  <label htmlFor="lastName">Last Name*</label>
                  <input
                    id="lastName"
                    value={lastName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="error">{errors.lastName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="firstName">First Name*</label>
                  <input
                    id="firstName"
                    value={firstName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="error">{errors.firstName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="middleName">Middle Name</label>
                  <input
                    id="middleName"
                    value={middleName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Enter middle name"
                  />
                  {errors.middleName && (
                    <p className="error">{errors.middleName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="suffix">Suffix</label>
                  <input
                    id="suffix"
                    type="text"
                    className="suffix"
                    value={suffix}
                    style={{ minWidth: 40 }}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="(Jr., Sr., III, ...)"
                  />
                </div>
              </div>
              <div className="student_Info">
                <div className="inputGroup">
                  <label htmlFor="gender">Gender*</label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Gender
                    </option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.gender && <p className="error">{errors.gender}</p>}
                </div>
                <div className="inputGroup">
                  <label htmlFor="birthdate">Birthdate*</label>
                  <input
                    id="birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    required
                    placeholder="mm/dd/yyyy"
                  />
                  {errors.birthdate && (
                    <p className="error">{errors.birthdate}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="placeOfBirth">Place of Birth*</label>
                  <input
                    id="placeOfBirth"
                    value={placeOfBirth}
                    onChange={(e) => setPlaceOfBirth(e.target.value)}
                    required
                    placeholder="Enter place of birth"
                  />
                  {errors.placeOfBirth && (
                    <p className="error">{errors.placeOfBirth}</p>
                  )}
                </div>
              </div>
            </div>
            <p className="titleLabel">Address</p>
            <div className="address_Infos">
              <div className="address_Info">
                <div className="inputGroup">
                  <label htmlFor="streetBlock">Street/Block*</label>
                  <input
                    id="streetBlock"
                    value={streetBlock}
                    onChange={(e) => setStreetBlock(e.target.value)}
                    required
                    placeholder="Street/Block"
                  />
                  {errors.streetBlock && (
                    <p className="error">{errors.streetBlock}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="city">City*</label>
                  <input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    placeholder="City"
                  />
                  {errors.city && <p className="error">{errors.city}</p>}
                </div>
                <div className="inputGroup">
                  <label htmlFor="barangay">Barangay*</label>
                  <input
                    id="barangay"
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    required
                    placeholder="Barangay"
                  />
                  {errors.barangay && (
                    <p className="error">{errors.barangay}</p>
                  )}
                </div>
              </div>
              <div className="address_Info">
                <div className="inputGroup">
                  <label htmlFor="civilStatus">Civil Status*</label>
                  <select
                    id="civilStatus"
                    value={civilStatus}
                    onChange={(e) => setCivilStatus(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Status
                    </option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                  {errors.civilStatus && (
                    <p className="error">{errors.civilStatus}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="citizenship">Citizenship*</label>
                  <input
                    id="citizenship"
                    value={citizenship}
                    onChange={(e) => setCitizenship(e.target.value)}
                    required
                    placeholder="Citizenship"
                  />
                  {errors.citizenship && (
                    <p className="error">{errors.citizenship}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="motherTongue">Mother Tongue*</label>
                  <input
                    id="motherTongue"
                    value={motherTongue}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setMotherTongue(e.target.value)}
                    required
                    placeholder="Mother Tongue"
                  />
                  {errors.motherTongue && (
                    <p className="error">{errors.motherTongue}</p>
                  )}
                </div>
              </div>
              <div className="address_Info indigenous">
                <div className="inputGroup">
                  <label htmlFor="indigenousGroup">
                    Indigenous Group? If yes, please specify
                  </label>
                  <input
                    id="indigenousGroup"
                    placeholder="(Optional)"
                    value={indigenousGroup}
                    onChange={(e) => setIndigenousGroup(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <p className="titleLabel">Health Info</p>
            <div className="health_Infos">
              <div className="health_Info">
                <div className="inputGroup">
                  <label htmlFor="medicalConditions">
                    Medical conditions if yes, please specify
                  </label>
                  <input
                    id="medicalConditions"
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder="(Optional, type 'None' if not applicable)"
                  />
                </div>
                <div className="inputGroup">
                  <label htmlFor="bloodType">Bloodtype*</label>
                  <select
                    id="bloodType"
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Bloodtype
                    </option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                  {errors.bloodType && (
                    <p className="error">{errors.bloodType}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="buttons_Container">
              <div className="buttons">
                <button type="button" onClick={handleBack}>
                  Back
                </button>
                <button type="button" onClick={handleNext}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="guardianInfoContainer">
            <div className="stepper">
              <h2>Step 2 out of 4</h2>
            </div>
            <h1>Family / Guardian Information</h1>
            <div className="guardian_Infos">
              <div className="guardian_Info">
                <div className="inputGroup">
                  <label htmlFor="fatherName">Father's Name*</label>
                  <input
                    id="fatherName"
                    value={fatherName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setFatherName(e.target.value)}
                    required
                    placeholder="Enter father's full name"
                  />
                  {errors.fatherName && (
                    <p className="error">{errors.fatherName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="fatherOccupation">Occupation*</label>
                  <select
                    id="fatherOccupation"
                    value={fatherOccupation}
                    onChange={(e) => setFatherOccupation(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Occupation
                    </option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Business">Business</option>
                    <option value="Government">Government</option>
                    <option value="Private Sector">Private Sector</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Retired">Retired</option>
                    <option value="OFW">Overseas Worker</option>
                    <option value="Homemaker">Homemaker</option>
                  </select>
                  {errors.fatherOccupation && (
                    <p className="error">{errors.fatherOccupation}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="fatherContact">Contact No.*</label>
                  <input
                    id="fatherContact"
                    type="tel"
                    maxLength={11}
                    pattern="^09\d{9}$"
                    value={fatherContact}
                    onChange={(e) => setFatherContact(e.target.value)}
                    required
                    placeholder="09xxxxxxxxx"
                  />
                  {errors.fatherContact && (
                    <p className="error">{errors.fatherContact}</p>
                  )}
                </div>
              </div>

              <div className="guardian_Info">
                <div className="inputGroup">
                  <label htmlFor="motherName">Mother's Name*</label>
                  <input
                    id="motherName"
                    value={motherName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setMotherName(e.target.value)}
                    required
                    placeholder="Enter mother's full name"
                  />
                  {errors.motherName && (
                    <p className="error">{errors.motherName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="motherOccupation">Occupation*</label>
                  <select
                    id="motherOccupation"
                    value={motherOccupation}
                    onChange={(e) => setMotherOccupation(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Occupation
                    </option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Business">Business</option>
                    <option value="Government">Government</option>
                    <option value="Private Sector">Private Sector</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Retired">Retired</option>
                    <option value="OFW">Overseas Worker</option>
                    <option value="Homemaker">Homemaker</option>
                  </select>
                  {errors.motherOccupation && (
                    <p className="error">{errors.motherOccupation}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="motherContact">Contact No.*</label>
                  <input
                    id="motherContact"
                    type="tel"
                    maxLength={11}
                    pattern="^09\d{9}$"
                    value={motherContact}
                    onChange={(e) => setMotherContact(e.target.value)}
                    required
                    placeholder="09xxxxxxxxx"
                  />
                  {errors.motherContact && (
                    <p className="error">{errors.motherContact}</p>
                  )}
                </div>
              </div>

              <div className="guardian_Info">
                <div className="inputGroup">
                  <label htmlFor="guardianName">Guardian's Name*</label>
                  <input
                    id="guardianName"
                    value={guardianName}
                    pattern="^[A-Za-z\s'-]+$"
                    onChange={(e) => setGuardianName(e.target.value)}
                    required
                    placeholder="Enter guardian's full name"
                  />
                  {errors.guardianName && (
                    <p className="error">{errors.guardianName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="guardianOccupation">Occupation*</label>
                  <select
                    id="guardianOccupation"
                    value={guardianOccupation}
                    onChange={(e) => setGuardianOccupation(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Occupation
                    </option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Business">Business</option>
                    <option value="Government">Government</option>
                    <option value="Private Sector">Private Sector</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Retired">Retired</option>
                    <option value="OFW">Overseas Worker</option>
                    <option value="Homemaker">Homemaker</option>
                  </select>
                  {errors.guardianOccupation && (
                    <p className="error">{errors.guardianOccupation}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="guardianContact">Contact No.*</label>
                  <input
                    id="guardianContact"
                    type="tel"
                    maxLength={11}
                    pattern="^09\d{9}$"
                    value={guardianContact}
                    onChange={(e) => setGuardianContact(e.target.value)}
                    required
                    placeholder="09xxxxxxxxx"
                  />
                  {errors.guardianContact && (
                    <p className="error">{errors.guardianContact}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="guardianRelationship">Relationship*</label>
                  <select
                    id="guardianRelationship"
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Relationship
                    </option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Aunt">Aunt</option>
                    <option value="Uncle">Uncle</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.guardianRelationship && (
                    <p className="error">{errors.guardianRelationship}</p>
                  )}
                </div>
              </div>

              <p>Address</p>
              <div className="guardian_Address_Infos">
                <div className="guardian_Address_Info">
                  <div className="inputGroup">
                    <label htmlFor="guardianStreetBlock">Street / Block*</label>
                    <input
                      id="guardianStreetBlock"
                      value={guardianStreetBlock}
                      onChange={(e) => setGuardianStreetBlock(e.target.value)}
                      required
                      placeholder="Street/Block"
                    />
                    {errors.guardianStreetBlock && (
                      <p className="error">{errors.guardianStreetBlock}</p>
                    )}
                  </div>
                  <div className="inputGroup">
                    <label htmlFor="guardianCity">City*</label>
                    <input
                      id="guardianCity"
                      value={guardianCity}
                      onChange={(e) => setGuardianCity(e.target.value)}
                      required
                      placeholder="City"
                    />
                    {errors.guardianCity && (
                      <p className="error">{errors.guardianCity}</p>
                    )}
                  </div>
                  <div className="inputGroup">
                    <label htmlFor="guardianBarangay">Barangay*</label>
                    <input
                      id="guardianBarangay"
                      value={guardianBarangay}
                      onChange={(e) => setGuardianBarangay(e.target.value)}
                      required
                      placeholder="Barangay"
                    />
                    {errors.guardianBarangay && (
                      <p className="error">{errors.guardianBarangay}</p>
                    )}
                  </div>
                </div>
              </div>

              <p>In case of emergency</p>
              <div className="emergency_Infos">
                <div className="emergency_Info">
                  <div className="inputGroup">
                    <label htmlFor="emergencyName">Name*</label>
                    <input
                      id="emergencyName"
                      value={emergencyName}
                      pattern="^[A-Za-z\s'-]+$"
                      onChange={(e) => setEmergencyName(e.target.value)}
                      required
                      placeholder="Emergency contact name"
                    />
                    {errors.emergencyName && (
                      <p className="error">{errors.emergencyName}</p>
                    )}
                  </div>
                  <div className="inputGroup">
                    <label htmlFor="emergencyContact">Contact No.*</label>
                    <input
                      id="emergencyContact"
                      type="tel"
                      maxLength={11}
                      pattern="^09\d{9}$"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      required
                      placeholder="09xxxxxxxxx"
                    />
                    {errors.emergencyContact && (
                      <p className="error">{errors.emergencyContact}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="buttons_Container">
                <div className="buttons">
                  <button type="button" onClick={handleBack}>
                    Back
                  </button>
                  <button type="button" onClick={handleNext}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="academicBackgroundContainer">
            <div className="stepper">
              <h2>Step 3 out of 4</h2>
            </div>
            <h1>Student Academic Background</h1>
            <div className="former_School_Infos">
              <div className="former_School_Info">
                <div className="inputGroup">
                  <label htmlFor="formerSchoolName">Former School Name*</label>
                  <input
                    id="formerSchoolName"
                    value={formerSchoolName}
                    onChange={(e) => setFormerSchoolName(e.target.value)}
                    required
                    placeholder="Enter the full name of your previous school"
                  />
                  {errors.formerSchoolName && (
                    <p className="error">{errors.formerSchoolName}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="formerSchoolAddress">School Address*</label>
                  <input
                    id="formerSchoolAddress"
                    value={formerSchoolAddress}
                    onChange={(e) => setFormerSchoolAddress(e.target.value)}
                    required
                    placeholder="Enter school address"
                  />
                  {errors.formerSchoolAddress && (
                    <p className="error">{errors.formerSchoolAddress}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="last_School_Infos">
              <div className="last_School_Info">
                <div className="inputGroup">
                  <label htmlFor="lastGradeCompleted">
                    Last Grade Completed*
                  </label>
                  <select
                    id="lastGradeCompleted"
                    value={lastGradeCompleted}
                    onChange={(e) => setLastGradeCompleted(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select Grade
                    </option>
                    <option value="6">Grade 6</option>
                    <option value="7">Grade 7</option>
                    <option value="8">Grade 8</option>
                    <option value="9">Grade 9</option>
                  </select>
                  {errors.lastGradeCompleted && (
                    <p className="error">{errors.lastGradeCompleted}</p>
                  )}
                </div>
                <div className="inputGroup">
                  <label htmlFor="lastSchoolYear">
                    Last School Year Attended*
                  </label>
                  <input
                    id="lastSchoolYear"
                    value={lastSchoolYear}
                    onChange={(e) => setLastSchoolYear(e.target.value)}
                    required
                    placeholder="e.g., 2024-2025"
                    pattern="^\d{4}-\d{4}$"
                  />
                  {errors.lastSchoolYear && (
                    <p className="error">{errors.lastSchoolYear}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="average_Infos">
              <div className="average_Info">
                <div className="inputGroup">
                  <label htmlFor="average">Average*</label>
                  <input
                    id="average"
                    type="number"
                    step="0.01"
                    min="60"
                    max="100"
                    value={average}
                    onChange={(e) => setAverage(e.target.value)}
                    required
                    placeholder="e.g., 88.25"
                  />
                  {errors.average && <p className="error">{errors.average}</p>}
                </div>
              </div>
            </div>
            <p>Document Upload</p>
            <div className="document_Infos">
              <div className="document_Upload_Buttons">
                {/* PSA / Birth Certificate */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 18,
                  }}
                >
                  <label style={{ width: 200, marginRight: 18 }}>
                    PSA / Birth Certificate*
                  </label>
                  <input
                    type="file"
                    id="psaFileUpload"
                    hidden
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange(e, setPsaFile, 'psaFile')}
                    required
                  />
                  <label
                    htmlFor="psaFileUpload"
                    className="upload-btn-PSA"
                    style={{ marginRight: 14 }}
                  >
                    Upload File
                  </label>
                  {psaFile && (
                    <>
                      {isImage(psaFile) ? (
                        <img
                          style={{ marginRight: 14 }}
                          src={psaUrl}
                          alt="PSA Preview"
                          className="file-preview"
                        />
                      ) : (
                        <embed
                          style={{ marginRight: 14 }}
                          src={psaUrl}
                          type="application/pdf"
                          width="120"
                          height="160"
                        />
                      )}
                      <span>{psaFile.name}</span>
                    </>
                  )}
                  {errors.psaFile && (
                    <span className="error" style={{ marginLeft: 14 }}>
                      {errors.psaFile}
                    </span>
                  )}
                </div>

                {/* Report Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 18,
                  }}
                >
                  <label style={{ width: 200, marginRight: 18 }}>
                    Report Card / Form 138*
                  </label>
                  <input
                    type="file"
                    id="reportCardFileUpload"
                    hidden
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, setReportCardFile, 'reportCardFile')
                    }
                    required
                  />
                  <label
                    htmlFor="reportCardFileUpload"
                    className="upload-btn-Card"
                    style={{ marginRight: 14 }}
                  >
                    Upload File
                  </label>
                  {reportCardFile && (
                    <>
                      {isImage(reportCardFile) ? (
                        <img
                          style={{ marginRight: 14 }}
                          src={cardUrl}
                          alt="Report Card Preview"
                          className="file-preview"
                        />
                      ) : (
                        <embed
                          style={{ marginRight: 14 }}
                          src={cardUrl}
                          type="application/pdf"
                          width="120"
                          height="160"
                        />
                      )}
                      <span>{reportCardFile.name}</span>
                    </>
                  )}
                  {errors.reportCardFile && (
                    <span className="error" style={{ marginLeft: 14 }}>
                      {errors.reportCardFile}
                    </span>
                  )}
                </div>

                {/* SF10 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 18,
                  }}
                >
                  <label style={{ width: 200, marginRight: 18 }}>
                    SF10 (from previous school)*
                  </label>
                  <input
                    type="file"
                    id="sf10FileUpload"
                    hidden
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, setSf10File, 'sf10File')
                    }
                    required
                  />
                  <label
                    htmlFor="sf10FileUpload"
                    className="upload-btn-SF10"
                    style={{ marginRight: 14 }}
                  >
                    Upload File
                  </label>
                  {sf10File && (
                    <>
                      {isImage(sf10File) ? (
                        <img
                          style={{ marginRight: 14 }}
                          src={sf10Url}
                          alt="SF10 Preview"
                          className="file-preview"
                        />
                      ) : (
                        <embed
                          style={{ marginRight: 14 }}
                          src={sf10Url}
                          type="application/pdf"
                          width="120"
                          height="160"
                        />
                      )}
                      <span>{sf10File.name}</span>
                    </>
                  )}
                  {errors.sf10File && (
                    <span className="error" style={{ marginLeft: 14 }}>
                      {errors.sf10File}
                    </span>
                  )}
                </div>

                {/* ID Photo (images only) */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ width: 200, marginRight: 18 }}>
                    ID Photo*
                  </label>
                  <input
                    type="file"
                    id="idPhotoFileUpload"
                    hidden
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) =>
                      handleFileChange(e, setIdPhotoFile, 'idPhotoFile')
                    }
                    required
                  />
                  <label
                    htmlFor="idPhotoFileUpload"
                    className="upload-btn-ID"
                    style={{ marginRight: 14 }}
                  >
                    Upload File
                  </label>
                  {idPhotoFile && isImage(idPhotoFile) && (
                    <>
                      <img
                        style={{ marginRight: 14 }}
                        src={idUrl}
                        alt="ID Photo Preview"
                        className="file-preview"
                      />
                      <span>{idPhotoFile.name}</span>
                    </>
                  )}
                  {errors.idPhotoFile && (
                    <span className="error" style={{ marginLeft: 14 }}>
                      {errors.idPhotoFile}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="buttons_Container">
              <div className="buttons">
                <button type="button" onClick={handleBack}>
                  Back
                </button>
                <button type="button" onClick={handleNext}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="agreementContainer">
            <div className="stepper">
              <h2>Step 4 out of 4</h2>
            </div>
            <div className="agreement">
              <p>
                As the parent/guardian of the above-named student, I hereby
                acknowledge and agree to the following:
              </p>
              <ol>
                <li>
                  <strong>Commitment to Education</strong>
                  <ul>
                    <li>
                      I will support my child’s regular attendance, punctuality,
                      and participation in school activities.
                    </li>
                    <li>
                      I will encourage my child to complete assignments,
                      projects, and requirements on time.
                    </li>
                    <li>
                      I will provide a conducive learning environment at home.
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Conduct and Discipline</strong>
                  <ul>
                    <li>
                      I understand that my child is expected to follow the
                      school’s rules, regulations, and code of conduct.
                    </li>
                    <li>
                      I will cooperate with teachers and school administrators
                      in addressing any behavioral or academic issues.
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Communication and Cooperation</strong>
                  <ul>
                    <li>
                      I will attend parent-teacher meetings, orientations, and
                      conferences when required.
                    </li>
                    <li>
                      I will promptly inform the school of any changes in
                      contact information, health conditions, or family matters
                      that may affect my child’s schooling.
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Financial Responsibilities</strong>
                  <ul>
                    <li>
                      I agree to settle school fees and other school-related
                      obligations on or before the deadlines set by the school.
                    </li>
                    <li>
                      I understand that failure to fulfill financial
                      responsibilities may affect my child’s enrollment status.
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Safety and Welfare</strong>
                  <ul>
                    <li>
                      I authorize the school to take appropriate action in case
                      of emergency, accident, or illness involving my child.
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
            <p>
              <strong>Acknowledgement</strong>
            </p>
            <div className="acknowledge_Infos">
              <div className="acknowledge_Info">
                <input
                  type="checkbox"
                  checked={checkedPolicies.policy1}
                  onChange={(e) =>
                    setCheckedPolicies((prev) => ({
                      ...prev,
                      policy1: e.target.checked,
                    }))
                  }
                />
                <label>
                  I have read, understood, and agreed to abide by the policies,
                  rules, and regulations of the school.
                </label>
                {errors.policies && <p className="error">{errors.policies}</p>}
              </div>
              <div className="acknowledge_Info">
                <input
                  type="checkbox"
                  checked={checkedPolicies.policy2}
                  onChange={(e) =>
                    setCheckedPolicies((prev) => ({
                      ...prev,
                      policy2: e.target.checked,
                    }))
                  }
                />
                <label>
                  I understand that enrollment signifies acceptance of this
                  agreement.
                </label>
              </div>
            </div>
            <p style={{ fontSize: '17px' }}>
              Please upload a valid Government-issued ID to continue.
            </p>
            <div className="upload_ID">
              <div className="id_Select">
                <label>Government Id</label>
                <select
                  value={governmentIdType}
                  onChange={(e) => setGovernmentIdType(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select ID
                  </option>
                  <option>Passport</option>
                  <option>National ID / PhilSys</option>
                  <option>Voter's ID</option>
                  <option>UMID</option>
                  <option>SSS ID</option>
                  <option>GSIS e-Card</option>
                  <option>Driver's License</option>
                  <option>PRC ID</option>
                  <option>PhilHealth ID</option>
                  <option>Postal ID</option>
                  <option>Senior Citizen ID</option>
                  <option>PWD ID</option>
                  <option>Police Clearance</option>
                  <option>NBI Clearance</option>
                  <option>BIR/TIN ID</option>
                  <option>Barangay ID</option>
                  <option>Company ID (Government employee)</option>
                  <option>OWWA ID</option>
                  <option>Pag-IBIG Loyalty Card</option>
                  <option>iDOLE Card</option>
                  <option>Solo Parent ID</option>
                  <option>Seaman’s Book</option>
                </select>
                {errors.governmentIdType && (
                  <p className="error">{errors.governmentIdType}</p>
                )}
              </div>

              <div className="government_ID_Upload">
                <input
                  type="file"
                  id="govIdFileUpload"
                  hidden
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) =>
                    handleFileChange(e, setGovIdFile, 'govIdFile')
                  }
                />
                <label htmlFor="govIdFileUpload" className="upload-btn-Gov-ID">
                  Upload File
                </label>

                {govIdFile && (
                  <div
                    className="idImage"
                    style={{ marginLeft: 14, marginTop: 10 }}
                  >
                    {isImage(govIdFile) ? (
                      <img
                        src={govIdUrl}
                        alt="Government ID Preview"
                        className="file-preview"
                      />
                    ) : (
                      <embed
                        src={govIdUrl}
                        type="application/pdf"
                        width="120"
                        height="160"
                      />
                    )}
                  </div>
                )}

                {errors.govIdFile && (
                  <p className="error">{errors.govIdFile}</p>
                )}
              </div>
            </div>
            <div className="buttons_Container">
              <div className="buttons">
                <button onClick={handleBack}>Back</button>
                {/*   <button onClick={handleSubmit}>Submit</button>*/}
                <button
                  onClick={() => {
                    console.log('SUBMIT BUTTON CLICKED');
                    handleSubmit();
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Enrollment_Container>
  );
};
