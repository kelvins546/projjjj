import './scheduling_card.css'

export const TeacherSchedule_Gr10 = () => {
    return (
        <>
            <div className="faculty-card">
                <div className="faculty_card_header_grade10"></div>

                <div className="faculty-card-body">
                    <h3>Name: Marissa B. Dela Pacion</h3>
                    <p><strong>Department:</strong> Filipino Department</p>
                    <p><strong>Advisory Class:</strong> Luke</p>
                    <p><strong>Grade:</strong> 7</p>

                    <div className="faculty-details">
                        <div>
                            <p><strong>Degree:</strong> BSE</p>
                            <p><strong>Major:</strong> English</p>
                            <p><strong>Minor:</strong> Filipino</p>
                        </div>
                        <div>
                            <p><strong>Post Grad:</strong> Masters</p>
                            <p><strong>Course:</strong> MAEd</p>
                        </div>
                    </div>

                    <p><strong>Teaching load per week:</strong> 5+1 / 1360 mins (weekly)</p>
                    <p><strong>Position:</strong> T-I</p>

                    <table className="faculty-schedule">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Mon</th>
                                <th>Tue</th>
                                <th>Wed</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>6:00 - 6:45</td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>6:45 - 7:30</td>
                                <td>Daniel 404 A</td>
                                <td>Daniel 404 A</td>
                                <td>Daniel 404 A</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}