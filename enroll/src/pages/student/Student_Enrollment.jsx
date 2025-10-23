import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { Enrollment_Container } from '../../components/containers/Enrollment_Container';
import './student_enrollment.css';
export const Student_Enrollment = () => {
  const [enrollmentStep, setEnrollmentStep] = useState(1);
  const [iD, setId] = useState('');

  return (
    <>
      <Header userRole="student" />
      <Navigation_Bar userRole="student" />
      <div className="studentEnrollmentContainer">
        <div className="pageTitle">
          {enrollmentStep === 1 && (
            <Link to="/Student_Homepage">
              <i className="fa fa-chevron-left" aria-hidden="true" />
            </Link>

          )}

          <h2>
            {enrollmentStep === 2
              ? 'Parent/Guardian Agreement Form'
              : 'Enrollment Form'}
          </h2>
        </div>
        <div className="enrollmentArea">
          <Enrollment_Container>
            {enrollmentStep === 1 && (
              <>
                <div className="studentInfoContainer">
                  <h1>Student Information</h1>
                  <div className="studentInfo">
                    <div className="studentDataInfos">
                      <div className="student_Data">
                        <label>LRN</label>
                        <input disabled />
                      </div>
                      <div className="student_Data">
                        <label>Grade Level</label>
                        <input disabled />
                      </div>
                      <div className="student_Data">
                        <label>School Year</label>
                        <input disabled />
                      </div>
                    </div>
                    <div className="studentDataInfos">
                      <div className="student_Data">
                        <label>Last Name</label>
                        <input disabled />
                      </div>
                      <div className="student_Data">
                        <label>First Name</label>
                        <input disabled />
                      </div>
                      <div className="student_Data">
                        <label>Middle Name</label>
                        <input disabled />
                      </div>
                      <div className="student_Data">
                        <label>Suffix</label>
                        <input type="text" className="suffix" disabled />
                      </div>
                    </div>
                    <div className="studentDocs">
                      <div className="cardUpload">
                        <div className="document_Label">
                          <label>Report Card:</label>
                        </div>
                        <div className="document_Upload_Button">
                          <input type="file" id="fileUpload" hidden />
                          <label for="fileUpload" className="upload-btn-Card">
                            Upload File
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="buttons_Container">
                    <div className="buttons">
                      <button onClick={() => setEnrollmentStep(2)}>Next</button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {enrollmentStep === 2 && (
              <>
                <div className="agreementContainer">
                  <div class="agreement">
                    <p>
                      As the parent/guardian of the above-named student, I
                      hereby acknowledge and agree to the following:
                    </p>

                    <ol>
                      <li>
                        <strong>Commitment to Education</strong>
                        <ul>
                          <li>
                            I will support my child’s regular attendance,
                            punctuality, and participation in school activities.
                          </li>
                          <li>
                            I will encourage my child to complete assignments,
                            projects, and requirements on time.
                          </li>
                          <li>
                            I will provide a conducive learning environment at
                            home.
                          </li>
                        </ul>
                      </li>

                      <li>
                        <strong>Conduct and Discipline</strong>
                        <ul>
                          <li>
                            I understand that my child is expected to follow the
                            school’s rules, regulations, and code of conduct.
                          </li>
                          <li>
                            I will cooperate with teachers and school
                            administrators in addressing any behavioral or
                            academic issues.
                          </li>
                        </ul>
                      </li>

                      <li>
                        <strong>Communication and Cooperation</strong>
                        <ul>
                          <li>
                            I will attend parent-teacher meetings, orientations,
                            and conferences when required.
                          </li>
                          <li>
                            I will promptly inform the school of any changes in
                            contact information, health conditions, or family
                            matters that may affect my child’s schooling.
                          </li>
                        </ul>
                      </li>

                      <li>
                        <strong>Financial Responsibilities</strong>
                        <ul>
                          <li>
                            I agree to settle school fees and other
                            school-related obligations on or before the
                            deadlines set by the school.
                          </li>
                          <li>
                            I understand that failure to fulfill financial
                            responsibilities may affect my child’s enrollment
                            status.
                          </li>
                        </ul>
                      </li>

                      <li>
                        <strong>Safety and Welfare</strong>
                        <ul>
                          <li>
                            I authorize the school to take appropriate action in
                            case of emergency, accident, or illness involving my
                            child.
                          </li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                  <p>
                    <strong>Acknowledgement</strong>
                  </p>
                  <div className="acknowledge_Infos">
                    <div className="acknowledge_Info">
                      <input type="checkbox" />
                      <label>
                        I have read, understood, and agreed to abide by the
                        policies, rules, and regulations of the school.
                      </label>
                    </div>
                    <div className="acknowledge_Info">
                      <input type="checkbox" />
                      <label>
                        I understand that enrollment signifies acceptance of
                        this agreement.
                      </label>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '17px' }}>
                      Please upload a valid Government-issued ID to continue.
                    </p>
                  </div>
                  <div className="upload_ID">
                    <div className="id_Select">
                      <label>Goverment Id</label>
                      <select
                        value={iD}
                        onChange={(e) => setId(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Select ID
                        </option>
                        <option>Passport</option>
                        <option>National ID</option>
                        <option>Voter's ID</option>
                        <option>UMID</option>
                      </select>
                    </div>
                    <div className="government_ID_Upload">
                      <input type="file" id="fileUpload" hidden />
                      <label for="fileUpload" className="upload-btn-Gov-ID">
                        Upload File
                      </label>
                    </div>
                  </div>
                  <div className="buttons_Container">
                    <div className="buttons">
                      <button onClick={() => setEnrollmentStep(1)}>Back</button>
                      <button>Submit</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Enrollment_Container>
        </div>
      </div>
    </>
  );
};
