import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Enrollment_Form } from '../../components/forms/Enrollment_Form';
import './applicant_enroll.css';
import { DateTime } from 'luxon';
import { supabase } from '../../supabaseClient';

/* Simple error boundary so UI doesn't crash on runtime errors */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, err: error };
  } // fallback trigger [web:195]
  render() {
    if (this.state.hasError) {
      return (
        <div>Something went wrong in Enrollment Form. Please try again.</div>
      ); // minimal fallback [web:195]
    }
    return this.props.children;
  }
}

export const Applicant_Enroll1 = () => {
  const [step, setStep] = useState(1);
  const location = useLocation();

  // Resubmit context
  const resubmit = !!location.state?.resubmit;
  const resubmitEnrollmentId =
    location.state?.enrollment_id ||
    localStorage.getItem('resubmit_enrollment_id') ||
    null;

  // Prefill payload for text/select fields only
  const [initialData, setInitialData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    date_of_birth: '',
    gender: '',
    address: '',
    citizenship: '',
    mother_tongue: '',
    indigenous_group: '',
  });

  // Log current Manila time in ISO format
  const manilaNow = DateTime.now().setZone('Asia/Manila').toISO();
  console.log('Current Manila Time:', manilaNow);

  useEffect(() => {
    const preload = async () => {
      if (!resubmit) return;

      const userId = localStorage.getItem('user_id');

      // Pull latest student profile fields (students has NO date_of_birth)
      const { data: s, error: sErr } = await supabase
        .from('students')
        .select(
          'student_id,first_name,middle_name,last_name,suffix,gender,address,citizenship,mother_tongue,indigenous_group'
        )
        .eq('user_id', userId)
        .maybeSingle(); // return object or null [web:170]

      if (sErr) console.warn('Student prefill error:', sErr?.message);

      // Birthdate from users table
      const { data: u } = await supabase
        .from('users')
        .select('date_of_birth')
        .eq('user_id', userId)
        .maybeSingle(); // zero-or-one [web:170]

      // Prefill text/select only; no file inputs here
      setInitialData((prev) => ({
        ...prev,
        ...(s || {}),
        date_of_birth: u?.date_of_birth || '',
      }));
    };

    preload();
  }, [resubmit, resubmitEnrollmentId]);

  return (
    <>
      <Header userRole="applicant" />
      <Navigation_Bar />
      <Navigation_Bar userRole="applicant" />
      <div className="mainContent">
        <div className="titleName">
          <h2>
            {step === 4 ? 'Parent/Guardian Agreement Form' : 'Enrollment Form'}
          </h2>
        </div>

        <ErrorBoundary>
          <Enrollment_Form
            step={step}
            setStep={setStep}
            initialData={initialData}
            resubmit={resubmit}
            resubmitEnrollmentId={resubmitEnrollmentId}
          />
        </ErrorBoundary>
      </div>
    </>
  );
};
