import { Header } from "../../components/Header";
import { Navigation_Bar } from "../../components/NavigationBar";
import './student_schedule.css'

export const Student_Schedule = () => {
    return (
        <>
            <Header userRole="student" />
            <Navigation_Bar userRole="student" />
            <div className="studentScheduleContainer">
                <div className="studentWelcoming">
                    <p>
                        Welcome, AYUSO JUAN BONINA (1136310046)
                    </p>
                </div>
                <div className="pageTitle">
                    <h2>My Daily Schedule</h2>
                </div>
                <div className="scheduleTableArea">
                    <div className="scheduleTableContainer">
                        <div className="scheduleTable">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Subject</th>
                                        <th>Subject Teacher</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>6:00 - 6:45 AM</td>
                                        <td>English</td>
                                        <td>Maria Teresa Dela Cruz</td>
                                    </tr>
                                    <tr>
                                        <td>6:45 - 7:30 AM</td>
                                        <td>Filipino</td>
                                        <td>Jose Emmanuel Santiago</td>
                                    </tr>
                                    <tr>
                                        <td>7:30 - 8:15 AM</td>
                                        <td>Science</td>
                                        <td>Ana Liza Ramirez</td>
                                    </tr>
                                    <tr>
                                        <td>8:15 - 9:00 AM</td>
                                        <td>Mathematics</td>
                                        <td>Roberto Mendoza</td>
                                    </tr>
                                    <tr className="recessRow">
                                        <td>9:00 - 9:20 AM</td>
                                        <td className = "recess"colSpan="2">RECESS</td>
                                    </tr>
                                    <tr>
                                        <td>9:20 - 10:05 AM</td>
                                        <td>Araling Panlipunan</td>
                                        <td>Lourdes Bautista</td>
                                    </tr>
                                    <tr>
                                        <td>10:05 - 10:50 AM</td>
                                        <td>MAPEH</td>
                                        <td>Carlo Villanueva</td>
                                    </tr>
                                    <tr>
                                        <td>10:50 - 11:35 AM</td>
                                        <td>Edukasyon sa Pagpapakatao</td>
                                        <td>Elena Rodriguez</td>
                                    </tr>
                                    <tr>
                                        <td>11:35 - 12:20 AM</td>
                                        <td>Technology and Livelihood Education</td>
                                        <td>Miguel Soriano</td>
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