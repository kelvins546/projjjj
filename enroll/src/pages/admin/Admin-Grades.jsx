// src/pages/admin/Admin_Grades.jsx
import './admin_grades.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { useEffect, useMemo, useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import { supabase } from '../../supabaseClient';

const STATIC_SY = '2025-2026';

export const Admin_Grades = () => {
  const [showMassLock, setShowMassLock] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showUnlockNotif, setShowUnlockNotif] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showRemoveNotif, setShowRemoveNotif] = useState(false);
  const [manageEncoding, setShowManageEncoding] = useState(false);
  const [applyChanges, setShowApplyChanges] = useState(false);
  const [applyNotif, setShowApplyNotif] = useState(false);
  const [search, setSearch] = useState('');
  const [quarter, setQuarter] = useState('1');
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [massUnlockDate, setMassUnlockDate] = useState('');
  const [massUnlockEndDate, setMassUnlockEndDate] = useState('');
  const [massUnlockGrades, setMassUnlockGrades] = useState(new Set());
  const [encodingWindows, setEncodingWindows] = useState({});
  const nowISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: tsRows, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select(
            'teacher_subject_id, teacher_id, subject_id, section_id, school_year, is_hgp'
          )
          .eq('school_year', STATIC_SY)
          .eq('is_hgp', false);

        if (tsErr) throw tsErr;
        if (!tsRows || tsRows.length === 0) {
          if (mounted) {
            setRows([]);
            setEncodingWindows({});
          }
          setLoading(false);
          return;
        }

        const teacherIds = [
          ...new Set(tsRows.map((r) => r.teacher_id).filter(Boolean)),
        ];
        const sectionIds = [
          ...new Set(tsRows.map((r) => r.section_id).filter(Boolean)),
        ];

        const { data: teachers } = await supabase
          .from('teachers')
          .select('teacher_id, user_id, department_id')
          .in('teacher_id', teacherIds);
        const teacherUserIds = [
          ...new Set((teachers || []).map((t) => t.user_id).filter(Boolean)),
        ];
        const { data: teacherUsers } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', teacherUserIds);
        const deptIds = [
          ...new Set(
            (teachers || []).map((t) => t.department_id).filter(Boolean)
          ),
        ];
        const { data: departments } = await supabase
          .from('departments')
          .select('department_id, name')
          .in('department_id', deptIds);
        const { data: sections } = await supabase
          .from('sections')
          .select('section_id, name, grade_level, adviser_id')
          .in('section_id', sectionIds);
        const adviserIds = [
          ...new Set((sections || []).map((s) => s.adviser_id).filter(Boolean)),
        ];
        const { data: advisers } = await supabase
          .from('teachers')
          .select('teacher_id, user_id')
          .in('teacher_id', adviserIds);
        const adviserUserIds = [
          ...new Set((advisers || []).map((a) => a.user_id).filter(Boolean)),
        ];
        const { data: adviserUsers } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', adviserUserIds);

        const teacherUserMap = new Map(
          (teacherUsers || []).map((u) => [u.user_id, u])
        );
        const deptMap = new Map(
          (departments || []).map((d) => [d.department_id, d.name])
        );
        const adviserUserMap = new Map(
          (adviserUsers || []).map((u) => [u.user_id, u])
        );
        const adviserMap = new Map(
          (advisers || []).map((a) => [a.teacher_id, a.user_id])
        );

        const teacherMap = new Map(
          (teachers || []).map((t) => {
            const user = teacherUserMap.get(t.user_id);
            return [
              t.teacher_id,
              {
                name: user
                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                  : '—',
                department: deptMap.get(t.department_id) || '—',
              },
            ];
          })
        );

        const sectionMap = new Map(
          (sections || []).map((s) => {
            const adviserUserId = adviserMap.get(s.adviser_id);
            const adviserUser = adviserUserId
              ? adviserUserMap.get(adviserUserId)
              : null;
            return [
              s.section_id,
              {
                name: s.name || '—',
                grade_level: Number(s.grade_level) || null,
                adviser: adviserUser
                  ? `${adviserUser.first_name || ''} ${adviserUser.last_name || ''}`.trim()
                  : '—',
              },
            ];
          })
        );

        const dataset = tsRows.map((r) => {
          const teacher = teacherMap.get(r.teacher_id) || {
            name: '—',
            department: '—',
          };
          const section = sectionMap.get(r.section_id) || {
            name: '—',
            grade_level: null,
            adviser: '—',
          };
          return {
            key: `ts:${r.teacher_subject_id}`,
            teacher_subject_id: r.teacher_subject_id,
            teacher_name: teacher.name,
            adviser_name: section.adviser,
            grade_level: section.grade_level,
            section_id: r.section_id,
            section_name: section.name,
            subject_id: r.subject_id,
            subject_name: teacher.department,
          };
        });

        const tsIds = dataset.map((d) => d.teacher_subject_id);
        let statusByTs = new Map();
        if (tsIds.length) {
          const qNum = Number(quarter);
          const { data: gRows, error: gErr } = await supabase
            .from('grades')
            .select('teacher_subject_id, quarter, adviser_approved')
            .eq('school_year', STATIC_SY)
            .eq('quarter', qNum)
            .in('teacher_subject_id', tsIds);
          if (gErr) throw gErr;
          const grouped = new Map();
          (gRows || []).forEach((g) => {
            const list = grouped.get(g.teacher_subject_id) || [];
            list.push(g);
            grouped.set(g.teacher_subject_id, list);
          });
          grouped.forEach((list, tsid) => {
            const hasAny = list.length > 0;
            const approved = list.some((x) => !!x.adviser_approved);
            const status = hasAny
              ? approved
                ? 'Approved by adviser'
                : 'Submitted to adviser'
              : 'No submission';
            statusByTs.set(tsid, status);
          });
        }

        const merged = dataset.map((d) => ({
          ...d,
          quarter: quarter,
          status: statusByTs.get(d.teacher_subject_id) || 'No submission',
        }));

        const { data: encodingData } = await supabase
          .from('encoding_windows')
          .select('grade_level, start_date, end_date, is_locked')
          .eq('school_year', STATIC_SY)
          .eq('quarter', Number(quarter));

        const windows = {};
        if (encodingData && encodingData.length > 0) {
          encodingData.forEach((w) => {
            if (!w.is_locked) {
              windows[w.grade_level] = {
                from: w.start_date,
                until: w.end_date,
              };
            }
          });
        }

        if (mounted) {
          setRows(merged);
          setEncodingWindows(windows);
        }
      } catch (e) {
        console.error('Error loading data:', e);
        if (mounted) {
          setRows([]);
          setEncodingWindows({});
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [quarter]);

  const gradeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.grade_level).filter(Boolean));
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const sectionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.section_name).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const subjectOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.subject_name).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.status));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [
          r.teacher_name || '',
          r.adviser_name || '',
          r.section_name || '',
          r.subject_name || '',
          `G${r.grade_level || ''}`,
          r.status || '',
          `Q${r.quarter}`,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (gradeFilter)
      list = list.filter((r) => Number(r.grade_level) === Number(gradeFilter));
    if (sectionFilter)
      list = list.filter((r) => r.section_name === sectionFilter);
    if (subjectFilter)
      list = list.filter((r) => r.subject_name === subjectFilter);
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [rows, search, gradeFilter, sectionFilter, subjectFilter, statusFilter]);

  const isUnlocked = (gradeLevel) => {
    const w = encodingWindows[gradeLevel];
    if (!w || !w.from || !w.until) return false;
    return nowISO >= w.from && nowISO <= w.until;
  };

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(visible.map((r) => r.teacher_subject_id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleOne = (tsid, checked) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tsid);
      else next.delete(tsid);
      return next;
    });
  };

  const openManage = (row) => {
    setSelectedRecord(row);
    setShowManageEncoding(true);
  };

  const confirmApplyEncoding = () => {
    setShowApplyChanges(false);
    setShowApplyNotif(true);
  };

  const handleRemoveAllGrades = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('school_year', STATIC_SY)
        .eq('quarter', Number(quarter));

      if (error) throw error;

      setRows((prev) => prev.map((r) => ({ ...r, status: 'No submission' })));

      setShowRemoveConfirm(false);
      setShowRemoveNotif(true);
    } catch (e) {
      console.error('Error removing grades:', e);
      alert('Failed to remove grades: ' + e.message);
    } finally {
      setRemoving(false);
    }
  };

  const onUnlockMass = () => {
    if (!massUnlockDate) {
      alert('Please select a start date');
      return;
    }

    if (massUnlockGrades.size === 0) {
      alert('Please select at least one grade level');
      return;
    }

    setShowMassLock(false);
    setShowUnlockConfirm(true);
  };

  const confirmMassUnlock = async () => {
    const from = massUnlockDate || nowISO;
    const until = massUnlockEndDate || massUnlockDate || nowISO;

    try {
      const qNum = Number(quarter);
      const userId = Number(
        localStorage.getItem('user_id') || localStorage.getItem('app_user_id')
      );

      for (const gradeLevel of Array.from(massUnlockGrades)) {
        const { error } = await supabase.from('encoding_windows').upsert(
          {
            grade_level: Number(gradeLevel),
            school_year: STATIC_SY,
            quarter: qNum,
            start_date: from,
            end_date: until,
            is_locked: false,
            created_by: userId,
          },
          { onConflict: 'grade_level,school_year,quarter' }
        );

        if (error) throw error;
      }

      setEncodingWindows((prev) => {
        const next = { ...prev };
        Array.from(massUnlockGrades).forEach((g) => {
          next[Number(g)] = { from, until };
        });
        return next;
      });

      setMassUnlockGrades(new Set());
      setMassUnlockDate('');
      setMassUnlockEndDate('');

      setShowUnlockConfirm(false);
      setShowUnlockNotif(true);
    } catch (e) {
      console.error('Error unlocking grades:', e);
      alert('Failed to unlock encoding: ' + e.message);
      setShowUnlockConfirm(false);
    }
  };

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <div className="gradingContainer">
        <h2>Grading</h2>
        <div className="gradingSearchSection">
          <div className="gradingSearch">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="gradingSearchBar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="gradingSorter">
          <div className="sort">
            <label>Quarter</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={loading}
            >
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
            </select>
          </div>
          <div className="sort">
            <label>Grade Level</label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{`Grade ${g}`}</option>
              ))}
            </select>
          </div>
          <div className="sort">
            <label>Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sort">
            <label>Faculty/Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sort">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="gradingTableContainer">
          <div className="gradingTableHeader">
            <label>
              <input
                type="checkbox"
                checked={
                  visible.length > 0 && selectedRows.size === visible.length
                }
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={loading || visible.length === 0}
              />{' '}
              Select All
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="massLockBtn"
                onClick={() => setShowMassLock(true)}
                disabled={loading}
              >
                Unlock Grade Encoding
              </button>
              <button
                className="massLockBtn"
                style={{ backgroundColor: '#d9534f', borderColor: '#d9534f' }}
                onClick={() => setShowRemoveConfirm(true)}
                disabled={loading || visible.length === 0}
              >
                Remove All Grades
              </button>
            </div>
          </div>

          {showMassLock && (
            <div className="massLockOverlay">
              <div className="massLockModal">
                <h2>Grade Encoding</h2>
                <p>Select the grade level to unlock:</p>
                <div className="lockDuration">
                  <label>Unlock Duration (Start Date):</label>
                  <input
                    className="calendar"
                    type="date"
                    value={massUnlockDate}
                    onChange={(e) => setMassUnlockDate(e.target.value)}
                  />
                </div>
                <div className="lockDuration">
                  <label>Until Date:</label>
                  <input
                    className="calendar"
                    type="date"
                    value={massUnlockEndDate}
                    onChange={(e) => setMassUnlockEndDate(e.target.value)}
                  />
                </div>
                <div className="massLockOptions">
                  {[7, 8, 9, 10].map((g) => (
                    <label key={g}>
                      <input
                        type="checkbox"
                        name="grade"
                        checked={massUnlockGrades.has(g)}
                        onChange={(e) => {
                          setMassUnlockGrades((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(g);
                            else next.delete(g);
                            return next;
                          });
                        }}
                      />{' '}
                      {`Grade ${g}`}
                    </label>
                  ))}
                </div>
                <div className="massLockActions">
                  <button
                    className="cancelBtn"
                    onClick={() => {
                      setShowMassLock(false);
                      setMassUnlockGrades(new Set());
                      setMassUnlockDate('');
                      setMassUnlockEndDate('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="lockBtn"
                    onClick={onUnlockMass}
                    disabled={massUnlockGrades.size === 0 || !massUnlockDate}
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          )}

          <table className="grading-table">
            <thead>
              <tr>
                <th className="column1"></th>
                <th>Name of teacher</th>
                <th>Advisers</th>
                <th>Grade Level</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Quarter</th>
                <th>Status</th>
                <th>Encoding Window</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>Loading…</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={10}>No records found</td>
                </tr>
              ) : (
                visible.map((r) => {
                  const enc = isUnlocked(r.grade_level) ? 'Unlocked' : 'Locked';
                  return (
                    <tr key={r.key}>
                      <td className="column1">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(r.teacher_subject_id)}
                          onChange={(e) =>
                            toggleOne(r.teacher_subject_id, e.target.checked)
                          }
                        />
                      </td>
                      <td>{r.teacher_name}</td>
                      <td>{r.adviser_name}</td>
                      <td>{r.grade_level || '—'}</td>
                      <td>{r.section_name}</td>
                      <td>{r.subject_name}</td>
                      <td>
                        {`${r.quarter}st`
                          .replace('1stst', '1st')
                          .replace('2st', '2nd')
                          .replace('3st', '3rd')
                          .replace('4st', '4th')}
                      </td>
                      <td>
                        <div
                          className={`status ${r.status.includes('Approved') ? 'approved' : r.status.includes('Submitted') ? 'submitted' : 'no-submission'}`}
                        >
                          {r.status}
                        </div>
                      </td>
                      <td>
                        <div className={`encoding ${enc.toLowerCase()}`}>
                          {enc}
                        </div>
                      </td>
                      <td>
                        <button onClick={() => openManage(r)}>
                          Manage Encoding
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {manageEncoding && selectedRecord && (
            <div className="manageEncodingOverlay">
              <div className="manageEncodingModal">
                <div className="backButton">
                  <i
                    className="fa fa-times"
                    aria-hidden="true"
                    onClick={() => setShowManageEncoding(false)}
                  ></i>
                </div>
                <h2>Manage Encoding Window</h2>
                <div className="teacherInfoContainer">
                  <div className="teacherInfoCard">
                    <div
                      className={`teacherInfoCardHeader grade${selectedRecord.grade_level || ''}`}
                    ></div>
                    <div className="teacherInfoCardData">
                      <h3>{`Name: ${selectedRecord.teacher_name}`}</h3>
                      <p>{`Department: ${selectedRecord.subject_name}`}</p>
                      <p>{`Advisory Class: ${selectedRecord.section_name}`}</p>
                      <p>{`Grade: ${selectedRecord.grade_level || '—'}`}</p>
                    </div>
                  </div>
                  <div className="statusTagsCard">
                    <div className="status submitted">
                      <p>Submitted to Adviser</p>
                    </div>
                    <div className="status approved">
                      <p>Approved by Adviser</p>
                    </div>
                    <div className="encoding unlocked">
                      <p>Unlocked</p>
                    </div>
                    <div className="encoding locked">
                      <p>Locked</p>
                    </div>
                  </div>
                </div>
                <div className="encodingAccessBox">
                  <h3>Encoding Access</h3>
                  <div className="encodingActionBtns">
                    <button
                      className="unlockBtn"
                      style={{
                        color: '#28a745',
                        border: '1px solid #28a745',
                        backgroundColor: '#f6fff6',
                      }}
                      onClick={async () => {
                        const g = selectedRecord.grade_level;
                        if (!g) return;
                        const from = encodingWindows[g]?.from || nowISO;
                        const until = encodingWindows[g]?.until || nowISO;
                        try {
                          const userId = Number(
                            localStorage.getItem('user_id') ||
                              localStorage.getItem('app_user_id')
                          );
                          const { error } = await supabase
                            .from('encoding_windows')
                            .upsert(
                              {
                                grade_level: g,
                                school_year: STATIC_SY,
                                quarter: Number(quarter),
                                start_date: from,
                                end_date: until,
                                is_locked: false,
                                created_by: userId,
                              },
                              { onConflict: 'grade_level,school_year,quarter' }
                            );
                          if (error) throw error;
                          setEncodingWindows((prev) => ({
                            ...prev,
                            [g]: { from, until },
                          }));
                          alert('Encoding unlocked successfully!');
                        } catch (e) {
                          console.error('Error unlocking:', e);
                          alert('Failed to unlock: ' + e.message);
                        }
                      }}
                    >
                      <i className="fa fa-unlock"></i> Unlock
                    </button>
                    <button
                      className="lockBtn"
                      style={{
                        color: '#d9534f',
                        border: '1px solid #d9534f',
                        backgroundColor: '#fff5f5',
                      }}
                      onClick={async () => {
                        const g = selectedRecord.grade_level;
                        if (!g) return;
                        try {
                          const { error } = await supabase
                            .from('encoding_windows')
                            .update({ is_locked: true })
                            .eq('grade_level', g)
                            .eq('school_year', STATIC_SY)
                            .eq('quarter', Number(quarter));
                          if (error) throw error;
                          setEncodingWindows((prev) => {
                            const next = { ...prev };
                            delete next[g];
                            return next;
                          });
                          alert('Encoding locked successfully!');
                        } catch (e) {
                          console.error('Error locking:', e);
                          alert('Failed to lock: ' + e.message);
                        }
                      }}
                    >
                      <i className="fa fa-lock"></i> Lock
                    </button>
                  </div>
                  <div className="manageEncodingDateInputs">
                    <div>
                      <label>Effective from</label>
                      <input
                        className="calendar"
                        type="date"
                        value={
                          encodingWindows[selectedRecord.grade_level]?.from ||
                          ''
                        }
                        onChange={(e) => {
                          const g = selectedRecord.grade_level;
                          const val = e.target.value;
                          setEncodingWindows((prev) => ({
                            ...prev,
                            [g]: { from: val, until: prev[g]?.until || val },
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label>Effective until</label>
                      <input
                        className="calendar"
                        type="date"
                        value={
                          encodingWindows[selectedRecord.grade_level]?.until ||
                          ''
                        }
                        onChange={(e) => {
                          const g = selectedRecord.grade_level;
                          const val = e.target.value;
                          setEncodingWindows((prev) => ({
                            ...prev,
                            [g]: { from: prev[g]?.from || val, until: val },
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="manageEncodingMessageBox">
                    <label>Message/Reason</label>
                    <textarea placeholder="e.g. Allow encoding for extension..." />
                  </div>
                  <div className="manageEncodingNotifyBox">
                    <input type="checkbox" id="notify" />
                    <label htmlFor="notify">Notify by Email</label>
                  </div>
                </div>
                <div className="manageEncodingButtonContainer">
                  <button onClick={() => setShowManageEncoding(false)}>
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const g = selectedRecord.grade_level;
                      if (!g) {
                        setShowManageEncoding(false);
                        return;
                      }
                      const window = encodingWindows[g];
                      if (!window || !window.from || !window.until) {
                        alert('Please set both start and end dates');
                        return;
                      }
                      try {
                        const userId = Number(
                          localStorage.getItem('user_id') ||
                            localStorage.getItem('app_user_id')
                        );
                        const { error } = await supabase
                          .from('encoding_windows')
                          .upsert(
                            {
                              grade_level: g,
                              school_year: STATIC_SY,
                              quarter: Number(quarter),
                              start_date: window.from,
                              end_date: window.until,
                              is_locked: false,
                              created_by: userId,
                            },
                            { onConflict: 'grade_level,school_year,quarter' }
                          );
                        if (error) throw error;
                        setShowManageEncoding(false);
                        setShowApplyChanges(true);
                      } catch (e) {
                        console.error('Error saving encoding window:', e);
                        alert('Failed to save encoding window: ' + e.message);
                      }
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          <ReusableModalBox
            show={applyChanges}
            onClose={() => setShowApplyChanges(false)}
          >
            <div className="applyConfirmation">
              <div className="applyConfirmationTitle">
                <h2>Apply Changes</h2>
              </div>
              <div className="buttonContainer">
                <button
                  onClick={() => setShowApplyChanges(false)}
                  style={{
                    border: '1px solid black',
                    backgroundColor: 'transparent',
                    color: 'black',
                  }}
                >
                  Cancel
                </button>
                <button onClick={confirmApplyEncoding}>Apply</button>
              </div>
            </div>
          </ReusableModalBox>

          <ReusableModalBox
            show={applyNotif}
            onClose={() => setShowApplyNotif(false)}
          >
            <div className="notif">
              <div className="img" style={{ paddingTop: '10px' }}>
                <img
                  src="checkImg.png"
                  style={{ height: '50px', width: '50px' }}
                />
              </div>
              <div className="notifMessage">
                <span>Changes Applied </span>
                <span>Successfully!</span>
              </div>
            </div>
          </ReusableModalBox>
        </div>
      </div>

      <ReusableModalBox
        show={showUnlockConfirm}
        onClose={() => setShowUnlockConfirm(false)}
      >
        <div className="unlockConfirmation">
          <div className="unlockConfirmationTitle">
            <h2>Unlock Grade encoding for the selected year levels?</h2>
            <p>
              Teachers will be able to encode grades before the encoding
              duration ends.
            </p>
          </div>
          <div className="buttonContainer">
            <button
              onClick={() => setShowUnlockConfirm(false)}
              style={{
                border: '1px solid black',
                backgroundColor: 'transparent',
                color: 'black',
              }}
            >
              Cancel
            </button>
            <button onClick={confirmMassUnlock}>Confirm</button>
          </div>
        </div>
      </ReusableModalBox>

      <ReusableModalBox
        show={showUnlockNotif}
        onClose={() => setShowUnlockNotif(false)}
      >
        <div className="notif">
          <div className="img" style={{ paddingTop: '10px' }}>
            <img
              src="checkImg.png"
              alt="Success"
              style={{ height: '50px', width: '50px' }}
            />
          </div>
          <div className="notifMessage">
            <span>Successfully Unlocked</span>
            <span>the Encoding of Grades!</span>
          </div>
        </div>
      </ReusableModalBox>

      <ReusableModalBox
        show={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
      >
        <div className="unlockConfirmation">
          <div className="unlockConfirmationTitle">
            <h2>Remove All Grades for Quarter {quarter}?</h2>
            <p style={{ color: '#d9534f', fontWeight: 'bold' }}>
              ⚠️ WARNING: This will permanently delete all grades for{' '}
              {STATIC_SY} Quarter {quarter}. This action cannot be undone!
            </p>
          </div>
          <div className="buttonContainer">
            <button
              onClick={() => setShowRemoveConfirm(false)}
              disabled={removing}
              style={{
                border: '1px solid black',
                backgroundColor: 'transparent',
                color: 'black',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveAllGrades}
              disabled={removing}
              style={{ backgroundColor: '#d9534f' }}
            >
              {removing ? 'Removing...' : 'Remove All'}
            </button>
          </div>
        </div>
      </ReusableModalBox>

      <ReusableModalBox
        show={showRemoveNotif}
        onClose={() => setShowRemoveNotif(false)}
      >
        <div className="notif">
          <div className="img" style={{ paddingTop: '10px' }}>
            <img
              src="checkImg.png"
              alt="Success"
              style={{ height: '50px', width: '50px' }}
            />
          </div>
          <div className="notifMessage">
            <span>All Grades Removed</span>
            <span>Successfully!</span>
          </div>
        </div>
      </ReusableModalBox>
    </>
  );
};
