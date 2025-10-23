import { NavLink } from 'react-router-dom';
import './navigationbar.css';

export const Navigation_Bar = ({
  userRole,
  activeSection,
  onSectionChange,
}) => {
  if (userRole === 'student') {
    return (
      <div className="nav-bar">
        <div className="navigation-bar">
          <NavLink
            to="/Student_Homepage"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Enrollment
          </NavLink>
          <NavLink
            to="/Student_Schedule"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Schedule
          </NavLink>
          <NavLink
            to="/Student_Grades"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Grades
          </NavLink>
        </div>
      </div>
    );
  }

  if (userRole === 'applicant') {
    return (
      <div className="nav-bar">
        <div className="navigation-bar">
          <NavLink
            to="/Applicant_Homepage"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Home
          </NavLink>
        </div>
      </div>
    );
  }

  if (userRole === 'teacher') {
    return (
      <div className='nav-bar'>
        <div className="navigation-bar">
          <NavLink
            to="/Teacher_Homepage"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Classes
          </NavLink>
          <NavLink
            to="/Teacher_Grading"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Grading
          </NavLink>
          <NavLink
            to="/Teacher_Evaluation"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Evaluation
          </NavLink>
          <NavLink
            to="/Teacher_Schedule"
            className={({ isActive }) =>
              isActive ? 'nav-item active' : 'nav-item'
            }
            style={{ textDecoration: 'none' }}
          >
            Class Schedule
          </NavLink>
        </div>
      </div>
    );
  }

  if (userRole === 'super_admin') {
    return (
      <>
        <div className="nav-bar">
          <div className="navigation-bar">
            <NavLink
              to="/Dashboard"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/Analytics"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Analytics
            </NavLink>
            <NavLink
              to="/Admin-Enrollment"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Enrollment
            </NavLink>
            <NavLink
              to="/Placement"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Placement
            </NavLink>
            <NavLink
              to="/Scheduling"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Scheduling
            </NavLink>
            <NavLink
              to="/Admin-Grades"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Grades
            </NavLink>
            <NavLink
              to="/Manage"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Manage
            </NavLink>
          </div>
        </div>
      </>
    );
  }

  if (userRole === 'admin' || userRole === 'principal') {
    return (
      <>
        <div className="nav-bar">
          <div className="navigation-bar">
            <NavLink
              to="/Dashboard"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/Analytics"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Analytics
            </NavLink>
            <NavLink
              to="/Admin-Enrollment"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Enrollment
            </NavLink>
            <NavLink
              to="/Placement"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Placement
            </NavLink>
            <NavLink
              to="/Scheduling"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Scheduling
            </NavLink>
            <NavLink
              to="/Admin-Grades"
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
              style={{ textDecoration: 'none' }}
            >
              Grades
            </NavLink>
          </div>
        </div>
      </>
    );
  }

  return null;
};
