// src/hooks/useCurrentUserId.js
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useCurrentUserId = () => {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error.message);
        return;
      }
      setUserId(data.user?.id || null);
    };
    fetchUserId();
  }, []);

  return userId;
};
