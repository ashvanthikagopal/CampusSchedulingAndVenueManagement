import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar, Clock, ShieldCheck, MessageSquare,
  BarChart3, LogOut, Menu, X, PlusCircle, Award,
  FileText, RotateCcw, ChevronLeft, ChevronRight,
  MoreVertical, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { NotificationsPopover } from './NotificationsPopover';
import { ResetDatasetModal } from './ResetDatasetModal';
import { StatusBadge } from './ui/StatusBadge';

export interface AppShellProps {
  children: React.ReactNode;
  metrics?: {
    hard_conflicts: number;
    booking_score: number;
    max_booking_score: number;
    soft_penalty_total: number;
  };
}

export const AppShell: React.FC<AppShellProps> = ({ children, metrics }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);

  // Apply ledger body class on mount, cleanup on unmount
  useEffect(() => {
    document.body.classList.add('ledger-body');
    return () => {
      document.body.classList.remove('ledger-body');
    };
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setOverflowMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setOverflowMenuOpen(false);
  }, [location.pathname]);

  // Role-aware navigation links strictly complying with Section 4 (ROLES AND PRIORITY)
  let navLinks: Array<{ name: string; path: string; icon: any; badge?: string }> = [];

  if (user?.role === 'admin') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Master Timetable', path: '/timetable', icon: Calendar },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
      { name: 'Disruption Approvals', path: '/approvals', icon: ShieldCheck },
      { name: 'Exams Matrix', path: '/exams', icon: Clock },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Admin Console', path: '/admin', icon: Award },
    ];
  } else if (user?.role === 'department_coordinator') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: `${user.department || 'Dept'} Timetable`, path: '/timetable', icon: Calendar },
      { name: 'Lab Approvals & Bookings', path: '/bookings', icon: PlusCircle },
      { name: 'Session Requests', path: '/my-requests', icon: FileText },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    ];
  } else if (user?.role === 'faculty') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'My Schedule', path: '/my-schedule', icon: Calendar },
      { name: 'My Requests', path: '/my-requests', icon: FileText },
      { name: 'Faculty Timetable', path: '/timetable', icon: Calendar },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
    ];
  } else if (user?.role === 'club') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Venue Availability', path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
    ];
  } else {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Book Venue', path: '/bookings', icon: PlusCircle },
    ];
  }

  // Current page title mapping
  const currentLink = navLinks.find(l => l.path === location.pathname);
  const pageTitle = currentLink ? currentLink.name : 'Institutional Schedule';

  const currentYear = new Date().getFullYear();
  const hardViolations = metrics ? metrics.hard_conflicts : 0;

  return (
    <div className="ledger-app min-h-screen bg-[#FAF6EC] text-[#1F2A24] flex flex-row overflow-x-hidden">
      {/* Mobile Backdrop Scrim */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Evergreen Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#12372A] text-[#E8EFE6] border-r border-[#0C261C] flex flex-col transition-all duration-200 select-none ${
          /* Desktop Width */
          collapsed ? 'lg:w-18' : 'lg:w-60'
        } ${
          /* Mobile Drawer Position */
          mobileDrawerOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand / Mark Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1B4A39]/80 shrink-0">
          <Link to="/" className="flex items-center gap-3 group min-w-0">
            <div className="w-8 h-8 rounded-[8px] bg-[#1B4A39] border border-[#B08A3E]/40 text-[#B08A3E] font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-xs group-hover:border-[#B08A3E] transition-colors">
              CIT
            </div>
            {!collapsed && (
              <div className="min-w-0 flex flex-col justify-center leading-tight">
                <span className="font-serif font-bold text-sm text-[#E8EFE6] tracking-tight truncate">
                  CIT Scheduler
                </span>
                <span className="text-[10px] text-[#9DB5A6] font-mono tracking-wider uppercase">
                  Campus Ledger
                </span>
              </div>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-[#9DB5A6] hover:text-white p-1 rounded cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;

            return (
              <Link
                key={link.path}
                to={link.path}
                title={collapsed ? link.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-medium transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-[#225A46] text-[#FFFDF8] border-l-[3px] border-l-[#B08A3E] font-semibold shadow-xs'
                    : 'text-[#E8EFE6]/85 hover:text-white hover:bg-[#1B4A39]'
                } ${collapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#B08A3E]' : 'text-[#9DB5A6] group-hover:text-white'
                  }`}
                  aria-hidden="true"
                />
                {!collapsed && (
                  <span className="truncate flex-1">{link.name}</span>
                )}
                {!collapsed && link.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0C261C] text-[#B08A3E] border border-[#B08A3E]/30 shrink-0">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Collapse Toggle (Desktop only) */}
        <div className="hidden lg:flex items-center justify-end px-3 py-2 border-t border-[#1B4A39]/60 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#9DB5A6] hover:text-white p-1 rounded hover:bg-[#1B4A39] transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Profile Card at Bottom */}
        {user && (
          <div className="p-3 border-t border-[#1B4A39] bg-[#0C261C]/50 shrink-0">
            <div className={`flex items-center justify-between gap-2 ${collapsed ? 'flex-col' : ''}`}>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate" title={user.name}>
                    {user.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#9DB5A6] mt-0.5 truncate">
                    <span className="capitalize">{user.role.replace('_', ' ')}</span>
                    {(user.faculty_id || user.department || user.club_name) && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[#B08A3E]">
                          {user.faculty_id || user.department || user.club_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-[#1B4A39] border border-[#B08A3E]/40 text-[#B08A3E] text-xs font-bold flex items-center justify-center shrink-0 cursor-default"
                  title={`${user.name} (${user.role})`}
                >
                  {user.name.charAt(0)}
                </div>
              )}

              <button
                type="button"
                onClick={logout}
                className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#9DB5A6] hover:text-[#B3402F] hover:bg-[#1B4A39] transition-colors shrink-0 cursor-pointer"
                title="Sign out of platform"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          collapsed ? 'lg:pl-18' : 'lg:pl-60'
        }`}
      >
        {/* Slim Ivory Top Bar */}
        <header className="sticky top-0 z-30 bg-[#FFFDF8] border-b border-[#E4DBC6] h-14 px-4 sm:px-6 flex items-center justify-between gap-3 shadow-xs shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden text-[#55625A] hover:text-[#1F2A24] p-1.5 rounded-[8px] hover:bg-[#F2ECDC] transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Current View Title */}
            <div className="flex items-center gap-2 min-w-0 text-xs font-mono text-[#7C877F]">
              <span className="hidden sm:inline">CIT</span>
              <span className="hidden sm:inline">/</span>
              <span className="text-[#1F2A24] font-semibold font-sans text-sm truncate">
                {pageTitle}
              </span>
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Zero Clashes Status Strip */}
            <div className="hidden md:flex items-center">
              {hardViolations === 0 ? (
                <StatusBadge
                  status="success"
                  size="sm"
                  label="0 Clashes Guaranteed"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                />
              ) : (
                <StatusBadge
                  status="danger"
                  size="sm"
                  label={`${hardViolations} Clashes Detected`}
                  icon={<AlertCircle className="w-3.5 h-3.5" />}
                />
              )}
            </div>

            {/* Notifications Popover */}
            <NotificationsPopover />

            {/* Institutional Overflow Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
                aria-expanded={overflowMenuOpen}
                aria-haspopup="true"
                className="w-9 h-9 flex items-center justify-center rounded-[8px] bg-[#FFFDF8] hover:bg-[#F2ECDC] text-[#55625A] hover:text-[#1F2A24] border border-[#E4DBC6] transition-colors cursor-pointer"
                title="System settings & actions"
                aria-label="System actions menu"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {overflowMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_4px_16px_rgba(31,42,36,0.12)] p-1.5 z-50 text-xs">
                  <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#7C877F]">
                    Campus Controls
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      setResetModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-[6px] hover:bg-[#FBEFEF] text-[#B3402F] flex items-center gap-2 transition-colors cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Demo Dataset...</span>
                  </button>
                  <div className="border-t border-[#E4DBC6] my-1" />
                  <a
                    href="mailto:scheduling@cit.edu"
                    className="w-full text-left px-2.5 py-2 rounded-[6px] hover:bg-[#F2ECDC] text-[#55625A] flex items-center gap-2 transition-colors"
                  >
                    <span>Support & Helpdesk</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Surface */}
        <main id="main-content" className="flex-1 bg-[#FAF6EC] p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Quiet Status Strip Footer */}
        <footer className="border-t border-[#E4DBC6] bg-[#FAF6EC] py-4 px-4 sm:px-6 lg:px-8 text-xs text-[#55625A] shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span>&copy; {currentYear} Chilika Institute of Technology</span>
              <span className="hidden md:inline text-[#7C877F]">•</span>
              <span className="hidden md:inline text-[#7C877F]">Campus Scheduling & Venue Matrix</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-[#2F7D4F] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D4F]" />
                {metrics ? `${metrics.hard_conflicts} Hard Clashes` : '0 Clashes'}
              </span>
              <span className="text-[#7C877F]">|</span>
              <a
                href="mailto:scheduling@cit.edu"
                className="text-[#55625A] hover:text-[#B08A3E] transition-colors"
              >
                scheduling@cit.edu
              </a>
              <span className="text-[#7C877F]">|</span>
              <a
                href="tel:+916756200100"
                className="text-[#55625A] hover:text-[#B08A3E] transition-colors"
              >
                +91 (6756) 200-100
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Dataset Reset Confirmation Dialog */}
      <ResetDatasetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
    </div>
  );
};

