import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const STATIC_SY = '2025-2026';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MIN_PERIODS_PER_DAY = 3;
const MAX_PERIODS_PER_DAY = 7;

const gradeLabel = (g) => {
  const n = Number(g);
  return Number.isFinite(n) ? `Grade ${n}` : String(g ?? '—');
};

const FacultyAssignment = ({ activeSection = 'facultyAssignment' }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const [teachers, setTeachers] = useState([]); // {teacher_id,name,deptName}
  const [loadsMap, setLoadsMap] = useState(new Map()); // tid -> {current_load,max_load}
  const [assignments, setAssignments] = useState([]); // {teacher_id, section_id, subject_id, subject_name, grade_level}
  const [subjectsList, setSubjectsList] = useState([]); // {subject_id,name}

  // Mon–Fri derived from current_load
  const [perDay, setPerDay] = useState(new Map()); // tid -> {Monday..Friday}

  const [overloadedCount, setOverloadedCount] = useState(0);
  const [compliantCount, setCompliantCount] = useState(0);
  const [nonCompliantCount, setNonCompliantCount] = useState(0);
  const [teachersPerGrade, setTeachersPerGrade] = useState(new Map()); // gradeLabel -> Set(tid)

  // Pagination
  const [pageSec, setPageSec] = useState(1);
  const [pageSizeSec, setPageSizeSec] = useState(10);

  const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#6366f1'];

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setErr('');

        // 1) Teachers
        const { data: tRows, error: tErr } = await supabase
          .from('teachers')
          .select(
            `
            teacher_id,
            is_active,
            department:departments(name, code),
            user:users(first_name, last_name)
          `
          )
          .eq('is_active', true);
        if (tErr) throw tErr;

        const tList = (tRows || []).map((t) => ({
          teacher_id: t.teacher_id,
          name:
            `${t?.user?.first_name || ''} ${t?.user?.last_name || ''}`.trim() ||
            `#${t.teacher_id}`,
          deptName: t?.department?.name || '—',
        }));
        const tids = tList.map((t) => t.teacher_id);

        // 2) Loads for SY
        const { data: loads, error: lErr } = await supabase
          .from('teacher_loads')
          .select('teacher_id, max_load, current_load')
          .in('teacher_id', tids)
          .eq('school_year', STATIC_SY);
        if (lErr) throw lErr;

        const lMap = new Map();
        (loads || []).forEach((r) => {
          lMap.set(r.teacher_id, {
            current_load: r.current_load ?? 0, // periods per day
            max_load: r.max_load ?? 6,
          });
        });

        // 3) Subjects (for filter options)
        const { data: subs, error: sErr } = await supabase
          .from('subjects')
          .select('subject_id, name');
        if (sErr) throw sErr;

        // 4) Teacher assignments for SY (for filters and teachers-per-grade)
        const { data: ts, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select(
            `
            teacher_id,
            subject:subjects(subject_id, name),
            section:sections(section_id, grade_level)
          `
          )
          .eq('school_year', STATIC_SY);
        if (tsErr) throw tsErr;

        const asn = (ts || [])
          .filter((r) => r?.section?.section_id && r?.subject?.subject_id)
          .map((r) => ({
            teacher_id: r.teacher_id,
            section_id: r.section.section_id,
            subject_id: r.subject.subject_id,
            subject_name: r.subject.name || '',
            grade_level: r.section.grade_level,
          }));

        // 5) Fill Mon–Fri from current_load so all days match config
        const dayCounts = new Map();
        for (const t of tList) {
          const L = lMap.get(t.teacher_id) || { current_load: 0 };
          const perDayVal = L.current_load || 0;
          const obj = Object.fromEntries(DAYS.map((d) => [d, perDayVal]));
          dayCounts.set(t.teacher_id, obj);
        }

        // 6) Overload and compliance using current_load
        let over = 0,
          comp = 0,
          ncomp = 0;
        for (const t of tList) {
          const L = lMap.get(t.teacher_id) || { current_load: 0, max_load: 6 };
          if ((L.current_load || 0) > L.max_load) over += 1;
          const v = L.current_load || 0;
          const ok = v >= MIN_PERIODS_PER_DAY && v <= MAX_PERIODS_PER_DAY;
          if (ok) comp += 1;
          else ncomp += 1;
        }

        // 7) Teachers per grade
        const perGrade = new Map();
        for (const a of asn) {
          const gl = gradeLabel(a.grade_level);
          const s = perGrade.get(gl) || new Set();
          s.add(a.teacher_id);
          perGrade.set(gl, s);
        }

        if (!mounted) return;
        setTeachers(tList);
        setLoadsMap(lMap);
        setAssignments(asn);
        setSubjectsList(
          (subs || []).map((x) => ({
            subject_id: x.subject_id,
            name: x.name || '',
          }))
        );
        setPerDay(dayCounts);
        setOverloadedCount(over);
        setCompliantCount(comp);
        setNonCompliantCount(ncomp);
        setTeachersPerGrade(perGrade);
      } catch (e) {
        console.error(e);
        if (mounted) setErr('Failed to load faculty assignment.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Recalculate current_load = round(weekly periods / 5), then persist and refresh Mon–Fri
  const recalcCurrentLoads = async () => {
    try {
      setLoading(true);
      const { data: scheds, error } = await supabase
        .from('teacher_schedules')
        .select('teacher_id');
      if (error) throw error;

      const weeklyCounts = {};
      (scheds || []).forEach((s) => {
        weeklyCounts[s.teacher_id] = (weeklyCounts[s.teacher_id] || 0) + 1;
      });

      const updates = teachers.map((t) => {
        const perDayVal = Math.round((weeklyCounts[t.teacher_id] || 0) / 5);
        return {
          teacher_id: t.teacher_id,
          current_load: perDayVal,
          max_load: loadsMap.get(t.teacher_id)?.max_load ?? 6,
          school_year: STATIC_SY,
        };
      });

      const { error: upErr } = await supabase
        .from('teacher_loads')
        .upsert(updates, { onConflict: 'teacher_id,school_year' });
      if (upErr) throw upErr;

      const newLoads = new Map(loadsMap);
      const newPerDay = new Map(perDay);
      updates.forEach((u) => {
        const prev = newLoads.get(u.teacher_id) || {
          max_load: 6,
          current_load: 0,
        };
        newLoads.set(u.teacher_id, {
          max_load: prev.max_load,
          current_load: u.current_load,
        });
        const obj = Object.fromEntries(DAYS.map((d) => [d, u.current_load]));
        newPerDay.set(u.teacher_id, obj);
      });
      setLoadsMap(newLoads);
      setPerDay(newPerDay);
    } catch (e) {
      console.error(e);
      setErr('Failed to recalculate current loads.');
    } finally {
      setLoading(false);
    }
  };

  // Build table rows with filters
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byTid = new Map();
    for (const a of assignments) {
      const list = byTid.get(a.teacher_id) || [];
      list.push(a);
      byTid.set(a.teacher_id, list);
    }

    const rows = [];
    for (const t of teachers) {
      const asns = byTid.get(t.teacher_id) || [];
      if (!asns.length) continue;

      const gradeOk =
        !gradeFilter ||
        asns.some((a) => gradeLabel(a.grade_level) === gradeFilter);
      if (!gradeOk) continue;

      const subjectOk =
        !subjectFilter ||
        asns.some(
          (a) =>
            (a.subject_name || '').toLowerCase() === subjectFilter.toLowerCase()
        );
      if (!subjectOk) continue;

      if (
        q &&
        !t.name.toLowerCase().includes(q) &&
        !t.deptName.toLowerCase().includes(q)
      )
        continue;

      const day = perDay.get(t.teacher_id) || {};
      const mon = day.Monday || 0;
      const tue = day.Tuesday || 0;
      const wed = day.Wednesday || 0;
      const thu = day.Thursday || 0;
      const fri = day.Fri || day.Friday || 0; // tolerate Fri vs Friday keys
      const total = mon + tue + wed + thu + fri; // equals 5 * current_load

      const gMode = (() => {
        const m = new Map();
        let best = '—',
          c = -1;
        for (const a of asns) {
          const gl = gradeLabel(a.grade_level);
          const n = (m.get(gl) || 0) + 1;
          m.set(gl, n);
          if (n > c) {
            best = gl;
            c = n;
          }
        }
        return best;
      })();

      const L = loadsMap.get(t.teacher_id) || { current_load: 0, max_load: 6 };
      const overload = (L.current_load || 0) > L.max_load;

      rows.push({
        teacher_id: t.teacher_id,
        name: t.name,
        dept: t.deptName,
        grade: gMode,
        mon,
        tue,
        wed,
        thu,
        fri,
        total,
        current_load: L.current_load || 0,
        max_load: L.max_load,
        overload,
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [
    teachers,
    assignments,
    perDay,
    loadsMap,
    gradeFilter,
    subjectFilter,
    search,
  ]);

  // Pagination derived values
  const totalRowsSec = tableRows.length;
  const totalPagesSec = Math.max(1, Math.ceil(totalRowsSec / pageSizeSec));
  const startIdxSec = (pageSec - 1) * pageSizeSec;
  const endIdxSec = Math.min(startIdxSec + pageSizeSec, totalRowsSec);

  const pageRowsSec = useMemo(
    () => tableRows.slice(startIdxSec, endIdxSec),
    [tableRows, startIdxSec, endIdxSec]
  );

  useEffect(() => {
    setPageSec((p) => Math.min(Math.max(1, p), totalPagesSec));
  }, [totalPagesSec]);

  const MAX_PAGES_SEC = 5;
  const getPageNumbersSec = () => {
    if (totalPagesSec <= MAX_PAGES_SEC)
      return Array.from({ length: totalPagesSec }, (_, i) => i + 1);
    const half = Math.floor(MAX_PAGES_SEC / 2);
    let start = Math.max(1, pageSec - half);
    let end = Math.min(totalPagesSec, start + MAX_PAGES_SEC - 1);
    if (end - start + 1 < MAX_PAGES_SEC)
      start = Math.max(1, end - MAX_PAGES_SEC + 1);
    const pages = [];
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('…');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPagesSec) {
      if (end < totalPagesSec - 1) pages.push('…');
      pages.push(totalPagesSec);
    }
    return pages;
  };

  const gotoPageSec = (n) =>
    setPageSec(Math.min(Math.max(1, n), totalPagesSec));
  const firstPageSec = () => gotoPageSec(1);
  const prevPageSec = () => gotoPageSec(pageSec - 1);
  const nextPageSec = () => gotoPageSec(pageSec + 1);
  const lastPageSec = () => gotoPageSec(totalPagesSec);

  // Charts
  const overloadPie = useMemo(() => {
    const over = Array.from(loadsMap.values()).filter(
      (l) => (l.current_load || 0) > (l.max_load || 0)
    ).length;
    const normal = Math.max(0, teachers.length - over);
    return [
      { name: 'Overloaded', value: over },
      { name: 'Normal', value: normal },
    ];
  }, [teachers.length, loadsMap]);

  const teachersPerGradeArr = useMemo(() => {
    const arr = [];
    for (const [g, set] of teachersPerGrade.entries()) {
      arr.push({ grade: g, count: set.size });
    }
    arr.sort((a, b) => {
      const an = Number((a.grade.match(/\d+/) || [0])[0]);
      const bn = Number((b.grade.match(/\d+/) || [0])[0]);
      return an - bn || a.grade.localeCompare(b.grade);
    });
    return arr;
  }, [teachersPerGrade]);

  if (activeSection !== 'facultyAssignment') return null;

  return (
    <div>
      <h2>Faculty Assignment</h2>

      <div className="facultyAssignment">
        <h1>Teacher Load Summary</h1>

        <div
          className="facultyAssignmentP1"
          style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}
        >
          <div
            className="teacherLoadSummary"
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}
          >
            <div className="card overloadedTeacher" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Overloaded Teachers</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={overloadPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                    >
                      {overloadPie.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={idx === 0 ? '#ef4444' : '#10b981'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Mon–Fri reflect current_load (periods/day) from teacher_loads;
                use Recalculate to sync from weekly schedules.
              </div>
              <button onClick={recalcCurrentLoads} style={{ marginTop: 8 }}>
                Recalculate Current Loads
              </button>
            </div>

            <div className="card teachersPerGrade" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Teachers per Grade</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={teachersPerGradeArr}
                    margin={{ top: 10, right: 10, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="grade" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="facultyAssignmentP2" style={{ marginTop: 20 }}>
          <div
            className="facultyAssignmentSorter"
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              className="facultyAssignmentSearch"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <i className="fa fa-search" aria-hidden="true"></i>
              <input
                className="search"
                placeholder="Search name or department"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sorter-grade">
              <label style={{ display: 'block', fontSize: 12 }}>
                Select Grade Level
              </label>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="">All Grade</option>
                <option>Grade 7</option>
                <option>Grade 8</option>
                <option>Grade 9</option>
                <option>Grade 10</option>
              </select>
            </div>

            <div className="sorter-subject">
              <label style={{ display: 'block', fontSize: 12 }}>
                Faculty/Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjectsList.map((s) => (
                  <option key={s.subject_id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="facultyAssignmentTable"
            style={{ marginTop: 12, overflowX: 'auto' }}
          >
            <table className="faculty-periods-table">
              <thead>
                <tr>
                  <th rowSpan="2">Name</th>
                  <th rowSpan="2">Faculty</th>
                  <th rowSpan="2">Grade Level</th>
                  <th rowSpan="2">Max Load</th>
                  <th rowSpan="2">Current Load</th>
                  <th colSpan="5">No. of Periods per day</th>
                  <th rowSpan="2">Total</th>
                </tr>
                <tr>
                  <th>Mon</th>
                  <th>Tue</th>
                  <th>Wed</th>
                  <th>Thu</th>
                  <th>Fri</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12}>Loading…</td>
                  </tr>
                )}
                {!loading && pageRowsSec.length === 0 && (
                  <tr>
                    <td colSpan={12}>No data</td>
                  </tr>
                )}
                {!loading &&
                  pageRowsSec.map((r) => (
                    <tr key={r.teacher_id}>
                      <td>{r.name}</td>
                      <td>{r.dept}</td>
                      <td>{r.grade}</td>
                      <td>{r.max_load}</td>
                      <td style={{ color: r.overload ? '#ef4444' : 'inherit' }}>
                        {r.current_load}
                      </td>
                      <td
                        className={
                          r.mon > MAX_PERIODS_PER_DAY ? 'highlight-red' : ''
                        }
                      >
                        {r.mon}
                      </td>
                      <td
                        className={
                          r.tue > MAX_PERIODS_PER_DAY ? 'highlight-red' : ''
                        }
                      >
                        {r.tue}
                      </td>
                      <td
                        className={
                          r.wed > MAX_PERIODS_PER_DAY ? 'highlight-red' : ''
                        }
                      >
                        {r.wed}
                      </td>
                      <td
                        className={
                          r.thu > MAX_PERIODS_PER_DAY ? 'highlight-red' : ''
                        }
                      >
                        {r.thu}
                      </td>
                      <td
                        className={
                          r.fri > MAX_PERIODS_PER_DAY ? 'highlight-red' : ''
                        }
                      >
                        {r.fri}
                      </td>
                      <td>{r.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pager-left">
              <label className="pager-label">Rows per page</label>
              <select
                className="pager-size"
                value={pageSizeSec}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setPageSizeSec(newSize);
                  setPageSec(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="pager-info">
              {totalRowsSec === 0
                ? 'Showing 0 of 0'
                : `Showing ${startIdxSec + 1}–${endIdxSec} of ${totalRowsSec}`}
            </div>

            <div className="pager-right">
              <button
                className="pager-btn"
                onClick={firstPageSec}
                disabled={pageSec === 1}
                aria-label="First page"
              >
                <ion-icon name="play-back-outline"></ion-icon>
              </button>
              <button
                className="pager-btn"
                onClick={prevPageSec}
                disabled={pageSec === 1}
                aria-label="Previous page"
              >
                <ion-icon name="chevron-back-outline"></ion-icon>
              </button>

              {getPageNumbersSec().map((pkey, idx) =>
                pkey === '…' ? (
                  <span key={`ellipsis-sec-${idx}`} className="pager-ellipsis">
                    {' '}
                    …{' '}
                  </span>
                ) : (
                  <button
                    key={`sec-${pkey}`}
                    className={`pager-page ${pageSec === pkey ? 'active' : ''}`}
                    onClick={() => gotoPageSec(pkey)}
                    aria-current={pageSec === pkey ? 'page' : undefined}
                  >
                    {pkey}
                  </button>
                )
              )}

              <button
                className="pager-btn"
                onClick={nextPageSec}
                disabled={pageSec === totalPagesSec}
                aria-label="Next page"
              >
                <ion-icon name="chevron-forward-outline"></ion-icon>
              </button>
              <button
                className="pager-btn"
                onClick={lastPageSec}
                disabled={pageSec === totalPagesSec}
                aria-label="Last page"
              >
                <ion-icon name="play-forward-outline"></ion-icon>
              </button>
            </div>
          </div>

          {err && <div style={{ color: '#ef4444', marginTop: 8 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
};

export default FacultyAssignment;
