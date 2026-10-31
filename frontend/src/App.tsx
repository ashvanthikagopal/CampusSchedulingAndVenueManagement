import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/authContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './dashboards/Dashboard';
import { TimetableGrid } from './timetable/TimetableGrid';
import { BookingsPage } from './bookings/BookingsPage';
import { RescheduleDiffPage } from './rescheduling/RescheduleDiffPage';
import { ExamsPage } from './exams/ExamsPage';
import { AssistantPage } from './ai/AssistantPage';
import { AdminPage } from './pages/AdminPage';
import { ClubTimetable } from './timetable/ClubTimetable';

const queryClient = new QueryClient();

const AuthenticatedApp: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <LandingPage />;
  }

  const getDefaultElement = () => {
    if (user.role === 'club') return <ClubTimetable />;
    if (user.role === 'faculty' || user.role === 'department_coordinator') return <TimetableGrid />;
    return <Dashboard />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-white selection:text-zinc-950 font-sans">
      <div>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={getDefaultElement()} />
            <Route path="/timetable" element={<TimetableGrid />} />
            <Route path="/club-timetable" element={user.role === 'club' ? <ClubTimetable /> : <Navigate to="/" replace />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route 
              path="/approvals" 
              element={user.role === 'admin' ? <RescheduleDiffPage /> : <Navigate to="/" replace />} 
            />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route 
              path="/admin" 
              element={user.role === 'admin' ? <AdminPage /> : <Navigate to="/" replace />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-12">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>Chilika Institute of Technology · Campus Scheduling Platform</div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-emerald-400 font-semibold">0 Hard Violations</span>
            <span>·</span>
            <span className="font-mono text-teal-300 font-semibold">67.0 / 70 Fest Score</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthenticatedApp />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
