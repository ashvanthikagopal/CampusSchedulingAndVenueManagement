import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar, Clock, ShieldCheck, MessageSquare, BarChart3, LogOut,
  PlusCircle, Award, FileText, RotateCcw, MoreVertical, CheckCircle2, AlertCircle,
  GraduationCap,
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
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.body.classList.add('ledger-body');
    return () => document.body.classList.remove('ledger-body');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && overflowMenuOpen) {
        setOverflowMenuOpen(false);
        actionsButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setOverflowMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [overflowMenuOpen]);

  useEffect(() => {
    setOverflowMenuOpen(false);
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && navRef.current) {
      navRef.current.scrollLeft = active.offsetLeft - navRef.current.offsetLeft - 16;
    }
  }, [location.pathname]);

  // Role-aware navigation links strictly complying with Section 4 (ROLES AND PRIORITY)
  let navLinks: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; badge?: string }> = [];

  if (user?.role === 'admin') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
      { name: 'Approvals', path: '/approvals', icon: ShieldCheck },
      { name: 'Exams', path: '/exams', icon: Clock },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Admin', path: '/admin', icon: Award },
    ];
  } else if (user?.role === 'department_coordinator') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
      { name: 'Session Requests', path: '/my-requests', icon: FileText },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    ];
  } else if (user?.role === 'faculty') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'My Schedule', path: '/my-schedule', icon: Calendar },
      { name: 'My Requests', path: '/my-requests', icon: FileText },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
    ];
  } else if (user?.role === 'club') {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Venue Availability', path: '/timetable', icon: Calendar },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
    ];
  } else {
    navLinks = [
      { name: 'Dashboard', path: '/', icon: BarChart3 },
      { name: 'Timetable', path: '/timetable', icon: Calendar },
      { name: 'Venue Bookings', path: '/bookings', icon: PlusCircle },
    ];
  }

  if (user?.role !== 'club' && !navLinks.some(link => link.path === '/exams')) {
    const assistantIndex = navLinks.findIndex(link => link.path === '/assistant');
    navLinks.splice(assistantIndex < 0 ? navLinks.length : assistantIndex, 0, { name: 'Exams', path: '/exams', icon: Clock });
  }

  const hardViolations = metrics?.hard_conflicts;

  return (
    <div className="ledger-app">
      <a className="campus-skip-link" href="#main-content">Skip to main content</a>
      <header className="campus-header">
        <div className="campus-header-inner">
          <Link to="/" className="campus-brand" aria-label="CIT Scheduler dashboard">
            <span className="campus-brand-mark"><GraduationCap size={24} aria-hidden="true" /></span>
            <span><strong>CIT Scheduler</strong><small>Campus Scheduling & Venue Management</small></span>
          </Link>
          <div className="campus-header-tools">
            {metrics && <div className="campus-health">
              <StatusBadge status={hardViolations === 0 ? 'success' : 'danger'} size="sm"
                label={hardViolations === 0 ? 'No scheduling clashes' : `${hardViolations} clashes detected`}
                icon={hardViolations === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} />
            </div>}
            <NotificationsPopover />
            <div className="relative" ref={actionsRef}>
              <button type="button" ref={actionsButtonRef} className="campus-icon-button"
                onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
                aria-expanded={overflowMenuOpen} aria-controls="campus-actions" aria-label="Campus actions">
                <MoreVertical size={18} />
              </button>
              {overflowMenuOpen && <div id="campus-actions" className="campus-actions">
                <span className="campus-actions-label">Campus controls</span>
                <button type="button" onClick={() => { setOverflowMenuOpen(false); setResetModalOpen(true); }}>
                  <RotateCcw size={15} /> Reset Demo Dataset…
                </button>
                <a href="mailto:scheduling@cit.edu">Support & Helpdesk</a>
              </div>}
            </div>
            {user && <div className="campus-profile">
              <span className="campus-avatar" title={`${user.name} · ${user.role.replaceAll('_', ' ')}`}>{user.name.charAt(0).toUpperCase()}</span>
              <div className="campus-profile-copy">
                <strong title={user.name}>{user.name}</strong>
                <span>{user.role.replaceAll('_', ' ')}{(user.department || user.club_name || user.faculty_id) && ` · ${user.department || user.club_name || user.faculty_id}`}</span>
              </div>
              <button type="button" className="campus-icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
            </div>}
          </div>
        </div>
        <div className="campus-nav-surface">
          <nav className="campus-nav" aria-label="Main navigation" ref={navRef}>
            {navLinks.map(link => {
              const Icon = link.icon;
              return <Link key={link.path} to={link.path} aria-current={location.pathname === link.path ? 'page' : undefined}>
                <Icon className="w-4 h-4" aria-hidden={true} /><span>{link.name}</span>
              </Link>;
            })}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="campus-main">
        {children}
      </main>
      <footer className="campus-footer">
        <span>© {new Date().getFullYear()} Chilika Institute of Technology</span>
        <div><a href="mailto:scheduling@cit.edu">Scheduling helpdesk</a><a href="tel:+916756200100">+91 (6756) 200-100</a></div>
      </footer>
      <ResetDatasetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
    </div>
  );
};
