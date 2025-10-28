import './admin_grades.css';
import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';

export const Admin_Grades = () => {
  const [showMassLock, setShowMassLock] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showUnlockNotif, setShowUnlockNotif] = useState(false);
  const [manageEncoding, setShowManageEncoding] = useState(false);
  const [applyChanges, setShowApplyChanges] = useState(false);
  const [applyNotif, setShowApplyNotif] = useState(false);

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />

      <div className="gradingContainer">
        <h2>Grading</h2>

        <div className="gradingSearchSection">
          <div className="gradingSearch">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input className="gradingSearchBar" />
          </div>
        </div>

        <div className="gradingSorter">
          <div className="gradingSorter-quarter">
            <label>Quarter</label>
            <select>
              <option>1st</option>
              <option>2nd</option>
              <option>3rd</option>
              <option>4th</option>
            </select>
          </div>

          <div className="gradingSorter-grade">
            <label>Grade Level</label>
            <select>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </div>

          <div className="gradingSorter-section">
            <label>Section</label>
            <select>
              <option>Sample</option>
              <option>Sample</option>
              <option>Sample</option>
              <option>Sample</option>
            </select>
          </div>

          <div className="gradingSorter-subject">
            <label>Faculty/Subject</label>
            <select>
              <option>Sample</option>
              <option>Sample</option>
              <option>Sample</option>
              <option>Sample</option>
            </select>
          </div>

          <div className="gradingSorter-status">
            <label>Status</label>
            <select>
              <option>Submitted to Adviser</option>
              <option>Submitted by Adviser</option>
            </select>
          </div>
        </div>
        <div className="gradingTableContainer">
          <div className="gradingTableHeader">
            <label>
              <input type="checkbox" /> Select All
            </label>
            <button
              className="massLockBtn"
              onClick={() => setShowMassLock(true)}
            >
              Unlock Grade Encoding
            </button>
          </div>
          {showMassLock && (
            <div className="massLockOverlay">
              <div className="massLockModal">
                <h2>Grade Encoding</h2>
                <p>Select the grade level to unlock:</p>
                <div className="lockDuration">
                  <label>Unlock Duration:</label>
                  <input className="calendar" type="date" />
                </div>
                <div className="massLockOptions">
                  <label>
                    <input type="checkbox" name="grade" /> Grade 7
                  </label>
                  <label>
                    <input type="checkbox" name="grade" /> Grade 8
                  </label>
                  <label>
                    <input type="checkbox" name="grade" /> Grade 9
                  </label>
                  <label>
                    <input type="checkbox" name="grade" /> Grade 10
                  </label>
                </div>

                <div className="massLockActions">
                  <button
                    className="cancelBtn"
                    onClick={() => setShowMassLock(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="lockBtn"
                    onClick={() => setShowUnlockConfirm(true)}
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          )}
          <table>
            <tbody>
              <tr>
                <th></th>
                <th>Name of teacher</th>
                <th>Advisers</th>
                <th>Grade Level</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Quarter</th>
                <th>Status</th>
                <th>Encoding Window</th>
                <th>Actions</th>
              </tr>

              <tr>
                <td>
                  <input type="checkbox" />
                </td>
                <td>Jose Marie Chan</td>
                <td>Ana Liza Ramirez</td>
                <td>7</td>
                <td>Apple</td>
                <td>English</td>
                <td>1st</td>
                <td>
                  <div className="status submitted">Submitted to adviser</div>
                </td>
                <td>
                  <div className="encoding unlocked">Unlocked</div>
                </td>
                <td>
                  <button onClick={() => setShowManageEncoding(true)}>
                    Manage Encoding
                  </button>
                </td>
              </tr>

              <tr>
                <td>
                  <input type="checkbox" />
                </td>
                <td>Jose Marie Chan</td>
                <td>Ana Liza Ramirez</td>
                <td>7</td>
                <td>Apple</td>
                <td>English</td>
                <td>1st</td>
                <td>
                  <div className="status approved">Approved by adviser</div>
                </td>
                <td>
                  <div className="encoding locked">Locked</div>
                </td>
                <td>
                  <button onClick={() => setShowManageEncoding(true)}>
                    Manage Encoding
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          {manageEncoding && (
            <div className="manageEncodingOverlay">
              <div className="manageEncodingModal">
                <div className="backButton">
                  <i
                    class="fa fa-times"
                    aria-hidden="true"
                    onClick={() => setShowManageEncoding(false)}
                  ></i>
                </div>
                <h2>Manage Encoding Window</h2>
                <div className="teacherInfoContainer">
                  <div className="teacherInfoCard">
                    <div className="teacherInfoCardHeader grade7"></div>
                    <div className="teacherInfoCardData">
                      <h3>Name: Marissa B. Dela Pacion</h3>
                      <p>Department: Filipino Department</p>
                      <p>Advisory Class: Luke</p>
                      <p>Grade: 7</p>
                    </div>
                  </div>
                  <div className="statusTagsCard">
                    <div className="status submitted">
                      <p>Submitted to Adviser</p>
                    </div>
                    <div className="status approved">
                      <p>Submitted to Adviser</p>
                    </div>
                    <div className="encoding unlocked">
                      <p>Locked</p>
                    </div>
                    <div className="encoding locked">
                      <p>Locked</p>
                    </div>
                  </div>
                </div>
                <div className="encodingAccessBox">
                  <h3>Encoding Access</h3>
                  <div className="encodingActionBtns">
                    <button
                      className="unlockBtn"
                      style={{
                        color: '#28a745',
                        border: '1px solid #28a745',
                        backgroundColor: '#f6fff6',
                      }}
                    >
                      <i className="fa fa-unlock"></i> Unlock
                    </button>
                    <button
                      className="lockBtn"
                      style={{
                        color: '#d9534f',
                        border: '1px solid #d9534f',
                        backgroundColor: '#fff5f5',
                      }}
                    >
                      <i className="fa fa-lock"></i> Lock
                    </button>
                  </div>

                  <div className="manageEncodingDateInputs">
                    <div>
                      <label>Effective from</label>
                      <input className="calendar" type="date" />
                    </div>
                    <div>
                      <label>Effective until</label>
                      <input className="calendar" type="date" />
                    </div>
                  </div>

                  <div className="manageEncodingMessageBox">
                    <label>Message/Reason</label>
                    <textarea placeholder="e.g. Allow encoding for extension..." />
                  </div>

                  <div className="manageEncodingNotifyBox">
                    <input type="checkbox" id="notify" />
                    <label htmlFor="notify">Notify by Email</label>
                  </div>
                </div>

                <div className="manageEncodingButtonContainer">
                  <button onClick={() => setShowManageEncoding(false)}>
                    Cancel
                  </button>
                  <button onClick={() => setShowApplyChanges(true)}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
          <ReusableModalBox
            show={applyChanges}
            onClose={() => setShowApplyChanges(false)}
          >
            <div className="applyConfirmation">
              <div className="applyConfirmationTitle">
                <h2>Apply Changes</h2>
              </div>
              <div className="buttonContainer">
                <button
                  onClick={() => setShowApplyChanges(false)}
                  style={{
                    border: '1px solid black',
                    backgroundColor: 'transparent',
                    color: 'black',
                  }}
                >
                  Cancel
                </button>
                <button onClick={() => setShowApplyNotif(true)}>Apply</button>
              </div>
            </div>
          </ReusableModalBox>
          <ReusableModalBox
            show={applyNotif}
            onClose={() => setShowApplyNotif(false)}
          >
            <div className="notif">
              <div className="img" style={{ paddingTop: '10px' }}>
                <img
                  src="checkImg.png"
                  style={{ height: '50px', width: '50px' }}
                />
              </div>
              <div className="notifMessage">
                <span>Changes Applied </span>
                <span>Successfully!</span>
              </div>
            </div>
          </ReusableModalBox>
        </div>
      </div>
      <ReusableModalBox
        show={showUnlockConfirm}
        onClose={() => setShowUnlockConfirm(false)}
      >
        <div className="unlockConfirmation">
          <div className="unlockConfirmationTitle">
            <h2>Unlock Grade encoding for the selected year levels?</h2>
            <p>
              Teachers will be able to encode grades before the encoding
              duration ends.
            </p>
          </div>
          <div className="buttonContainer">
            <button
              onClick={() => setShowUnlockConfirm(false)}
              style={{
                border: '1px solid black',
                backgroundColor: 'transparent',
                color: 'black',
              }}
            >
              Cancel
            </button>
            <button onClick={() => setShowUnlockNotif(true)}>Confirm</button>
          </div>
        </div>
      </ReusableModalBox>
      <ReusableModalBox
        show={showUnlockNotif}
        onClose={() => setShowUnlockNotif(false)}
      >
        <div className="notif">
          <div className="img" style={{ paddingTop: '10px' }}>
            <img
              src="checkImg.png"
              alt="Bagong Pilipinas Logo"
              style={{ height: '50px', width: '50px' }}
            />
          </div>
          <div className="notifMessage">
            <span>Successfully Unlocked</span>
            <span>the Encoding of Grades!</span>
          </div>
        </div>
      </ReusableModalBox>
    </>
  );
};
