import './dashboard.css'
import { use, useState } from 'react'
import { Select } from '../buttons-inputs/Select';


export const Dashboard = () => {
    const [schoolYear, setShoolYear] = useState ("");
    const [grade, setGrade] = useState("");
    const [studentDistibutiongrade,setStudentDistibutionGrade] = useState("");
    const [studentDistibutionSection, setStudentDistibutionSection] = useState("");
    const [facultyAssignmentGrade, setFacultyAssignmentGrade] = useState("");
    const [facultyAssignmentSub, setFacultyAssignmentSub] = useState ("");
    const [gradingSummaryQuarter, setGradingSummaryQuarter] = useState ("");
    const [gradingSummaryGrade,setGradingSummaryGrade] = useState ("");
    const [topSectionQuarter, setTopSectionQuarter] = useState("");
    const [topSectionGrade, setTopSectionGrade] = useState("");

    return(
        <>
        <div className="enrollmentOverview">
            <div className="overview">
                <div className='sort-SY'>
                    <label>Select School Year</label>
                    <select value={schoolYear} onChange={(e) => setShoolYear(e.target.value)}>
                        
                        <option value="" disabled>School Year</option>
                        <option>Sample</option>
                    </select>
                </div>
                <div className='sort-Grade'>
                    <h1>Enrollment Overview</h1>
                    <div className='sorter-Grade'>
                        <label>Select Grade Level</label>
                        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                            <option value="">
                            All Grade
                            </option>
                            <option value="Grade 7">Grade 7</option>
                            <option value="Grade 8">Grade 8</option>
                            <option value="Grade 9">Grade 9</option>
                            <option value="Grade 10">Grade 10</option>
                        </select>
                    </div>
                </div>
                <div className='enrollment-stat-cards'>
                    <div className='card'>
                        <h2>1200</h2>
                        <h1>Total Enrolled Students</h1>
                    </div>
                    <div className='card'>
                        <h2>122</h2>
                        <h1>Pending Applications</h1>
                    </div>
                </div>
            </div>
            <div className="enroll_chart">
                <div className='chart'>Chart</div>
            </div>
        </div>
        <div className='studentDistribution'>
            <div className='studentDistributionP1'>
                <h1>Students by Grade</h1>
                <div className='gradeSection_sorter'>
                    <div className='sorter-grade'>
                        <label>Select Grade Level</label>
                        <select value={studentDistibutiongrade} onChange={(e) => setStudentDistibutionGrade(e.target.value)}>
                            <option value="">
                            All Grade
                            </option>
                            <option value="Grade 7">Grade 7</option>
                            <option value="Grade 8">Grade 8</option>
                            <option value="Grade 9">Grade 9</option>
                            <option value="Grade 10">Grade 10</option>
                        </select>
                    </div>
                    <div className='sorter-section'>
                        <label>Select Section</label>
                        <select value={studentDistibutionSection} onChange={(e) => setStudentDistibutionSection(e.target.value)}>
                            <option value="">
                            Section
                            </option>
                            <option>All Section</option>
                            <option value="Grade 7">Sample</option>
                            <option value="Grade 8">Sample</option>
                        </select>
                    </div>
                </div>
                <div className="table-container">
                    <table className="table1">
                        <thead>
                        <tr>
                            <th>Grade Level</th>
                            <th>No. of Sections</th>
                            <th>Total Enrolled</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td>Grade Level 7</td>
                            <td>8</td>
                            <td>200</td>
                        </tr>
                        <tr>
                            <td>Grade Level 8</td>
                            <td>8</td>
                            <td>200</td>
                        </tr>
                        <tr>
                            <td>Grade Level 9</td>
                            <td>8</td>
                            <td>320</td>
                        </tr>
                        <tr>
                            <td>Grade Level 10</td>
                            <td>12</td>
                            <td>300</td>
                        </tr>
                        </tbody>
                    </table>
                </div>

            </div>
            <div className='studentDistributionP2'>
                <h1>Chart</h1>
            </div>
        </div>
        <div className='facultyAssignment'>
            <h1>Teacher Load Summary</h1>
            <div className='facultyAssignmentP1'>
                <div className='teachersSummary'>
                    <div className='teacherLoadSummary'>
                        <div className='card overloadedTeacher'>
                            <h2>2</h2>
                            <h1>Overloaded Teachers</h1>
                        </div>
                        <div className='card vacantCompliance'>
                            <h1>Vacant Period Compliance</h1>
                            <div className='complianceStatContainer'>
                                <div className='complianceStat'>
                                    <h1>50</h1>
                                    <p>Compliant</p>
                                </div>
                                <div className='complianceStat'>
                                    <h1>50</h1>
                                    <p>Non - Compliant</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='teachersPerGrade'>
                    <div className='teachersPerGradeChart'>Chart</div>
                </div>
            </div>
            <div className='facultyAssignmentP2'>
                <div className='facultyAssignmentSorter'>
                    <div className='facultyAssignment-search-sort'>
                        <div className='facultyAssignmentSearch'>
                            <i class="fa fa-search" aria-hidden="true"></i>
                            <input className='search'></input>
                        </div>
                        <div className='sorter-grade'>
                            <label>Select Grade Level</label>
                            <select value={facultyAssignmentGrade} onChange={(e) => setFacultyAssignmentGrade(e.target.value)}>
                                <option value="">
                                All Grade
                                </option>
                                <option value="Grade 7">Grade 7</option>
                                <option value="Grade 8">Grade 8</option>
                                <option value="Grade 9">Grade 9</option>
                                <option value="Grade 10">Grade 10</option>
                            </select>
                        </div>
                        <div className='sorter-subject'>
                            <label>Faculty/Subject</label>
                            <select value={facultyAssignmentSub} onChange={(e) => setFacultyAssignmentSub(e.target.value)}>
                                <option value="" disabled>
                                Select Subject
                                </option>
                                <option value="">Mathematics</option>
                                <option value="">English</option>
                                <option value="">Filipino</option>
                                <option value="">Science</option>
                            </select>
                        </div>
                    </div>
                    <div className='facultyAssignmentTable'>
                        <div>
                            <table class="faculty-periods-table">
                                <thead>
                                    <tr>
                                        <th rowspan="2">Name</th>
                                        <th rowspan="2">Faculty</th>
                                        <th rowspan="2">Grade Level</th>
                                        <th colspan="5">No. of Periods per day</th>
                                        <th rowspan="2">Total</th>
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
                                    <tr>
                                        <td>Juan Ayuso</td>
                                        <td>Science</td>
                                        <td>Grade Level 7</td>
                                        <td>5</td>
                                        <td>5</td>
                                        <td>7</td>
                                        <td>6</td>
                                        <td>4</td>
                                        <td>27</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className='workChart'>chart</div>
            </div>
        </div>
        <div className='gradingSummary'>
            <h1>Grade Summary</h1>
            <div className='gradingSummaryP1'>
                <div className='gradingSummaryQuarterSort'>
                    <label>Quarter</label>
                    <select value={gradingSummaryQuarter} onChange={(e) => setGradingSummaryQuarter(e.target.value)}>
                        <option value="" disabled>
                        Quarter
                        </option>
                        <option value="Grade 7">1st</option>
                        <option value="Grade 8">2nd</option>
                        <option value="Grade 9">3rd</option>
                        <option value="Grade 10">4th</option>
                    </select>
                </div>  
                <div className='gradingSummaryGradeSort'>
                    <label>Select Grade Level</label>
                    <select value={gradingSummaryGrade} onChange={(e) => setGradingSummaryGrade(e.target.value)}>
                        <option value="">
                        All Grade
                        </option>
                        <option value="Grade 7">Grade 7</option>
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                    </select>
                </div>
            </div>
            <div className='gradingSummaryP2'>
                <div className='card teacher-grade-submission'>
                    <div className='submissionStat'>
                        <h1>10%</h1>
                        <p>Has submitted their grades</p>
                    </div>
                    <div className='submissionStat'>
                        <h1>10%</h1>
                        <p>Has not yet submitted their grades</p>
                    </div>
                </div>
                <div className='card teacher-grade-submission'>
                    <div className='submissionStat'>
                        <h1>10%</h1>
                        <p>Has verified the grades</p>
                    </div>
                    <div className='submissionStat'>
                        <h1>10%</h1>
                        <p>Has not yet verified the grades</p>
                    </div>
                </div>
            </div>
            <div className='gradingSummaryP3'>
                <div className='passingRateTitle'><h1>Passing Rate</h1></div>
                <div className='passingRateChart'>
                    <div style={{width:"150px", height:"150px", borderRadius:"90px", backgroundColor:"blue"}}></div>
                    <div style={{width:"150px", height:"150px", borderRadius:"90px", backgroundColor:"blue"}}></div>
                    <div style={{width:"150px", height:"150px", borderRadius:"90px", backgroundColor:"blue"}}></div>
                    <div style={{width:"150px", height:"150px", borderRadius:"90px", backgroundColor:"blue"}}></div>
                </div>
            </div>
            <div className='gradingSummaryP4'>
                <div className='topSections'>
                    <div className='topSectionsSorter'>
                        <div className='gradingSummaryQuarterSort'>
                            <label>Quarter</label>
                            <select value={topSectionQuarter} onChange={(e) => setTopSectionQuarter(e.target.value)}>
                                <option value="" disabled>
                                Quarter
                                </option>
                                <option value="Grade 7">1st</option>
                                <option value="Grade 8">2nd</option>
                                <option value="Grade 9">3rd</option>
                                <option value="Grade 10">4th</option>
                            </select>
                        </div>  
                        <div className='gradingSummaryGradeSort'>
                            <label>Select Grade Level</label>
                            <select value={topSectionGrade} onChange={(e) => setTopSectionGrade(e.target.value)}>
                                <option value="">
                                All Grade
                                </option>
                                <option value="Grade 7">Grade 7</option>
                                <option value="Grade 8">Grade 8</option>
                                <option value="Grade 9">Grade 9</option>
                                <option value="Grade 10">Grade 10</option>
                            </select>
                        </div>
                    </div>
                    <div className='topSectionTable'>
                        <div className="table-container">
                            <table className="table1">
                                <thead>
                                <tr>
                                    <th>Section</th>
                                    <th>Average</th>
                                    <th>Grade Level</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>Grade Level 7</td>
                                    <td>8</td>
                                    <td>200</td>
                                </tr>
                                <tr>
                                    <td>Grade Level 8</td>
                                    <td>8</td>
                                    <td>200</td>
                                </tr>
                                <tr>
                                    <td>Grade Level 9</td>
                                    <td>8</td>
                                    <td>320</td>
                                </tr>
                                <tr>
                                    <td>Grade Level 10</td>
                                    <td>12</td>
                                    <td>300</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className='averageGradeChart'>
                    chart
                </div>
            </div>
        </div>
        </>
    )
}