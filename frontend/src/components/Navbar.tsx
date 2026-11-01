import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/authContext';
import {
  Calendar, Clock, ShieldCheck, MessageSquare,
  BarChart3, RefreshCw, LogOut, Menu, X, PlusCircle, Award,
  Bell, Check, CheckCheck, FileText
} from 'lucide-react';
import { api } from '../services/api';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  // Notifications query
  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const unreadCount = notifData?.unread_count || 0;
  const notifications = notifData?.notifications || [];

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/read`);
      refetchNotifs();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      refetchNotifs();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  // Role-aware navigation links
  let navLinks: Array<{ name: string; path: string; icon: any; badge?: string }> = [];

  if (user?.role === 'faculty') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'My Schedule', path: '/my-schedule', icon: Calendar },
      { name: 'My Requests', path: '/my-requests', icon: FileText },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
      { name: 'Approvals & Diff', path: '/approvals', icon: ShieldCheck, badge: 'View' },
    ];
  } else if (user?.role === 'admin') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
      { name: 'Approvals & Diff', path: '/approvals', icon: ShieldCheck },
      { name: 'Exams Calendar', path: '/exams', icon: Clock },
      { name: 'Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Admin Console', path: '/admin', icon: Award },
    ];
  } else if (user?.role === 'club') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    ];
  } else if (user?.role === 'student') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: `Class Timetable (${user.student_group || 'My Class'})`, path: '/timetable', icon: Calendar },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    ];
  } else if (user?.role === 'department_coordinator') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: `${user.department || 'Dept'} Timetable`, path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
      { name: 'Approvals & Diff', path: '/approvals', icon: ShieldCheck },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    ];
  } else {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
      { name: 'Approvals & Diff', path: '/approvals', icon: ShieldCheck },
      { name: 'Exams Calendar', path: '/exams', icon: Clock },
      { name: 'Assistant', path: '/assistant', icon: MessageSquare },
    ];
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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="shrink-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 whitespace-nowrap leading-tight">
                <span className="font-bold text-base text-white tracking-tight">
                  CIT Scheduler
                </span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                  Zero Clashes
                </span>
              </div>
              <p className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5 hidden xl:block">
                Campus Scheduling & Venue Management
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile, Notifications & Demo Controls */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {/* Notification Bell */}
            {user && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="true"
                  aria-label={`Notifications, ${unreadCount} unread`}
                  className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in">
                    <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n: any) => (
                          <div
                            key={n.id}
                            className={`p-3 text-xs transition-colors hover:bg-slate-800/40 flex items-start gap-2.5 ${!n.read ? 'bg-sky-500/5' : ''
                              }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {!n.read ? (
                                <div className="w-2 h-2 rounded-full bg-sky-400 mt-1" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <div className="font-semibold text-slate-200">{n.title}</div>
                              <p className="text-slate-400 leading-relaxed">{n.message}</p>
                              <div className="text-[10px] text-slate-500 pt-0.5">
                                {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </div>
                            {!n.read && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                className="text-[10px] text-slate-400 hover:text-white p-1 cursor-pointer"
                                title="Mark read"
                                aria-label="Mark notification as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right shrink-0 whitespace-nowrap leading-tight">
                  <div className="text-xs font-semibold text-white">{user.name}</div>
                  <div className="flex items-center justify-end gap-1.5 text-[10px] mt-0.5">
                    <span className="text-sky-400 font-mono capitalize">
                      {user.role.replace('_', ' ')}
                    </span>
                    {(user.department || user.club_name || user.faculty_id) && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700/80">
                        {user.faculty_id ? `${user.faculty_id} · ${user.department}` : (user.club_name || user.department)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                  title="Logout"
                  aria-label="Log out of session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}

            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={handleResetDemo}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:border-slate-600 disabled:opacity-50 cursor-pointer"
                title="Reset Database to Clean Baseline State"
                aria-label="Reset demo state to baseline"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-sky-400' : ''}`} />
                Reset Demo
              </button>
            )}
          </div>

          {/* Mobile Menu & Notification Buttons */}
          <div className="lg:hidden flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-expanded={notificationsOpen}
                aria-label={`Notifications, ${unreadCount} unread`}
                className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          role="navigation"
          aria-label="Mobile Navigation"
          className="lg:hidden border-b border-slate-800 bg-slate-950/95 px-4 pt-2 pb-5 space-y-1 animate-in fade-in slide-in-from-top-2"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-sky-500/20 text-sky-400 font-semibold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{link.name}</span>
                {link.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono ml-auto">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {user && (
            <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-xs text-sky-400 capitalize">{user.role.replace('_', ' ')} {user.faculty_id ? `(${user.faculty_id})` : ''}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                aria-label="Log out of session"
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
