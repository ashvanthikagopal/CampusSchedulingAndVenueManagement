import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/authContext';
import { ToastProvider } from './components/Toast';
import { api } from './services/api';
import { AppShell } from './components/AppShell';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
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
  const { user, isLoading } = useAuth();

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

  // Restore the saved session before deciding whether a route is public.
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center bg-[#F5F7FB] text-sm text-[#475569]">
        Loading your session…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* Logout and invalid saved sessions return every role to the landing page.
            Replace the protected URL so Back does not reopen the signed-out page. */}
        {['/my-schedule', '/my-requests', '/timetable', '/bookings', '/approvals', '/exams', '/assistant', '/admin'].map(path => (
          <Route key={path} path={path} element={<Navigate to="/" replace />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  return (
    <AppShell metrics={metrics}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/my-schedule"
          element={user.role === 'faculty' ? <MySchedulePage /> : <NotFoundPage />}
        />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route path="/timetable" element={<TimetableGrid />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route
          path="/approvals"
          element={user.role === 'admin' ? <RescheduleDiffPage /> : <NotFoundPage />}
        />
        <Route
          path="/exams"
          element={user.role !== 'club' ? <ExamsPage /> : <NotFoundPage />}
        />
        <Route
          path="/assistant"
          element={user.role !== 'club' ? <AssistantPage /> : <NotFoundPage />}
        />
        <Route
          path="/admin"
          element={user.role === 'admin' ? <AdminPage /> : <NotFoundPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
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
