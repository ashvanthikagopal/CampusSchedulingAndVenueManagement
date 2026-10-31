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

  const navLinks = [
    { name: 'Dashboard', shortName: 'Dashboard', path: '/', icon: BarChart3 },
    { name: 'Timetable', shortName: 'Timetable', path: '/timetable', icon: Calendar },
    { name: 'Book Venue', shortName: 'Bookings', path: '/bookings', icon: PlusCircle },
    { name: 'Approvals & Diff', shortName: 'Approvals', path: '/approvals', icon: ShieldCheck },
    { name: 'Exams Calendar', shortName: 'Exams', path: '/exams', icon: Clock },
    { name: 'Assistant', shortName: 'Assistant', path: '/assistant', icon: MessageSquare },
  ];

  if (user?.role === 'admin') {
    navLinks.push({ name: 'Admin Console', shortName: 'Admin', path: '/admin', icon: Award });
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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/90 border-b border-zinc-800/80">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0 py-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 whitespace-nowrap leading-none">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  CIT Scheduler
                </span>
                <span className="hidden xl:inline-flex text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                  Zero Clashes
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 hidden 2xl:block leading-none mt-1">
                Campus Scheduling & Venue Management
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/10'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                  title={link.name}
                >
                  <Icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
                  <span className="hidden xl:inline whitespace-nowrap">{link.name}</span>
                  <span className="inline xl:hidden whitespace-nowrap">{link.shortName}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Demo Controls */}
          <div className="hidden md:flex items-center gap-2 xl:gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 xl:gap-3 shrink-0">
                <div className="text-right hidden sm:block shrink-0 leading-tight">
                  <div className="text-xs font-semibold text-white whitespace-nowrap">{user.name}</div>
                  <div className="text-[10px] text-emerald-400 font-mono capitalize">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 xl:p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors shrink-0"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all hover:border-zinc-600 disabled:opacity-50 shrink-0 whitespace-nowrap"
                title="Reset Database to Clean Baseline State"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden xl:inline">Reset Demo</span>
              </button>
            )}
          </div>

          {/* Mobile / Tablet Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            {user?.role === 'admin' && (
              <button
                onClick={handleResetDemo}
                disabled={isResetting}
                className="p-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700"
                title="Reset Demo"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-zinc-800 bg-zinc-950/95 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive ? 'bg-white text-zinc-950 font-bold' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.name}
              </Link>
            );
          })}
          {user && (
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-xs text-emerald-400 capitalize">{user.role}</div>
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

