import { createContext, useContext, useEffect, useState } from 'react';

const SessionContext = createContext({
  userId: null,
  role: null,
  loading: true,
  setSession: () => {},
  clearSession: () => {},
});

export const SessionProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = localStorage.getItem('user_id');
    const r = localStorage.getItem('role');
    if (uid) setUserId(Number(uid));
    if (r) setRole(r);
    setLoading(false);
  }, []);

  const setSession = (uid, r) => {
    localStorage.setItem('user_id', String(uid));
    localStorage.setItem('role', r);
    setUserId(Number(uid));
    setRole(r);
  };

  const clearSession = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    setUserId(null);
    setRole(null);
  };

  return (
    <SessionContext.Provider
      value={{ userId, role, loading, setSession, clearSession }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
