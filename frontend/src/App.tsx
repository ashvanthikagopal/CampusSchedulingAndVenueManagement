import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/authContext';
import { ToastProvider } from './components/Toast';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './dashboards/Dashboard';
import { TimetableGrid } from './timetable/TimetableGrid';
import { BookingsPage } from './bookings/BookingsPage';
import { RescheduleDiffPage } from './rescheduling/RescheduleDiffPage';
import { ExamsPage } from './exams/ExamsPage';
import { AssistantPage } from './ai/AssistantPage';
import { AdminPage } from './pages/AdminPage';
import { MySchedulePage } from './faculty/MySchedulePage';
import { MyRequestsPage } from './faculty/MyRequestsPage';

const queryClient = new QueryClient();

const AuthenticatedApp: React.FC = () => {
  const { user } = useAuth();

  const { data: metrics } = useQuery({
    queryKey: ['liveMetrics'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/dashboard');
        return res.data;
      } catch {
        return {
          hard_conflicts: 0,
          booking_score: 0.0,
          max_booking_score: 75.0,
          soft_penalty_total: 3
        };
      }
    },
    refetchInterval: 30000,
    enabled: !!user
  });

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      <div>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/my-schedule" element={<MySchedulePage />} />
            <Route path="/my-requests" element={<MyRequestsPage />} />
            <Route path="/timetable" element={<TimetableGrid />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/approvals" element={<RescheduleDiffPage />} />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>Chilika Institute of Technology · Campus Scheduling Platform</div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-emerald-400">
              {metrics ? `${metrics.hard_conflicts} Hard Violations` : 'Loading metrics...'}
            </span>
            <span>·</span>
            <span className="font-mono text-sky-400">
              {metrics ? `${Number(metrics.booking_score).toFixed(1)} / ${Number(metrics.max_booking_score).toFixed(1)} Fest Score` : 'Computing...'}
            </span>
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
        <ToastProvider>
          <BrowserRouter>
            <AuthenticatedApp />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
