import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import AlreadyEnrolledModal from '../../components/modals/AlreadyEnrolledModal';
import './applicant_homepage.css';
import { supabase } from '../../supabaseClient';

export const Applicant_Homepage = () => {
  const [enrollment, setEnrollment] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    supabase
      .from('students')
      .select('student_id, applicant_id')
      .eq('user_id', userId)
      .single()
      .then(async ({ data: student, error }) => {
        if (error) {
          console.error('Student fetch error:', error);
          return;
        }
        if (student && student.applicant_id) {
          const { data: enroll, error: enrollError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('applicant_id', student.applicant_id)
            .order('application_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (enrollError) {
            console.error('Enrollment fetch error:', enrollError);
            return;
          }
          if (enroll) {
            setEnrollment(enroll);
          }
        }
      });
  }, []);

  const handleProceed = () => {
    navigate('/Applicant_enroll1');
  };
  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    supabase
      .from('students')
      .select('student_id, applicant_id, first_name, last_name, lrn, gender') // Fetch more fields as needed
      .eq('user_id', userId)
      .single()
      .then(async ({ data: studentData, error }) => {
        if (error) {
          console.error('Student fetch error:', error);
          return;
        }
        setStudent(studentData);
        if (studentData && studentData.applicant_id) {
          const { data: enroll, error: enrollError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('applicant_id', studentData.applicant_id)
            .order('application_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (enrollError) {
            console.error('Enrollment fetch error:', enrollError);
            return;
          }
          if (enroll) {
            setEnrollment(enroll);
          }
        }
      });
  }, []);
  return (
    <>
      <Header userRole="applicant" />
      <Navigation_Bar />
      <Navigation_Bar userRole="applicant" />

      <AlreadyEnrolledModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <div className="mainContent">
        <div className="background">
          <div className="noticeBox">
            <div className="notice">
              <h2>NOTICE OF ENROLLMENT</h2>
              <p>
                This is to formally inform all parents/guardians that the
                Enrollment System is open and currently accepting applications
                for the upcoming school year. You may proceed by completing the
                online enrollment form and uploading all required documents
                through this system. Please be reminded that applications will
                be processed on a first come, first served basis, subject to the
                availability of slots.
                <br />
                Thank you for your continued trust and support.
              </p>
            </div>
            <div className="buttonContainer">
              <button
                onClick={() => {
                  if (enrollment) {
                    setModalOpen(true); // Show modal if already enrolled
                  } else {
                    handleProceed(); // Go to form if not enrolled yet
                  }
                }}
              >
                Proceed to enrollment
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
                    src="/pending.png"
                    alt="Pending Icon"
                    style={{
                      width: '18px',
                      height: '18px',
                      marginRight: '6px',
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

                <div className="enroll-actions">
                  <button>View Application</button>
                </div>
              </div>

              {/* Bottom row: Next Step */}
              <div className="enroll-card-row" style={{ marginTop: '8px' }}>
                <div>
                  <strong>Next Step:</strong> Please wait for verification. You
                  will receive an email once reviewed.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
