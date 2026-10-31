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

export interface DirectoryAdmin {
  name: string;
  email: string;
}

export interface DirectoryCoordinator {
  name: string;
  department: string;
  email: string;
}

export interface DirectoryFaculty {
  name: string;
  department: string;
  faculty_id: string;
  email: string;
}

export interface DirectoryClub {
  club_name: string;
  email: string;
}

export interface DirectoryData {
  admins: DirectoryAdmin[];
  coordinators: DirectoryCoordinator[];
  faculty: DirectoryFaculty[];
  clubs: DirectoryClub[];
  role_passwords_hint: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, pass: string) => Promise<User>;
  loadDirectory: () => Promise<DirectoryData | null>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from token by fetching profile
  useEffect(() => {
    const initAuth = async () => {
      const currentToken = localStorage.getItem('cit_token');
      if (currentToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          // Token expired or invalid
          localStorage.removeItem('cit_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { identifier, password });
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    // Persist only the token (do not persist user object)
    localStorage.setItem('cit_token', access_token);
    localStorage.removeItem('cit_user');
    return userData;
  };

  const loadDirectory = async (): Promise<DirectoryData | null> => {
    try {
      const res = await api.get('/auth/directory');
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        // DEMO_MODE is disabled on backend
        return null;
      }
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cit_token');
    localStorage.removeItem('cit_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loadDirectory, logout, isLoading }}>
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
