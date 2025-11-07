// components/SubNav.jsx
import { useLocation } from 'react-router-dom';
import './navigationbar.css';

export const Sub_Nav = ({ activeSection, onSectionChange, items }) => {
  const location = useLocation();
  const path = (location.pathname || '').toLowerCase();

  // 1) If items are provided, use them (explicit override from parent)
  if (Array.isArray(items) && items.length > 0) {
    return (
      <div className="dashboard-sub-nav">
        {items.map(({ key, id, label }) => {
          const sectionId = key || id;
          return (
            <span
              key={sectionId}
              className={`sub-nav-item ${activeSection === sectionId ? 'active' : ''}`}
              onClick={() => onSectionChange(sectionId)}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  // 2) Route-based presets (fallbacks)
  let sections = [];

  if (path === '/dashboard') {
    sections = [
      { id: 'enrollmentOverview', label: 'Enrollment Overview' },
      { id: 'studentDistribution', label: 'Student Distribution' },
      { id: 'facultyAssignment', label: 'Faculty Assignment' },
      { id: 'gradingSummary', label: 'Grading Summary' },
    ];
  } else if (path === '/analytics') {
    sections = [
      { id: 'enrollmentForecast', label: 'Enrollment Forecast' },
      { id: 'dropoutTrend', label: 'Dropout Trend' },
    ];
  } else if (path === '/placement') {
    sections = [
      { id: 'sectionList', label: 'Section List' },
      { id: 'studentList', label: 'Student List' },
    ];
  } else if (
    path === '/scheduling' ||
    path.endsWith('/scheduling') ||
    path.includes('/admin-scheduling')
  ) {
    // New: Scheduling tabs (match Admin-Scheduling viewMode keys)
    sections = [
      { id: 'teacherSchedules', label: 'Teacher Schedules' },
      { id: 'sectionSchedules', label: 'Section Schedules' },
    ];
  } else {
    return null;
  }

  return (
    <div className="dashboard-sub-nav">
      {sections.map(({ id, label }) => (
        <span
          key={id}
          className={`sub-nav-item ${activeSection === id ? 'active' : ''}`}
          onClick={() => onSectionChange(id)}
        >
          {label}
        </span>
      ))}
    </div>
  );
};
