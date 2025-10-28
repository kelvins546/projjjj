import { useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import SectionList from '../../components/admin_comp/SectionList';
import StudentList from '../../components/admin_comp/StudentList';

import { supabase } from '../../supabaseClient';

export const Admin_Placement = () => {
  const [activeSection, setActiveSection] = useState('sectionList');

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <Sub_Nav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className="placement-container">
        {activeSection === 'sectionList' && <SectionList />}
        {activeSection === 'studentList' && <StudentList />}
      </div>
    </>
  );
};
