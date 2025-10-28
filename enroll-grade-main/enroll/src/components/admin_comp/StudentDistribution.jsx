import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './studentDistribution.css'
import './dashboardver1.css'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const StudentDistribution = () => {
  const [schoolYear, setSchoolYear] = useState('');
  const [distributionData, setDistributionData] = useState([]);
  const [sortAscending, setSortAscending] = useState(true);

  useEffect(() => {
    // 1. Fetch students joined with enrollments (for SY, grade/status), and their section assignments
    async function fetchDistribution() {
      let { data, error } = await supabase.from('students').select(`
          gender,
          enrollments (
            grade_level,
            status,
            school_year
          ),
          student_sections (
            section_id,
            school_year,
            sections(
              grade_level,
              name
            )
          )
        `);

      if (error) {
        alert('Error fetching distribution');
        return;
      }

      // 2. Aggregate: only count those "approved" in enrollments and (optionally) matching SY
      const gradeMap = {};

      data.forEach((student) => {
        // filter for enrollment with approved status and match filter if given
        if (!student.enrollments || student.enrollments.status !== 'approved')
          return;
        if (schoolYear && student.enrollments.school_year !== schoolYear)
          return;

        // for every section the student is assigned to in this SY
        student.student_sections.forEach((ss) => {
          if (!ss.sections) return;
          // match by school year if filter given, or allow all
          if (schoolYear && ss.school_year !== schoolYear) return;
          const grade_level = ss.sections.grade_level;
          const section_name = ss.sections.name;
          const gender = student.gender;
          if (!grade_level) return;

          if (!gradeMap[grade_level]) {
            gradeMap[grade_level] = {
              male: 0,
              female: 0,
              sectionsSet: new Set(),
            };
          }
          gradeMap[grade_level].sectionsSet.add(section_name);
          if (gender && gender.toLowerCase() === 'male')
            gradeMap[grade_level].male++;
          else if (gender && gender.toLowerCase() === 'female')
            gradeMap[grade_level].female++;
        });
      });

      const distArray = Object.entries(gradeMap).map(([grade, info]) => ({
        grade,
        male: info.male,
        female: info.female,
        sectionsCount: info.sectionsSet.size,
        totalEnrolled: info.male + info.female,
      }));

      setDistributionData(distArray);
    }

    fetchDistribution();
  }, [schoolYear]);

  const toggleSort = () => {
    const sorted = [...distributionData].sort((a, b) =>
      sortAscending
        ? a.sectionsCount - b.sectionsCount
        : b.sectionsCount - a.sectionsCount
    );
    setDistributionData(sorted);
    setSortAscending(!sortAscending);
  };

  return (
    <div className='studentDistributionContainer'>
      <div style={{ padding: '20px' }}>
        <div className="sorter" style={{ marginTop: 24 }}>
          <label
            htmlFor="school-year"
            style={{ fontWeight: 600, marginRight: 12 }}
          >
            Select School Year:
          </label>
          <select
            id="school-year"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #b0bfd7',
              fontSize: '1rem',
              outline: 'none',
              minWidth: 120,
            }}
          >
            <option value="">All</option>
            <option value="2023-2024">2023-2024</option>
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
          </select>
        </div>

        <BarChart
          width={600}
          height={300}
          data={distributionData}
          margin={{ top: 20, right: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="grade" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="male" fill="#8884d8" />
          <Bar dataKey="female" fill="#82ca9d" />
        </BarChart>
        <div className="gradeDistributionContainer">
          <h3>Grade Distribution</h3>
          <table className="gradeDistributionTable">
            <thead>
              <tr>
                <th>Grade Level</th>
                <th onClick={toggleSort} className="sortableHeader">
                  Number of Sections {sortAscending ? '▲' : '▼'}
                </th>
                <th>Total Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {distributionData.map(({ grade, sectionsCount, totalEnrolled }) => (
                <tr key={grade}>
                  <td>{grade}</td>
                  <td>{sectionsCount}</td>
                  <td>{totalEnrolled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentDistribution;
