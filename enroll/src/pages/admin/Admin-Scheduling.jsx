// src/pages/admin/Admin-Scheduling.jsx
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Sub_Nav } from '../../components/SubNav';
import './admin_scheduling.css';

import { Teacher_Scheduling_Card } from '../../components/admin_comp/Teacher_Scheduling_Card';
import { Section_Scheduling_Card } from '../../components/admin_comp/Section_Scheduling_Card';
import { TeacherLoadConfig } from '../../components/admin_comp/TeacherLoadConfig';
import { supabase } from '../../supabaseClient';

// Teaching slots by grade (recess excluded)
const TEACHING_SLOTS_BY_GRADE = {
  7: [
    '6:00-6:45',
    '6:45-7:30',
    '7:30-8:15',
    '8:15-9:00',
    '9:20-10:05',
    '10:05-10:50',
    '10:50-11:35',
  ],
  8: [
    '12:30-1:15',
    '1:15-2:00',
    '2:00-2:45',
    '2:45-3:30',
    '3:50-4:35',
    '4:35-5:20',
    '5:20-6:05',
    '6:05-6:50',
  ],
  9: [
    '6:00-6:45',
    '6:45-7:30',
    '7:30-8:15',
    '8:15-9:00',
    '9:20-10:05',
    '10:05-10:50',
    '10:50-11:35',
  ],
  10: [
    '12:30-1:15',
    '1:15-2:00',
    '2:00-2:45',
    '2:45-3:30',
    '3:50-4:35',
    '4:35-5:20',
    '5:20-6:05',
    '6:05-6:50',
  ],
};

const STATIC_SY = '2025-2026';
const MIN_PERIODS_PER_DAY = 3;
const DEFAULT_MAX_LOAD = 6;
const REQUIRED_PER_SECTION = 8;

