import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
