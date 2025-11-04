import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { LoadingPopup } from '../../components/loaders/LoadingPopup';
import './applicant_profile.css';

export const Applicant_Profile = () => {
  const [student, setStudent] = useState(null);
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState('/default-profile.png');
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    async function fetchProfile() {
      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select(
            'lrn, last_name, first_name, middle_name, suffix, birthdate, profile_photo_url'
          )
          .eq('user_id', userId)
          .single();

        if (studentError) console.error(studentError);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('user_id', userId)
          .single();

        if (userError) console.error(userError);

        setStudent(studentData);
        setUser(userData);

        if (studentData?.profile_photo_url) {
          setProfilePic(studentData.profile_photo_url);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfilePic(URL.createObjectURL(file));
  };

  if (loading) return <LoadingPopup />;

  return (
    <>
      <Header userRole="applicant" />
      <Navigation_Bar userRole="applicant" />
      <div className="applicantProfileContainer">
        <div className="applicantDetails">
          <div className="applicantDatas">
            <div className="applicantDataName">
              <h2>
                {student
                  ? `${student.first_name} ${student.middle_name || ''} ${student.last_name} ${student.suffix || ''}`
                  : 'Loading...'}
              </h2>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Birthdate:</p>
                <p className="userData">{student?.birthdate || 'N/A'}</p>
              </div>
            </div>

            <div className="applicantDataContainer">
              <div className="applicantData">
                <p className="data">Email:</p>
                <p className="userData">{user?.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="applicantPhotoContainer">
            <div className="applicantPhoto">
              <img
                src={profilePic}
                alt="Applicant"
                className="profilePicture"
              />
              <label htmlFor="photo-upload" className="cameraOverlay">
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePicChange}
                />
                <i className="fa fa-camera" aria-hidden="true"></i>
              </label>
            </div>
          </div>
          <div className="profileOptionContainer">
            <i
              className="fa fa-ellipsis-h profileOptionIcon"
              aria-hidden="true"
              onClick={() => setShowDropdown((prev) => !prev)}
            ></i>

            {showDropdown && (
              <div className="profileDropdown">
                <button
                  className="dropdownItem"
                  onClick={() => alert('Change Password clicked!')}
                >
                  <i className="fa fa-key" aria-hidden="true"></i> Change
                  Password
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
