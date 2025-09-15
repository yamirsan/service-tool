import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/me`);
      setUser(res.data);
      setIsAuthenticated(true);
      return res.data; // return profile so callers can use it
    } catch (e) {
      // token invalid
      setIsAuthenticated(false);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    // Initialize auth state and wait for profile fetch before clearing loading
    (async () => {
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await fetchProfile();
      }
      setLoading(false);
    })();
  }, []);

  const login = async (username, password) => {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post(`${API}/token`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      const profile = await fetchProfile();
      return { success: true, user: profile };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  // Normalize role and permissions to be case-insensitive and whitespace-tolerant
  const normalizedRole = String(user?.role ?? '').trim().toLowerCase();
  const permsList = String(user?.permissions ?? '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const baseAdmin = normalizedRole === 'admin';
  const hasPermission = (perm) => baseAdmin || permsList.includes(String(perm ?? '').trim().toLowerCase());
  // Treat users with any elevated permission as admin-equivalent for routing/UX
  const adminPerms = new Set(['manage_users','manage_parts','manage_formulas','manage_samsung_models','upload_excel']);
  const usernameNorm = String(user?.username ?? '').trim().toLowerCase();
  const isAdmin = baseAdmin || permsList.some(p => adminPerms.has(p)) || usernameNorm === 'admin';

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading,
    isAdmin,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
