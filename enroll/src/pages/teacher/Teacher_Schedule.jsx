// src/pages/Teacher_Schedule.jsx
import { useEffect, useState, useRef } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './teacher_schedule.css';
import TeacherSchedule_Solo from '../../components/teacher_comp/TeacherSchedule_Solo';

export const Teacher_Schedule = () => {
  const [appUserId, setAppUserId] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    const idStr = localStorage.getItem('app_user_id');
    if (idStr != null) {
      const idNum = Number(idStr);
      if (!Number.isNaN(idNum)) setAppUserId(idNum);
    }
  }, []);

  // CSS-based print using @media print rules (hides app chrome, shows only #print-schedule)
  const onPrint = () => {
    if (printRef.current) printRef.current.focus();
    window.print();
  };

  // Clean print via hidden iframe to avoid popup timing/blank-page issues
  const onPrintClean = () => {
    const src = document.getElementById('print-schedule');
    if (!src || !src.innerHTML.trim()) {
      alert('Schedule is not ready to print yet.');
      return;
    }

    // Create a hidden iframe in the same tab
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'print');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    // Copy existing page styles to preserve table look
    const copyLinks = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    )
      .map((l) => `<link rel="stylesheet" href="${l.href}">`)
      .join('');

    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Daily Schedule</title>
    ${copyLinks}
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      html, body { background: #fff; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px; }
    </style>
  </head>
  <body>${src.innerHTML}</body>
</html>`);
    doc.close();

    const finish = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 100);
    };

    if (doc.readyState === 'complete') {
      setTimeout(finish, 150);
    } else {
      iframe.onload = () => setTimeout(finish, 150);
    }
  };

  return (
    <>
      <Header userRole="teacher" />
      <Navigation_Bar userRole="teacher" />
      <div className="teacherScheduleContainer">
        <div className="headerRow">
          <h2 style={{ margin: 0 }}>Daily Schedule</h2>
          <div className="actions" style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onPrintClean}
              className="printBtn"
              title="Print schedule (clean iframe)"
              disabled={appUserId == null}
            >
              Print
            </button>
          </div>
        </div>

        {/* Only this block prints with the CSS method */}
        <div className="scheduleArea" ref={printRef} id="print-schedule">
          <div className="scheduleContainer">
            {appUserId != null ? (
              <TeacherSchedule_Solo userId={appUserId} />
            ) : (
              <div className="faculty-card">
                <div className="faculty_card_header_grade8"></div>
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
