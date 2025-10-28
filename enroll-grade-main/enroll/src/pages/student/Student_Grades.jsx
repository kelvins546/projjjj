import { Header } from "../../components/Header";
import { Navigation_Bar } from "../../components/NavigationBar";
import './student_grades.css'

export const Student_Grades = () => {
    return (
        <>
            <Header userRole="student" />
            <Navigation_Bar userRole="student" />
            <div className="studentGradesContainer">
                <div className="syGradeSorter">
                    <div className="sorter">
                        <label>Select School Year</label>
                        <select>
                            <option value="">2025-2026</option>
                        </select>
                    </div>
                </div>
                <div className="gradesTableArea">
                    <div className="gradesTableContainer">
                        <div className="gradesTable">
                            <table>
                                <thead>
                                    <tr>
                                        <th rowSpan="2">Subject</th>
                                        <th rowSpan="2">Teacher</th>
                                        <th colSpan="4">Quarter</th>
                                        <th rowSpan="2">Final Grade</th>
                                        <th rowSpan="2">Remarks</th>
                                    </tr>
                                    <tr>
                                        <th>1st</th>
                                        <th>2nd</th>
                                        <th>3rd</th>
                                        <th>4th</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>English</td>
                                        <td>Ma. Teresa Ramos</td>
                                        <td>90</td><td>90</td><td>91</td><td>90</td>
                                        <td>90</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Filipino</td>
                                        <td>Roselyn Santos</td>
                                        <td>85</td><td>89</td><td>89</td><td>89</td>
                                        <td>88</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Science</td>
                                        <td>Benjamin Navarro</td>
                                        <td>92</td><td>90</td><td>92</td><td>94</td>
                                        <td>92</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Mathematics</td>
                                        <td>Lourdes Fernandez</td>
                                        <td>89</td><td>89</td><td>88</td><td>88</td>
                                        <td>89</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Araling Panlipunan</td>
                                        <td>Daniel Mendoza</td>
                                        <td>85</td><td>85</td><td>85</td><td>85</td>
                                        <td>85</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Edukasyon sa Pagpapakatao</td>
                                        <td>Jose Ramirez</td>
                                        <td>90</td><td>90</td><td>91</td><td>90</td>
                                        <td>90</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Technology and Livelihood Education</td>
                                        <td>Angelica Reyes</td>
                                        <td>86</td><td>87</td><td>90</td><td>90</td>
                                        <td>88</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Music and Arts</td>
                                        <td>Carlo Alvarez</td>
                                        <td>89</td><td>89</td><td>90</td><td>90</td>
                                        <td>90</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr>
                                        <td>Physical Education and Health</td>
                                        <td>Carlo Alvarez</td>
                                        <td>85</td><td>89</td><td>90</td><td>90</td>
                                        <td>89</td>
                                        <td><em>Passed</em></td>
                                    </tr>
                                    <tr className="averageRow">
                                        <td className="average"colSpan="6">Average</td>
                                        <td colSpan="2">88</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </>
    )
}