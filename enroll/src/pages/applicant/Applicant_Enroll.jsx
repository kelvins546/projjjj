import { useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Enrollment_Container } from '../../components/containers/Enrollment_Container';
import { Enrollment_Form } from '../../components/forms/Enrollment_Form';
import './applicant_enroll.css';
import { DateTime } from 'luxon';

export const Applicant_Enroll1 = () => {
  const [step, setStep] = useState(1);

  // Log current Manila time in ISO format
  const manilaNow = DateTime.now().setZone('Asia/Manila').toISO();
  console.log('Current Manila Time:', manilaNow);

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
        <Enrollment_Form step={step} setStep={setStep} />
      </div>
    </>
  );
};
