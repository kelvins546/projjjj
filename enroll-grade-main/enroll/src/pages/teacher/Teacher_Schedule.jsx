// src/pages/Teacher_Schedule.jsx
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './teacher_schedule.css';
import TeacherSchedule_Gr8 from '../../components/admin_comp/TeacherSchedule_Grade8';

export const Teacher_Schedule = () => {
  const [appUserId, setAppUserId] = useState(null);

  useEffect(() => {
    const idStr = localStorage.getItem('app_user_id'); // "114" or null
    if (idStr != null) {
      const idNum = Number(idStr);
      if (!Number.isNaN(idNum)) setAppUserId(idNum);
    }
  }, []);

  return (
    <>
      <Header userRole="teacher" />
      <Navigation_Bar userRole="teacher" />
      <div className="teacherScheduleContainer">
        <h2>Daily Schedule</h2>
        <div className="scheduleArea">
          <div className="scheduleContainer">
            {appUserId != null ? (
              <TeacherSchedule_Gr8 userId={appUserId} />
            ) : (
              <div className="faculty-card">
                <div className="faculty_card_header_grade7"></div>
                <div className="faculty-card-body">
                  <p>Loading user…</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
