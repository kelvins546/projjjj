import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { supabase } from '../../supabaseClient';
import { Navigation_Bar } from '../../components/NavigationBar';
import './applicant_profile.css';

export const Applicant_Profile = () => {
  const [student, setStudent] = useState(null);
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState('/default-profile.png');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    async function fetchProfile() {
      const { data: studentData } = await supabase
        .from('students')
        .select(
          'lrn, last_name, first_name, middle_name, suffix, birthdate, profile_photo_url'
        )
        .eq('user_id', userId)
        .single();

      setStudent(studentData);

      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('user_id', userId)
        .single();

      setUser(userData);

      if (studentData?.profile_photo_url)
        setProfilePic(studentData.profile_photo_url);

      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfilePic(URL.createObjectURL(file));
  };

  if (loading)
    return (
      <>
        <Header />
        <div className="mainContent">Loading...</div>
      </>
    );

  return (
    <>
      <Header userRole="applicant" />
      <Navigation_Bar />
      <Navigation_Bar userRole="applicant" />
      <div className="mainContent">
        <h1 className="profileTitle">Applicant’s Profile</h1>
        <div className="profileContainer">
          <form className="profileForm">
            <div className="formRow">
              <div className="formColumn">
                <label>
                  LRN
                  <input
                    value={student?.lrn || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
                <label>
                  Last Name
                  <input
                    value={student?.last_name || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
                <label>
                  Birth date
                  <input
                    value={student?.birthdate || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
              </div>
              <div className="formColumn">
                <label>
                  First Name
                  <input
                    value={student?.first_name || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
                <label>
                  Middle Name
                  <input
                    value={student?.middle_name || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
                <label>
                  Email
                  <input
                    value={user?.email || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
              </div>
              <div className="suffixColumn">
                <label>
                  Suffix
                  <input
                    value={student?.suffix || ''}
                    disabled
                    className="profileInput"
                  />
                </label>
              </div>
            </div>
            <button type="button" className="changePasswordBtn">
              Change Password
            </button>
          </form>
          <div className="profilePictureContainer">
            <img src={profilePic} alt="Profile" className="profilePicture" />
            <label htmlFor="applicant-upload">
              <input
                id="applicant-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePicChange}
              />
              <button type="button" className="uploadButton">
                Upload
              </button>
            </label>
          </div>
        </div>
      </div>
    </>
  );
};
