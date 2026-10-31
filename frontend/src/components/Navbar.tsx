import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { 
  Calendar, Clock, ShieldCheck, MessageSquare, 
  BarChart3, RefreshCw, LogOut, Menu, X, PlusCircle, Award
} from 'lucide-react';
import { api } from '../services/api';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  let navLinks = [
    { name: 'Dashboard', path: '/', icon: BarChart3 },
    { name: 'Timetable', path: '/timetable', icon: Calendar },
    { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
    { name: 'Approvals & Diff', path: '/approvals', icon: ShieldCheck },
    { name: 'Exams Calendar', path: '/exams', icon: Clock },
    { name: 'Assistant', path: '/assistant', icon: MessageSquare },
  ];

  if (user?.role === 'club') {
    navLinks = navLinks.filter((l) => l.path !== '/approvals');
  }

  if (user?.role === 'admin') {
    navLinks.push({ name: 'Admin Console', path: '/admin', icon: Award });
  }

  const handleResetDemo = async () => {
    if (!window.confirm('Reset demo state to clean starter baseline?')) return;
    setIsResetting(true);
    try {
      await api.post('/admin/reset-demo');
      window.location.reload();
    } catch (err) {
      alert('Reset failed: ' + err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                CIT Scheduler
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                  Zero Clashes
                </span>
              </span>
              <p className="text-xs text-slate-400">Campus Scheduling & Venue Management</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Demo Controls */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white">{user.name}</div>
                  <div className="text-[11px] text-sky-400 font-mono capitalize">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}

            {user?.role === 'admin' && (
              <button
                onClick={handleResetDemo}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:border-slate-600 disabled:opacity-50"
                title="Reset Database to Clean Baseline State"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-sky-400' : ''}`} />
                Reset Demo
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive ? 'bg-sky-500/20 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.name}
              </Link>
            );
          })}
          {user && (
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-xs text-sky-400 capitalize">{user.role}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-semibold"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

