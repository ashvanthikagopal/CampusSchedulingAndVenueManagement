import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'department_coordinator' | 'faculty' | 'club';
  department?: string;
  faculty_id?: string;
  club_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
  demoLogin: (role: 'admin' | 'admin2' | 'coordinator' | 'faculty' | 'club') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('cit_user');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('cit_user');
      }
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('cit_token', access_token);
    localStorage.setItem('cit_user', JSON.stringify(userData));
  };

  const demoLogin = async (type: 'admin' | 'admin2' | 'coordinator' | 'faculty' | 'club') => {
    const map = {
      admin: { email: 'admin@cit.edu', pass: 'Admin@123' },
      admin2: { email: 'admin2@cit.edu', pass: 'Admin@123' },
      coordinator: { email: 'coord_cse@cit.edu', pass: 'Coord@123' },
      faculty: { email: 'faculty_f06@cit.edu', pass: 'Faculty@123' },
      club: { email: 'club_dance@cit.edu', pass: 'Club@123' },
    };
    const target = map[type];
    await login(target.email, target.pass);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cit_token');
    localStorage.removeItem('cit_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, demoLogin, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

