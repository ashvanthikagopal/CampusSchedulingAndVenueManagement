import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'department_coordinator' | 'faculty' | 'club' | 'student';
  department?: string;
  faculty_id?: string;
  club_name?: string;
  student_group?: string;
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

export interface AuthDirectory {
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
  loadDirectory: () => Promise<AuthDirectory | null>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hydrate user profile from backend on app start using token
  useEffect(() => {
    const hydrateUser = async () => {
      const storedToken = localStorage.getItem('cit_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          setToken(storedToken);
        } catch {
          // Token expired or invalid: clear storage
          localStorage.removeItem('cit_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    hydrateUser();
  }, []);

  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { identifier, password });
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('cit_token', access_token);
    return userData;
  };

  const loadDirectory = async (): Promise<AuthDirectory | null> => {
    try {
      const res = await api.get('/auth/directory');
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        // DEMO_MODE disabled on backend
        return null;
      }
      console.warn('Could not load directory from /auth/directory', err);
      return null;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cit_token');
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