export const Admin_Scheduling = () => {
  const [viewMode, setViewMode] = useState('teacherSchedules'); // 'teacherSchedules' | 'sectionSchedules'

  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade] = useState('all'); // '', '7'|'8'|'9'|'10'|'all'
  const [sectionId, setSectionId] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [facultyType, setFacultyType] = useState('advisory');

  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [running, setRunning] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showLoadConfig, setShowLoadConfig] = useState(false);

  const [analytics, setAnalytics] = useState({
    incompleteSections: 0,
    scheduleConflicts: 0,
    teachersScheduled: 0,
    totalAssignments: 0,
    offGradeAdvisers: 0,
    loading: true,
  });

  const [missingView, setMissingView] = useState({
    rows: [],
    loading: false,
    err: '',
  });

  // Meta load
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      try {
        setLoadingMeta(true);
        const { data: sub, error: subErr } = await supabase
          .from('subjects')
          .select('subject_id, name, code, department_id, is_advisory');
        if (subErr) throw subErr;

        const { data: secs, error: secErr } = await supabase
          .from('sections')
          .select('section_id, name, grade_level, adviser_id')
          .order('grade_level', { ascending: true })
          .order('name', { ascending: true });
        if (secErr) throw secErr;

        const { data: deptRows, error: dErr } = await supabase
          .from('departments')
          .select('department_id, name, code')
          .order('name', { ascending: true });
        if (dErr) throw dErr;

        if (mounted) {
          setSubjects(sub || []);
          setSections(secs || []);
          setDepartments(deptRows || []);
        }
      } catch (e) {
        console.error('Meta load error', e);
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    };
    loadMeta();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  // Analytics including completeness and conflicts (teacher-slot + section-slot)
  useEffect(() => {
    let mounted = true;
    const loadAnalytics = async () => {
      try {
        setAnalytics((prev) => ({ ...prev, loading: true }));

        const { data: allSections, error: secErr } = await supabase
          .from('sections')
          .select('section_id, name, grade_level, adviser_id');
        if (secErr) throw secErr;

        const { data: teacherSubjects, error: tsErr } = await supabase
          .from('teacher_subjects')
          .select(
            'teacher_id, section_id, subject_id, section:sections(grade_level)'
          )
          .eq('school_year', STATIC_SY);
        if (tsErr) throw tsErr;

        const uniqueTeachers = new Set(
          (teacherSubjects || []).map((ts) => ts.teacher_id)
        );

        const subjSetBySection = new Map();
        (teacherSubjects || []).forEach((ts) => {
          const s = subjSetBySection.get(ts.section_id) || new Set();
          s.add(ts.subject_id);
          subjSetBySection.set(ts.section_id, s);
        });

        let incomplete = 0;
        (allSections || []).forEach((section) => {
          const n = subjSetBySection.get(section.section_id)?.size || 0;
          if (n < REQUIRED_PER_SECTION) incomplete++;
        });

        // Detect both teacher-slot and section-slot conflicts
        const { data: allSched, error: schedErr } = await supabase
          .from('teacher_schedules')
          .select('teacher_id, slot_key, section_id, section_name');
        if (schedErr) throw schedErr;

        const secNameToId = new Map(
          (allSections || []).map((s) => [String(s.name || ''), s.section_id])
        );

        const teacherSlotCount = new Map(); // `${tid}||${slot}`
        const sectionSlotCount = new Map(); // `${sid}||${slot}`
        (allSched || []).forEach((r) => {
          const tKey = `${r.teacher_id}||${r.slot_key}`;
          teacherSlotCount.set(tKey, (teacherSlotCount.get(tKey) || 0) + 1);

          const sid =
            r.section_id ||
            secNameToId.get(String(r.section_name || '')) ||
            null;
          if (sid) {
            const sKey = `${sid}||${r.slot_key}`;
            sectionSlotCount.set(sKey, (sectionSlotCount.get(sKey) || 0) + 1);
          }
        });

        let teacherCollisions = 0;
        teacherSlotCount.forEach((n) => {
          if (n > 1) teacherCollisions += n - 1;
        });
        let sectionCollisions = 0;
        sectionSlotCount.forEach((n) => {
          if (n > 1) sectionCollisions += n - 1;
        });

        const conflicts = teacherCollisions + sectionCollisions;

        if (mounted) {
          setAnalytics({
            incompleteSections: incomplete,
            scheduleConflicts: conflicts,
            teachersScheduled: uniqueTeachers.size,
            totalAssignments: (teacherSubjects || []).length,
            offGradeAdvisers: 0,
            loading: false,
          });
        }
      } catch (e) {
        console.error('Failed to load analytics:', e);
        if (mounted) setAnalytics((p) => ({ ...p, loading: false }));
      }
    };
    loadAnalytics();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const filteredSections = useMemo(() => {
    if (!grade || grade === 'all') return sections;
    const g = Number(grade);
    return sections.filter((s) => Number(s.grade_level) === g);
  }, [sections, grade]);

  useEffect(() => {
    if (!sectionId) return;
    if (!filteredSections.some((s) => s.section_id === Number(sectionId))) {
      setSectionId('');
    }
  }, [filteredSections, sectionId]);

  const getTargetGrades = () => {
    if (grade === '7' || grade === '8' || grade === '9' || grade === '10') {
      return [Number(grade)];
    }
    // Treat '' and 'all' as all grades
    return [7, 8, 9, 10];
  };

  // Subject helpers
  const subjectsByDept = useMemo(() => {
    const m = new Map();
    for (const s of subjects) {
      if (!s.department_id) continue;
      const arr = m.get(s.department_id) || [];
      arr.push(s);
      m.set(s.department_id, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => Number(a.is_advisory) - Number(b.is_advisory));
      m.set(k, arr);
    }
    return m;
  }, [subjects]);

  const nameBySubjectId = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(s.subject_id, s.name || `#${s.subject_id}`));
    return m;
  }, [subjects]);

  const deptBySubjectId = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(s.subject_id, s.department_id || null));
    return m;
  }, [subjects]);

  const buildRequiredSubjectsForSection = (
    section,
    eligibleByDept,
    adviserDeptId
  ) => {
    const desired = new Set();
    const deptIds = Array.from(eligibleByDept.keys());
    deptIds.sort(
      (a, b) =>
        (eligibleByDept.get(a)?.length || 0) -
        (eligibleByDept.get(b)?.length || 0)
    );
    for (const deptId of deptIds) {
      if (desired.size >= REQUIRED_PER_SECTION) break;
      const pool = subjectsByDept.get(deptId) || [];
      const pick = pool.find((s) => !s.is_advisory) || pool[0];
      if (pick) desired.add(pick.subject_id);
    }
    if (adviserDeptId != null && desired.size < REQUIRED_PER_SECTION) {
      const pool = subjectsByDept.get(adviserDeptId) || [];
      const adv = pool.find((s) => s.is_advisory);
      if (adv) desired.add(adv.subject_id);
    }
    if (desired.size < REQUIRED_PER_SECTION) {
      for (const deptId of deptIds) {
        if (desired.size >= REQUIRED_PER_SECTION) break;
        const pool = subjectsByDept.get(deptId) || [];
        for (const s of pool) {
          if (!desired.has(s.subject_id)) {
            desired.add(s.subject_id);
            if (desired.size >= REQUIRED_PER_SECTION) break;
          }
        }
      }
    }
    return Array.from(desired);
  };

  function pickTeacher(teachersOfDept, teacherLoadMap) {
    const arr = [...teachersOfDept];
    arr.sort((a, b) => {
      const la = teacherLoadMap.get(a.teacher_id) || { current_load: 0 };
      const lb = teacherLoadMap.get(b.teacher_id) || { current_load: 0 };
      const aBelow = la.current_load < MIN_PERIODS_PER_DAY ? 0 : 1;
      const bBelow = lb.current_load < MIN_PERIODS_PER_DAY ? 0 : 1;
      if (aBelow !== bBelow) return aBelow - bBelow;
      return la.current_load - lb.current_load;
    });
    for (const t of arr) {
      const info = teacherLoadMap.get(t.teacher_id) || {
        current_load: 0,
        max_load: DEFAULT_MAX_LOAD,
      };
      const baseMax = info.max_load ?? DEFAULT_MAX_LOAD;
      if (info.current_load < baseMax) return t;
    }
    return null;
  }

  // Auto-schedule (no dry run): pre-clear target sections, then assign
  const handleAutoSchedule = async () => {
    try {
      if (facultyType !== 'advisory') {
        setActionMsg('Auto-schedule is only available for advisers.');
        return;
      }
      setRunning(true);
      setActionMsg('');

      const grades = getTargetGrades();

      // Determine target sections by grade + optional section filter
      const targetSections = sections.filter(
        (s) =>
          grades.includes(Number(s.grade_level)) &&
          (!sectionId || s.section_id === Number(sectionId))
      );
      const targetSectionIds = targetSections.map((s) => s.section_id);

      // Pre-clear: remove grades -> schedules -> teacher_subjects for target sections (current SY)
      if (targetSectionIds.length) {
        const { data: tsExisting, error: tsExistingErr } = await supabase
          .from('teacher_subjects')
          .select('teacher_subject_id')
          .in('section_id', targetSectionIds)
          .eq('school_year', STATIC_SY);
        if (tsExistingErr) throw tsExistingErr;

        const tsIdsExisting = (tsExisting || [])
          .map((r) => r.teacher_subject_id)
          .filter(Boolean);

        if (tsIdsExisting.length) {
          const { error: delGradesErr } = await supabase
            .from('grades')
            .delete()
            .in('teacher_subject_id', tsIdsExisting);
          if (delGradesErr) throw delGradesErr;
        }

        const { error: delSchedErr } = await supabase
          .from('teacher_schedules')
          .delete()
          .in('section_id', targetSectionIds);
        if (delSchedErr) throw delSchedErr;

        const { error: delTsErr } = await supabase
          .from('teacher_subjects')
          .delete()
          .in('section_id', targetSectionIds)
          .eq('school_year', STATIC_SY);
        if (delTsErr) throw delTsErr;
      }

      // Load active teachers
      const { data: allTeachersRaw, error: tErr } = await supabase
        .from('teachers')
        .select(
          'teacher_id, department_id, advisory_section_id, employee_number, is_active'
        )
        .eq('is_active', true);
      if (tErr) throw tErr;
      const allTeachers = allTeachersRaw || [];
      if (!allTeachers.length) {
        setActionMsg('No active teachers found.');
        setRunning(false);
        return;
      }

      // Loads
      const teacherIds = allTeachers.map((t) => t.teacher_id);
      const { data: loadsRaw, error: loadsErr } = await supabase
        .from('teacher_loads')
        .select('teacher_id, max_load, current_load')
        .in('teacher_id', teacherIds)
        .eq('school_year', STATIC_SY);
      if (loadsErr) throw loadsErr;

      const teacherLoadMap = new Map();
      (loadsRaw || []).forEach((l) =>
        teacherLoadMap.set(l.teacher_id, {
          current_load: l.current_load || 0,
          max_load: l.max_load || DEFAULT_MAX_LOAD,
        })
      );
      allTeachers.forEach((t) => {
        if (!teacherLoadMap.has(t.teacher_id)) {
          teacherLoadMap.set(t.teacher_id, {
            current_load: 0,
            max_load: DEFAULT_MAX_LOAD,
          });
        }
      });

      // Teachers by dept
      const teachersByDept = new Map();
      allTeachers.forEach((t) => {
        if (!t.department_id) return;
        if (!teachersByDept.has(t.department_id))
          teachersByDept.set(t.department_id, []);
        teachersByDept.get(t.department_id).push(t);
      });

      const allTeacherSubjectInserts = [];
      const allTeacherScheduleInserts = [];

      for (const gradeLevel of grades) {
        const targetSectionsByGrade = targetSections.filter(
          (s) => Number(s.grade_level) === gradeLevel
        );
        if (!targetSectionsByGrade.length) continue;

        const teachingSlots = TEACHING_SLOTS_BY_GRADE[gradeLevel] || [];

        // Seed locks for teacher-slot and section-slot across this grade’s slots
        const secIds = targetSectionsByGrade.map((s) => s.section_id);
        const secNames = targetSectionsByGrade
          .map((s) => s.name)
          .filter(Boolean);
        const secNameToId = new Map(
          targetSectionsByGrade.map((s) => [String(s.name || ''), s.section_id])
        );

        const { data: schedById } = await supabase
          .from('teacher_schedules')
          .select('teacher_id, slot_key, section_id, section_name')
          .in('section_id', secIds)
          .in('slot_key', teachingSlots);

        const { data: schedByName } = await supabase
          .from('teacher_schedules')
          .select('teacher_id, slot_key, section_id, section_name')
          .is('section_id', null)
          .in('section_name', secNames)
          .in('slot_key', teachingSlots);

        const mergedLocks = [...(schedById || []), ...(schedByName || [])];
        const teacherSlotTaken = new Set(); // `${tid}||${slot}`
        const sectionSlotTaken = new Set(); // `${sid}||${slot}`
        mergedLocks.forEach((r) => {
          teacherSlotTaken.add(`${r.teacher_id}||${r.slot_key}`);
          const sidResolved =
            r.section_id || secNameToId.get(String(r.section_name || ''));
          if (sidResolved)
            sectionSlotTaken.add(`${sidResolved}||${r.slot_key}`);
        });

        for (const section of targetSectionsByGrade) {
          // Eligible teachers by dept (simple pool)
          const eligibleByDept = new Map();
          for (const [deptId, arr] of teachersByDept.entries()) {
            const eligible = arr.filter(() => true);
            if (eligible.length) eligibleByDept.set(deptId, eligible);
          }

          const adviserDeptId = sections.find(
            (s) => s.section_id === section.section_id
          )?.adviser_id
            ? allTeachers.find(
                (t) =>
                  t.teacher_id ===
                  sections.find((s) => s.section_id === section.section_id)
                    ?.adviser_id
              )?.department_id
            : null;

          const requiredSubjectIds = buildRequiredSubjectsForSection(
            section,
            eligibleByDept,
            adviserDeptId
          );

          const assignedSubjects = new Set();

          const getDeptOfSubject = (sid) => {
            const s = subjects.find((x) => x.subject_id === sid);
            return s?.department_id || null;
          };

          const tryAssignSubject = (subjectIdToFill) => {
            if (assignedSubjects.has(subjectIdToFill)) return true;
            const deptId = getDeptOfSubject(subjectIdToFill);
            const candidates = (eligibleByDept.get(deptId) || []).filter(
              (t) => {
                return !allTeacherSubjectInserts.some(
                  (a) =>
                    a.section_id === section.section_id &&
                    a.teacher_id === t.teacher_id
                );
              }
            );
            if (!candidates.length) return false;

            const teacherCandidate = pickTeacher(candidates, teacherLoadMap);
            if (!teacherCandidate) return false;

            allTeacherSubjectInserts.push({
              teacher_id: teacherCandidate.teacher_id,
              subject_id: subjectIdToFill,
              section_id: section.section_id,
              school_year: STATIC_SY,
              is_hgp: false,
            });
            assignedSubjects.add(subjectIdToFill);

            const prevLoad = teacherLoadMap.get(
              teacherCandidate.teacher_id
            ) || {
              current_load: 0,
              max_load: DEFAULT_MAX_LOAD,
            };
            teacherLoadMap.set(teacherCandidate.teacher_id, {
              ...prevLoad,
              current_load: prevLoad.current_load + 1,
            });

            // Choose a slot free for both this teacher and this section
            const teacherNewLoad = teacherLoadMap.get(
              teacherCandidate.teacher_id
            ).current_load;
            const slotIndex = (teacherNewLoad - 1) % teachingSlots.length;

            let chosenSlot = teachingSlots[slotIndex];
            let attempts = 0;
            while (
              (teacherSlotTaken.has(
                `${teacherCandidate.teacher_id}||${chosenSlot}`
              ) ||
                sectionSlotTaken.has(`${section.section_id}||${chosenSlot}`)) &&
              attempts < teachingSlots.length
            ) {
              attempts++;
              const altIndex = (slotIndex + attempts) % teachingSlots.length;
              chosenSlot = teachingSlots[altIndex];
            }

            // Lock both dimensions
            teacherSlotTaken.add(
              `${teacherCandidate.teacher_id}||${chosenSlot}`
            );
            sectionSlotTaken.add(`${section.section_id}||${chosenSlot}`);

            allTeacherScheduleInserts.push({
              teacher_id: teacherCandidate.teacher_id,
              slot_key: chosenSlot,
              teacher_subject_id: null,
              section_id: section.section_id,
              section_name: section.name,
            });

            return true;
          };

          for (const sid of requiredSubjectIds) {
            tryAssignSubject(sid);
          }
        }
      }

      // Insert teacher_subjects
      const { data: insertedTs, error: insertErr } = await supabase
        .from('teacher_subjects')
        .insert(allTeacherSubjectInserts)
        .select('teacher_subject_id, teacher_id, subject_id, section_id');
      if (insertErr) throw insertErr;

      // De-duplicate by teacher-slot and section-slot before inserting schedules
      const seenTeacherSlot = new Set();
      const seenSectionSlot = new Set();
      const filteredSched = [];
      for (const sch of allTeacherScheduleInserts) {
        const tKey = `${sch.teacher_id}||${sch.slot_key}`;
        const sKey = `${sch.section_id}||${sch.slot_key}`;
        if (seenTeacherSlot.has(tKey) || seenSectionSlot.has(sKey)) continue;
        seenTeacherSlot.add(tKey);
        seenSectionSlot.add(sKey);
        filteredSched.push(sch);
      }

      // Insert schedules with linked teacher_subject_id when possible
      const scheduleRowsToInsert = filteredSched.map((sch) => {
        const candidate = insertedTs.find(
          (t) =>
            t.teacher_id === sch.teacher_id && t.section_id === sch.section_id
        );
        const teacherSubjectId = candidate
          ? candidate.teacher_subject_id
          : null;
        return {
          teacher_id: sch.teacher_id,
          slot_key: sch.slot_key,
          teacher_subject_id: teacherSubjectId,
          section_id: sch.section_id,
          section_name: sch.section_name,
        };
      });
      if (scheduleRowsToInsert.length) {
        const { error: scheduleInsertErr } = await supabase
          .from('teacher_schedules')
          .insert(scheduleRowsToInsert);
        if (scheduleInsertErr) throw scheduleInsertErr;
      }

      // Recompute loads
      const { data: loadsAfter, error: loadsFetchErr } = await supabase
        .from('teacher_schedules')
        .select('teacher_id');
      if (loadsFetchErr) throw loadsFetchErr;
      const loadCounts = {};
      (loadsAfter || []).forEach((s) => {
        loadCounts[s.teacher_id] = (loadCounts[s.teacher_id] || 0) + 1;
      });
      const loadUpdates = Object.entries(loadCounts).map(([tid, cur]) => ({
        teacher_id: Number(tid),
        current_load: Number(cur),
        school_year: STATIC_SY,
      }));
      if (loadUpdates.length) {
        const { error: upsertErr } = await supabase
          .from('teacher_loads')
          .upsert(loadUpdates, { onConflict: ['teacher_id', 'school_year'] });
        if (upsertErr) throw upsertErr;
      }

      setActionMsg(
        `Auto-schedule complete: Created ${insertedTs?.length || 0} assignments.`
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      console.error('Error:', e);
      setActionMsg('Auto-schedule failed: ' + (e?.message || String(e)));
    } finally {
      setRunning(false);
    }
  };

  const handleClearAutoSchedule = async () => {
    try {
      setRunning(true);
      setActionMsg('');
      const grades = getTargetGrades(); // supports 'all' → [7,8,9,10]
      const targetSections = sections.filter(
        (s) =>
          grades.includes(Number(s.grade_level)) &&
          (!sectionId || s.section_id === Number(sectionId))
      );
      const targetSectionIds = targetSections.map((s) => s.section_id);
      const targetSectionNames = new Set(
        targetSections.map((s) => s.name || '')
      );

      if (!targetSectionIds.length) {
        setActionMsg('Nothing to remove.');
        setRunning(false);
        return;
      }

      // Gather teacher_subjects in scope (SY-bound)
      const { data: tsRows, error: tsFetchErr } = await supabase
        .from('teacher_subjects')
        .select('teacher_subject_id, teacher_id, section_id')
        .in('section_id', targetSectionIds)
        .eq('school_year', STATIC_SY);
      if (tsFetchErr) throw tsFetchErr;
      const tsIds = (tsRows || [])
        .map((r) => r.teacher_subject_id)
        .filter(Boolean);
      const affectedTeacherIds = [
        ...new Set((tsRows || []).map((r) => r.teacher_id)),
      ];

      // 1) Delete grades for those TS
      if (tsIds.length) {
        const { error: delGradesErr } = await supabase
          .from('grades')
          .delete()
          .in('teacher_subject_id', tsIds);
        if (delGradesErr) throw delGradesErr;
      }

      // 2) Delete schedules by section_id
      {
        const { error: delSchedBySectionErr } = await supabase
          .from('teacher_schedules')
          .delete()
          .in('section_id', targetSectionIds);
        if (delSchedBySectionErr) throw delSchedBySectionErr;
      }

      // 3) Delete schedules with section_id IS NULL but section_name matches target sections
      if (targetSectionNames.size > 0) {
        const { data: straySched, error: strayFetchErr } = await supabase
          .from('teacher_schedules')
          .select('teacher_id, slot_key, section_id, section_name')
          .is('section_id', null);
        if (strayFetchErr) throw strayFetchErr;

        const strayPairs = (straySched || [])
          .filter(
            (r) => r.section_name && targetSectionNames.has(r.section_name)
          )
          .map((r) => [r.teacher_id, r.slot_key]);

        // Batch OR-deletes for composite (teacher_id,slot_key)
        const BATCH_SIZE = 300;
        for (let i = 0; i < strayPairs.length; i += BATCH_SIZE) {
          const batch = strayPairs.slice(i, i + BATCH_SIZE);
          if (!batch.length) continue;
          const orClauses = batch.map(
            ([tid, sk]) =>
              `and(teacher_id.eq.${tid},slot_key.eq.${encodeURIComponent(sk)})`
          );
          const { error: delStrayErr } = await supabase
            .from('teacher_schedules')
            .delete()
            .or(orClauses.join(','));
          if (delStrayErr) throw delStrayErr;
        }
      }

      // 4) Delete TS after schedules (SY-bound)
      {
        const { error: delTsErr } = await supabase
          .from('teacher_subjects')
          .delete()
          .in('section_id', targetSectionIds)
          .eq('school_year', STATIC_SY);
        if (delTsErr) throw delTsErr;
      }

      // 5) Final sweep: clear any grade-slot schedules for affected teachers (covers stubborn rows)
      if (affectedTeacherIds.length) {
        const slotsToDelete = grades.flatMap(
          (g) => TEACHING_SLOTS_BY_GRADE[g] || []
        );
        if (slotsToDelete.length) {
          const { error: delByTeacherSlotsErr } = await supabase
            .from('teacher_schedules')
            .delete()
            .in('teacher_id', affectedTeacherIds)
            .in('slot_key', Array.from(new Set(slotsToDelete)));
          if (delByTeacherSlotsErr) throw delByTeacherSlotsErr;
        }
      }

      // Recompute loads (set zero where no schedules remain)
      const { data: loadsAfter, error: loadsFetchErr } = await supabase
        .from('teacher_schedules')
        .select('teacher_id');
      if (loadsFetchErr) throw loadsFetchErr;
      const loadCounts = {};
      (loadsAfter || []).forEach((s) => {
        loadCounts[s.teacher_id] = (loadCounts[s.teacher_id] || 0) + 1;
      });

      const { data: allActiveTeachers } = await supabase
        .from('teachers')
        .select('teacher_id')
        .eq('is_active', true);

      const remainingIds = new Set(
        Object.keys(loadCounts).map((k) => Number(k))
      );
      const zeroRows = (allActiveTeachers || [])
        .map((t) => t.teacher_id)
        .filter((tid) => !remainingIds.has(tid))
        .map((tid) => ({
          teacher_id: tid,
          school_year: STATIC_SY,
          current_load: 0,
        }));

      const loadUpdates = Object.entries(loadCounts).map(([tid, cur]) => ({
        teacher_id: Number(tid),
        school_year: STATIC_SY,
        current_load: Number(cur),
      }));

      const upserts = [...loadUpdates, ...zeroRows];
      if (upserts.length) {
        const { error: upsertErr } = await supabase
          .from('teacher_loads')
          .upsert(upserts, { onConflict: ['teacher_id', 'school_year'] });
        if (upsertErr) throw upsertErr;
      }

      setActionMsg('Auto-schedule removed successfully.');
      setReloadKey((k) => k + 1);
    } catch (e) {
      console.error('Remove error:', e);
      setActionMsg(
        'Failed to remove auto-schedule: ' + (e?.message || String(e))
      );
    } finally {
      setRunning(false);
    }
  };

  // (Optional) Live "missing subjects" recompute — unchanged core logic
  const refreshMissing = async () => {
    try {
      setMissingView((v) => ({ ...v, loading: true, err: '' }));

      const { data: ts, error: tsErr } = await supabase
        .from('teacher_subjects')
        .select(
          'teacher_id, section_id, subject_id, section:sections(section_id, name, grade_level)'
        )
        .eq('school_year', STATIC_SY);
      if (tsErr) throw tsErr;

      const bySection = new Map();
      ts.forEach((r) => {
        const s = bySection.get(r.section_id) || {
          section: r.section,
          subjects: new Set(),
          teachers: new Set(),
        };
        s.subjects.add(r.subject_id);
        s.teachers.add(r.teacher_id);
        bySection.set(r.section_id, s);
      });

      const deptIdsAll = new Set(
        subjects.map((s) => s.department_id).filter(Boolean)
      );
      const poolSubjects = subjects.filter((s) => !!s.department_id);

      const rowsOut = [];
      for (const sec of sections || []) {
        const rec = bySection.get(sec.section_id) || {
          section: sec,
          subjects: new Set(),
        };
        const desired = new Set();
        for (const d of deptIdsAll) {
          if (desired.size >= REQUIRED_PER_SECTION) break;
          const pick =
            poolSubjects.find((s) => s.department_id === d && !s.is_advisory) ||
            poolSubjects.find((s) => s.department_id === d);
          if (pick) desired.add(pick.subject_id);
        }
        for (const s of poolSubjects) {
          if (desired.size >= REQUIRED_PER_SECTION) break;
          desired.add(s.subject_id);
        }
        const missing = Array.from(desired)
          .filter((sid) => !rec.subjects.has(sid))
          .slice(0, Math.max(0, REQUIRED_PER_SECTION - rec.subjects.size));
        if (missing.length > 0) {
          rowsOut.push({
            section_id: sec.section_id,
            grade_level: sec.grade_level,
            section_name: sec.name,
            assignedCount: rec.subjects.size,
            missingSubjectIds: missing,
          });
        }
      }

      setMissingView({ rows: rowsOut, loading: false, err: '' });
    } catch (e) {
      console.error(e);
      setMissingView({
        rows: [],
        loading: false,
        err: 'Failed to compute missing subjects.',
      });
    }
  };

  useEffect(() => {
    if (sections.length && subjects.length) refreshMissing();
  }, [sections, subjects, reloadKey]);

  const filteredSectionsForUI = useMemo(() => {
    const pass = facultyType === 'advisory' ? filteredSections : sections;
    const q = search.trim().toLowerCase();
    return pass.filter((s) => {
      if (!q) return true;
      return `g${s.grade_level} - ${s.name}`.toLowerCase().includes(q);
    });
  }, [search, sections, filteredSections, facultyType]);

  const renderCards = () => {
    const g = Number(grade) || 7;
    if (viewMode === 'sectionSchedules') {
      return (
        <Section_Scheduling_Card
          key={`sec-${grade || 'all'}-${sectionId || 'all'}-${reloadKey}`}
          gradeLevel={grade === 'all' ? 'all' : grade ? Number(grade) : null}
          sectionId={sectionId}
          search={search}
        />
      );
    }
    return (
      <Teacher_Scheduling_Card
        key={`g-${g}-${reloadKey}`}
        gradeLevel={g}
        search={search}
        subjectId={subjectId}
        sectionId={sectionId}
        selectedDept={selectedDept}
      />
    );
  };

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />

      <Sub_Nav
        activeSection={viewMode}
        onSectionChange={setViewMode}
        items={[
          { key: 'teacherSchedules', label: 'Teacher Schedules' },
          { key: 'sectionSchedules', label: 'Section Schedules' },
        ]}
      />

      <div className="adminSchedulesContainer">
        <h2>Schedules</h2>

        <div className="analytics-grid">
          <div
            className={`analytics-card ${
              analytics.incompleteSections > 0
                ? 'analytics-card--warning'
                : 'analytics-card--success'
            }`}
          >
            <div className="analytics-card__label">
              Sections Missing Teachers
            </div>
            <div className="analytics-card__value">
              {analytics.loading ? '—' : analytics.incompleteSections}
            </div>
            <div className="analytics-card__description">
              Target is 8 distinct subjects per section
            </div>
          </div>

          <div
            className={`analytics-card ${
              analytics.scheduleConflicts > 0
                ? 'analytics-card--error'
                : 'analytics-card--success'
            }`}
          >
            <div className="analytics-card__label">Schedule Conflicts</div>
            <div className="analytics-card__value">
              {analytics.loading ? '—' : analytics.scheduleConflicts}
            </div>
            <div className="analytics-card__description">
              Duplicate teacher or section time slots
            </div>
          </div>

          <div className="analytics-card analytics-card--primary">
            <div className="analytics-card__label">Teachers Scheduled</div>
            <div className="analytics-card__value">
              {analytics.loading ? '—' : analytics.teachersScheduled}
            </div>
            <div className="analytics-card__description">
              Teachers with assignments
            </div>
          </div>

          <div className="analytics-card analytics-card--neutral">
            <div className="analytics-card__label">Total Assignments</div>
            <div className="analytics-card__value">
              {analytics.loading ? '—' : analytics.totalAssignments}
            </div>
            <div className="analytics-card__description">
              Teacher-section pairings
            </div>
          </div>
        </div>

        <div className="adminSchedulesSorter">
          <div className="adminScheduleSearch">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="adminScheduleSearchBar"
              placeholder="Search teacher or section..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loadingMeta}
            />
          </div>

          <div className="adminScheduleSortType">
            <label>Faculty Type</label>
            <select
              value={facultyType}
              onChange={(e) => setFacultyType(e.target.value)}
              disabled={loadingMeta || viewMode === 'sectionSchedules'}
              title={
                viewMode === 'sectionSchedules'
                  ? 'Not used in Section view'
                  : ''
              }
            >
              <option value="advisory">Advisers</option>
              <option value="noAdvisory">Non-Advisers</option>
            </select>
          </div>

          <div className="adminScheduleSortSubject">
            <label>Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={loadingMeta || viewMode === 'sectionSchedules'}
              title={
                viewMode === 'sectionSchedules'
                  ? 'Filter by Grade/Section instead'
                  : ''
              }
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="adminScheduleSortGrade">
            <label>Grade Level</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={loadingMeta}
            >
              <option value="all">All grades</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
            </select>
          </div>

          <div className="adminScheduleSortSection">
            <label>Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={
                loadingMeta ||
                (viewMode === 'teacherSchedules' &&
                  facultyType === 'advisory' &&
                  filteredSections.length === 0)
              }
            >
              <option value="">All Sections</option>
              {(viewMode === 'sectionSchedules'
                ? filteredSections
                : facultyType === 'advisory'
                  ? filteredSections
                  : sections
              ).map((sec) => (
                <option
                  key={sec.section_id}
                  value={sec.section_id}
                >{`G${sec.grade_level} - ${sec.name}`}</option>
              ))}
            </select>
          </div>

          <div
            className="adminScheduleActions"
            style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}
          >
            <button
              className="update-btn"
              onClick={handleAutoSchedule}
              disabled={running || loadingMeta || facultyType !== 'advisory'}
              title="Auto-schedule selected grade(s) or section"
            >
              {running ? 'Running...' : 'Auto-schedule'}
            </button>

            <button
              className="update-btn"
              onClick={handleClearAutoSchedule}
              disabled={running || loadingMeta || facultyType !== 'advisory'}
              title="Remove auto-scheduled slots for selected scope"
            >
              {running ? 'Running...' : 'Remove'}
            </button>
          </div>
        </div>

        {actionMsg && (
          <div style={{ margin: '10px 0', color: '#2b7fed', fontSize: 13 }}>
            {actionMsg}
          </div>
        )}

        <div className="gradeSchedulesContainer">{renderCards()}</div>
      </div>
      <div className="folderSelect">
        <h2 className="folder-title">Grade Level Folders</h2>

        <div className="folder-grid">
          <div className="folder-card grade7">
            <i className="fas fa-folder folder-icon"></i>
            <h3>Grade 7</h3>
          </div>

          <div className="folder-card grade8">
            <i className="fas fa-folder folder-icon"></i>
            <h3>Grade 8</h3>
          </div>

          <div className="folder-card grade9">
            <i className="fas fa-folder folder-icon"></i>
            <h3>Grade 9</h3>
          </div>

          <div className="folder-card grade10">
            <i className="fas fa-folder folder-icon"></i>
            <h3>Grade 10</h3>
          </div>
        </div>
      </div>

      <TeacherLoadConfig
        show={showLoadConfig}
        onClose={() => {
          setShowLoadConfig(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
};

export default Admin_Scheduling;
