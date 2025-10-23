import './scheduling_card.css';

export const TeacherSchedule_Gr7 = () => {
  return (
    <>
      <div className="faculty-card">
        <div className="faculty_card_header_grade7"></div>

        <div className="faculty-card-body">
          <h3>Name: Karen M. Corpus</h3>
          <p>
            <strong>Department:</strong> Filipino Dept
          </p>
          <p>
            <strong>Advisory Class:</strong> John
          </p>
          <p>
            <strong>Grade:</strong> 7
          </p>

          <div className="faculty-details">
            <div>
              <p>
                <strong>Degree:</strong> BSED
              </p>
              <p>
                <strong>Major:</strong> English
              </p>
              <p>
                <strong>Minor:</strong>
              </p>
            </div>
            <div>
              <p>
                <strong>Post Grad:</strong> Masters
              </p>
              <p>
                <strong>Course:</strong> MAEd
              </p>
            </div>
          </div>

          <p>
            <strong>Teaching load per week:</strong> 5+1 / 1140 mins (weekly)
          </p>
          <p>
            <strong>Position:</strong> T-I
          </p>

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
  );
};
