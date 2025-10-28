import { useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import EnrollmentOverview from '../../components/admin_comp/EnrollmentOverview';
import StudentDistribution from '../../components/admin_comp/StudentDistribution';
import FacultyAssignment from '../../components/admin_comp/FacultyAssignment';
import GradingSummary from '../../components/admin_comp/GradingSummary';
import './dashboard.css';

export const Admin_Dashboard = () => {
  const [activeSection, setActiveSection] = useState('enrollmentOverview');

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <Sub_Nav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className="dashboard-container">
        {activeSection === 'enrollmentOverview' && <EnrollmentOverview />}
        {activeSection === 'studentDistribution' && <StudentDistribution />}
        {activeSection === 'facultyAssignment' && <FacultyAssignment />}
        {activeSection === 'gradingSummary' && <GradingSummary />}
      </div>
    </>
  );
};
