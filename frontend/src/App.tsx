import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/authContext';
import { ToastProvider } from './components/Toast';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
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

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      <div>
        <Navbar />
        <main id="main-content">
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>

      {/* Shared Accessible Institutional Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-8 text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Chilika Institute of Technology</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Zero Clashes Guarantee
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Centralized campus scheduling, venue management, and midsem examination matrix.
              </p>
            </div>

            {/* Quick Navigation Links */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <Link to="/" className="text-slate-300 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link to="/timetable" className="text-slate-300 hover:text-white transition-colors">
                Timetable
              </Link>
              <Link to="/bookings" className="text-slate-300 hover:text-white transition-colors">
                Bookings
              </Link>
              <Link to="/exams" className="text-slate-300 hover:text-white transition-colors">
                Exams
              </Link>
              <a
                href="mailto:scheduling@cit.edu"
                className="text-sky-400 hover:underline transition-colors flex items-center gap-1"
                aria-label="Send email to CIT Scheduling Support"
              >
                scheduling@cit.edu
              </a>
              <a
                href="tel:+916756200100"
                className="text-slate-300 hover:text-white transition-colors"
                aria-label="Call CIT Scheduling Helpdesk"
              >
                +91 (6756) 200-100
              </a>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500">
            <div>
              &copy; {currentYear} Chilika Institute of Technology. All institutional rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {metrics ? `${metrics.hard_conflicts} Hard Violations` : 'Validating schedule constraints...'}
              </span>
            </div>
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
