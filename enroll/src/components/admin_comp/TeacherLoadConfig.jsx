import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { ReusableModalBox } from '../modals/Reusable_Modal';
import './teacherLoadConfig.css';

const STATIC_SY = '2025-2026';

export const TeacherLoadConfig = ({ show, onClose }) => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // NEW: Advisory filter: 'all' | 'advisory' | 'nonAdvisory'
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (show) loadTeachers();
  }, [show]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select(
          // include advisory_section_id so we can identify advisers
          'teacher_id, user_id, employee_number, position, advisory_section_id, department:departments(name, department_id)'
        )
        .eq('is_active', true)
        .order('employee_number');

      const userIds = (teacherData || []).map((t) => t.user_id);
      const { data: userData } = await supabase
        .from('users')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const { data: loadData } = await supabase
        .from('teacher_loads')
        .select('teacher_id, max_load, current_load')
        .eq('school_year', STATIC_SY);

      const userMap = new Map(
        (userData || []).map((u) => [
          u.user_id,
          `${u.first_name} ${u.last_name}`,
        ])
      );
      const loadMap = new Map((loadData || []).map((l) => [l.teacher_id, l]));

      const combined = (teacherData || []).map((t) => ({
        teacher_id: t.teacher_id,
        name: userMap.get(t.user_id) || 'Unknown',
        employee_number: t.employee_number || '',
        position: t.position || '',
        department: t.department?.name || 'N/A',
        department_id: t.department?.department_id,
        max_load: loadMap.get(t.teacher_id)?.max_load ?? 6,
        current_load: loadMap.get(t.teacher_id)?.current_load ?? 0,
        is_adviser: !!t.advisory_section_id, // NEW
      }));

      setTeachers(combined);
    } catch (e) {
      console.error('Error loading teachers:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateLoad = (teacherId, newLoad) => {
    setTeachers((prev) =>
      prev.map((t) =>
        t.teacher_id === teacherId ? { ...t, max_load: Number(newLoad) } : t
      )
    );
  };

  const departmentCounts = useMemo(() => {
    const counts = {};
    teachers.forEach((t) => {
      const dept = t.department || 'N/A';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [teachers]);

  // NEW: quick advisory/non‑advisory counts
  const roleCounts = useMemo(() => {
    let advisory = 0;
    let non = 0;
    teachers.forEach((t) => (t.is_adviser ? advisory++ : non++));
    return { advisory, non, all: teachers.length };
  }, [teachers]);

  const validateLoads = async () => {
    try {
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id');
      const totalSections = sections?.length ?? 0;

      const { data: deptTeachers } = await supabase
        .from('teachers')
        .select('department_id')
        .eq('is_active', true);
      const deptIdsWithTeachers = [
        ...new Set(
          (deptTeachers || []).map((t) => t.department_id).filter(Boolean)
        ),
      ];

      const { data: depts } = await supabase
        .from('departments')
        .select('department_id, code, name')
        .in('department_id', deptIdsWithTeachers)
        .neq('code', 'HGP');

      const errors = [];
      for (const dept of depts || []) {
        const teachersInDept = teachers.filter(
          (t) => t.department_id === dept.department_id
        );
        const totalCapacity = teachersInDept.reduce(
          (sum, t) => sum + (t.max_load || 0),
          0
        );
        if (totalCapacity < totalSections) {
          errors.push(
            `Department ${dept.name}: Need ${totalSections} sections but only ${totalCapacity} capacity (${teachersInDept.length} teachers)`
          );
        }
      }
      return errors;
    } catch (e) {
      console.error('Validation error:', e);
      return ['Validation failed: ' + e.message];
    }
  };

  const recalculateLoads = async () => {
    setSaving(true);
    try {
      const { data: schedules } = await supabase
        .from('teacher_schedules')
        .select('teacher_id');

      const loadCounts = {};
      (schedules || []).forEach((s) => {
        loadCounts[s.teacher_id] = (loadCounts[s.teacher_id] || 0) + 1;
      });

      const updates = teachers.map((t) => ({
        teacher_id: t.teacher_id,
        max_load: t.max_load,
        current_load: loadCounts[t.teacher_id] || 0,
        school_year: STATIC_SY,
      }));

      const { error } = await supabase
        .from('teacher_loads')
        .upsert(updates, { onConflict: 'teacher_id,school_year' });

      if (error) throw error;

      await loadTeachers();
      alert('Loads recalculated successfully!');
    } catch (e) {
      console.error('Error recalculating loads:', e);
      alert('Failed to recalculate: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const errors = await validateLoads();
      if (errors.length > 0) {
        setErrorMessage(errors.join('\n'));
        setShowErrorModal(true);
        setSaving(false);
        return;
      }

      const updates = teachers.map((t) => ({
        teacher_id: t.teacher_id,
        max_load: t.max_load,
        school_year: STATIC_SY,
        current_load: t.current_load,
      }));

      const { error } = await supabase
        .from('teacher_loads')
        .upsert(updates, { onConflict: 'teacher_id,school_year' });

      if (error) throw error;
      setShowSuccessModal(true);
    } catch (e) {
      console.error('Error saving loads:', e);
      setErrorMessage('Failed to save: ' + e.message);
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  // NEW: apply role filter + search together
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      const matchesRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'advisory'
            ? t.is_adviser
            : !t.is_adviser;
      const emp = String(t.employee_number || '').toLowerCase();
      const nm = String(t.name || '').toLowerCase();
      return matchesRole && (nm.includes(q) || emp.includes(q));
    });
  }, [teachers, roleFilter, search]);

  if (!show) return null;

  return (
    <>
      <div className="teacherLoadModal">
        <div className="teacherLoadContent">
          <div className="teacherLoadHeader">
            <h2>Configure Teacher Loads</h2>
            <button onClick={onClose}>&times;</button>
          </div>

          <div
            className="teacherLoadSummary"
            style={{
              padding: '15px 20px',
              background: '#f5f5f5',
              borderBottom: '1px solid #ddd',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <strong>Total Teachers:</strong> {teachers.length}
                </div>
                <div>
                  <strong>Advisory:</strong> {roleCounts.advisory} |{' '}
                  <strong>Non‑Advisory:</strong> {roleCounts.non}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* NEW: Role filter */}
                <label style={{ fontSize: 13, color: '#444' }}>Show:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #d0d7de',
                    background: '#fff',
                  }}
                >
                  <option value="all">All Teachers</option>
                  <option value="advisory">Advisory Teachers</option>
                  <option value="nonAdvisory">Non‑Advisory</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {Object.entries(departmentCounts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dept, count]) => (
                    <div key={dept} style={{ fontSize: '13px' }}>
                      <strong>{dept}:</strong> {count}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div
            className="teacherLoadSearch"
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              type="text"
              placeholder="Search teacher by name or employee #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              style={{ alignSelf: 'center', fontSize: 12, color: '#6b7280' }}
            >
              Showing {filtered.length}
            </div>
          </div>

          <div className="teacherLoadTable">
            <table>
              <thead>
                <tr>
                  <th>Employee #</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Advisory</th>
                  <th>Current Load</th>
                  <th>Max Load (periods/day)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">Loading...</td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.teacher_id}>
                      <td>{t.employee_number}</td>
                      <td>{t.name}</td>
                      <td>{t.department}</td>
                      <td>{t.position}</td>
                      <td>{t.is_adviser ? 'Yes' : 'No'}</td>
                      <td>{t.current_load}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={t.max_load}
                          onChange={(e) =>
                            updateLoad(t.teacher_id, e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="teacherLoadActions">
            <button onClick={recalculateLoads} disabled={saving || loading}>
              {saving ? 'Recalculating...' : 'Recalculate Current Loads'}
            </button>
            <button onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button onClick={saveAll} disabled={saving}>
              {saving ? 'Validating & Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </div>

      <ReusableModalBox
        show={showErrorModal}
        onClose={() => setShowErrorModal(false)}
      >
        <div className="errorNotification">
          <h2 style={{ color: '#d9534f', marginBottom: '15px' }}>
            Insufficient Subject Teachers
          </h2>
          <div
            style={{
              whiteSpace: 'pre-line',
              textAlign: 'left',
              padding: '10px',
              background: '#fff5f5',
              border: '1px solid #d9534f',
              borderRadius: '4px',
              fontSize: '14px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {errorMessage}
          </div>
          <p style={{ marginTop: '15px', fontSize: '14px' }}>
            Please increase teacher loads or add more teachers.
          </p>
          <button
            onClick={() => setShowErrorModal(false)}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              background: '#d9534f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </ReusableModalBox>

      <ReusableModalBox
        show={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
        }}
      >
        <div className="notif" style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '60px', marginBottom: '15px' }}>✅</div>
          <h2 style={{ marginBottom: '20px' }}>
            Teacher Loads Saved Successfully!
          </h2>
          <button
            onClick={() => {
              setShowSuccessModal(false);
              onClose();
            }}
            style={{
              padding: '10px 30px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            OK
          </button>
        </div>
      </ReusableModalBox>
    </>
  );
};
