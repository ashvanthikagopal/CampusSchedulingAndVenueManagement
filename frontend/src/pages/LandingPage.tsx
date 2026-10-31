import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import type { User, DirectoryData } from '../lib/authContext';
import { api } from '../services/api';
import { 
  ShieldCheck, Sparkles, ArrowRight, Cpu, Eye, EyeOff, 
  Search, ChevronLeft, Building2, Users2, UserCheck, CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface PublicStats {
  sessions_scheduled: number;
  hard_violations: number;
  booking_score: number;
  bookings_count: number;
  last_reschedule_moved_count: number;
}

type RoleType = 'admin' | 'department_coordinator' | 'faculty' | 'club';

const ROLE_PASSWORDS: Record<RoleType, string> = {
  admin: 'Admin@123',
  department_coordinator: 'Coord@123',
  faculty: 'Faculty@123',
  club: 'Club@123',
};

const ROLE_TILES = [
  {
    role: 'admin' as RoleType,
    title: 'Campus Administrator',
    summary: 'Master timetable generation, conflict resolution, and global venue governance.',
    icon: ShieldCheck,
    badge: 'Full Access',
    color: 'emerald'
  },
  {
    role: 'department_coordinator' as RoleType,
    title: 'Department Coordinator',
    summary: 'Department schedule oversight and specialized departmental lab booking approvals.',
    icon: Building2,
    badge: 'Dept Scoped',
    color: 'teal'
  },
  {
    role: 'faculty' as RoleType,
    title: 'Faculty Member',
    summary: 'Personal teaching timetable, room requests for guest lectures, and leave declaration.',
    icon: UserCheck,
    badge: '40 Members',
    color: 'violet'
  },
  {
    role: 'club' as RoleType,
    title: 'Club Representative',
    summary: 'Spectra Week venue bookings, alternative slots negotiation, and event tracking.',
    icon: Users2,
    badge: '11 Clubs',
    color: 'rose'
  }
];

export const LandingPage: React.FC = () => {
  const { login, loadDirectory } = useAuth();
  const navigate = useNavigate();

  // Public Stats State
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<boolean>(false);

  // Directory & Selection State
  const [directory, setDirectory] = useState<DirectoryData | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(true);
  const [demoModeActive, setDemoModeActive] = useState<boolean>(true);

  // Sign-in Card State
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [selectedAccountName, setSelectedAccountName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter / Search within Step 2
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>('ALL');
  const [facultySearch, setFacultySearch] = useState<string>('');
  const [clubSearch, setClubSearch] = useState<string>('');
  const [activeSlide, setActiveSlide] = useState(0);

  // Fetch Public Stats
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await api.get('/public/stats');
        if (isMounted) {
          setStats(res.data);
          setStatsLoading(false);
        }
      } catch {
        if (isMounted) {
          setStatsError(true);
          setStatsLoading(false);
        }
      }
    };
    fetchStats();
    return () => { isMounted = false; };
  }, []);

  // Fetch Demo Directory
  useEffect(() => {
    let isMounted = true;
    const fetchDir = async () => {
      try {
        const data = await loadDirectory();
        if (isMounted) {
          if (data) {
            setDirectory(data);
            setDemoModeActive(true);
          } else {
            setDemoModeActive(false);
          }
          setDirectoryLoading(false);
        }
      } catch {
        if (isMounted) {
          setDemoModeActive(false);
          setDirectoryLoading(false);
        }
      }
    };
    fetchDir();
    return () => { isMounted = false; };
  }, [loadDirectory]);

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setError(null);
    setSelectedAccountName('');
    setPassword(ROLE_PASSWORDS[role]);
    setStep(2);
  };

  const handleAccountSelect = (name: string, ident: string) => {
    if (!selectedRole) return;
    setIdentifier(ident);
    setSelectedAccountName(name);
    setPassword(ROLE_PASSWORDS[selectedRole]);
  };

  const redirectByRole = (user: User) => {
    if (user.role === 'admin') {
      navigate('/');
    } else if (user.role === 'department_coordinator' || user.role === 'faculty') {
      navigate('/timetable');
    } else if (user.role === 'club') {
      navigate('/bookings');
    } else {
      navigate('/');
    }
  };

  const executeLogin = async (identToUse: string, pwdToUse: string) => {
    if (!identToUse.trim()) {
      setError('Please provide your email or faculty ID.');
      return;
    }
    if (!pwdToUse) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const loggedInUser = await login(identToUse.trim(), pwdToUse);
      redirectByRole(loggedInUser);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials or unable to reach authentication server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(identifier, password);
  };

  // Filtered Faculty List
  const facultyList = useMemo(() => {
    if (!directory) return [];
    let list = directory.faculty;
    if (facultyDeptFilter !== 'ALL') {
      list = list.filter(f => f.department === facultyDeptFilter);
    }
    if (facultySearch.trim()) {
      const q = facultySearch.toLowerCase();
      list = list.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.faculty_id.toLowerCase().includes(q) ||
        (f.department && f.department.toLowerCase().includes(q))
      );
    }
    return list;
  }, [directory, facultyDeptFilter, facultySearch]);

  // Filtered Clubs List
  const clubList = useMemo(() => {
    if (!directory) return [];
    let list = directory.clubs;
    if (clubSearch.trim()) {
      const q = clubSearch.toLowerCase();
      list = list.filter(c => c.club_name.toLowerCase().includes(q));
    }
    return list;
  }, [directory, clubSearch]);

  // Dynamic Carousel Slides using /public/stats
  const carouselSlides = [
    {
      title: "1. Generate Optimal Timetable",
      desc: stats
        ? `Pure CP-SAT integer optimization schedules ${stats.sessions_scheduled} sessions across 27 venues with ${stats.hard_violations} hard violations in under 45 seconds.`
        : "Pure CP-SAT integer optimization schedules sessions across campus with zero hard violations.",
      icon: Cpu,
      stat: stats
        ? `${stats.sessions_scheduled} Sessions · ${stats.hard_violations} Clashes`
        : statsLoading ? 'Loading...' : '-'
    },
    {
      title: "2. Book in English & Hinglish",
      desc: "Plain language venue requests ('seminar hall kal shaam 6 baje, 100 log') parsed and validated by deterministic rule checks.",
      icon: Sparkles,
      stat: stats
        ? `${stats.bookings_count} Bookings · ${stats.booking_score.toFixed(1)}/70 Score`
        : statsLoading ? 'Loading...' : '-'
    },
    {
      title: "3. Reschedule Safely with Minimal Change",
      desc: "Disruptions (faculty leave, room repair) are solved with minimal moves and verified by the official validator before human Admin approval.",
      icon: ShieldCheck,
      stat: stats
        ? `${stats.last_reschedule_moved_count} Moved · ${stats.hard_violations} Violations`
        : statsLoading ? 'Loading...' : '-'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-white selection:text-zinc-950 font-sans">
      {/* Background radial gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 flex-grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Hero & Real Validator Metrics */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Chilika Institute of Technology
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Own The Week.
                <span className="block bg-gradient-to-r from-white via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  Zero Clashes, Zero Calls.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
                Autonomous mathematical campus scheduling, Spectra Week venue optimization, and minimal-change disruption repair powered by Google OR-Tools CP-SAT.
              </p>
            </div>

            {/* Dynamic Hero Live Stats (Fetched from /public/stats) */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-1 max-w-lg">
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 bg-zinc-900/60">
                <div className="text-xl sm:text-2xl font-bold text-white font-mono min-h-[32px] flex items-center">
                  {statsLoading ? (
                    <div className="h-6 w-12 bg-zinc-800 animate-pulse rounded" />
                  ) : statsError ? (
                    '-'
                  ) : (
                    stats?.sessions_scheduled
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Sessions Placed</div>
              </div>

              <div className="glass-panel p-3.5 rounded-xl border border-white/10 bg-zinc-900/60">
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono min-h-[32px] flex items-center">
                  {statsLoading ? (
                    <div className="h-6 w-8 bg-zinc-800 animate-pulse rounded" />
                  ) : statsError ? (
                    '-'
                  ) : (
                    stats?.hard_violations
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Hard Violations</div>
              </div>

              <div className="glass-panel p-3.5 rounded-xl border border-white/10 bg-zinc-900/60">
                <div className="text-xl sm:text-2xl font-bold text-teal-300 font-mono min-h-[32px] flex items-center">
                  {statsLoading ? (
                    <div className="h-6 w-12 bg-zinc-800 animate-pulse rounded" />
                  ) : statsError ? (
                    '-'
                  ) : (
                    stats?.booking_score.toFixed(1)
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Fest Booking Score</div>
              </div>
            </div>

            {/* Capability Carousel */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Core Capabilities</span>
                <div className="flex gap-1.5">
                  {carouselSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      aria-label={`Slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        activeSlide === idx ? 'bg-white w-6' : 'bg-zinc-700 w-2'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4 pt-1">
                {React.createElement(carouselSlides[activeSlide].icon, {
                  className: "w-7 h-7 sm:w-8 sm:h-8 text-emerald-400 flex-shrink-0 mt-0.5"
                })}
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-white">
                    {carouselSlides[activeSlide].title}
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 leading-relaxed">
                    {carouselSlides[activeSlide].desc}
                  </p>
                  <span className="inline-block mt-2 text-xs font-mono font-medium text-white px-2.5 py-0.5 rounded-md bg-white/10 border border-white/20">
                    {carouselSlides[activeSlide].stat}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 2-Step Sign-In Card */}
          <div className="lg:col-span-6 w-full max-w-xl mx-auto">
            <div className="glass-panel p-5 sm:p-7 rounded-2xl border border-white/15 bg-zinc-900/95 shadow-2xl relative">
              
              {/* Card Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  {step === 2 && (
                    <button
                      onClick={() => {
                        setStep(1);
                        setError(null);
                        setSelectedAccountName('');
                      }}
                      className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Back to role selection"
                      aria-label="Back to role selection"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-none">
                      {step === 1 ? 'Sign In to CIT Portal' : `Select ${ROLE_TILES.find(r => r.role === selectedRole)?.title || 'Account'}`}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {step === 1 
                        ? 'Select your role or enter credentials below' 
                        : 'Choose an account to pre-fill or sign in with one click'}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10 shrink-0">
                  Step {step} of 2
                </div>
              </div>

              {/* Inline Error Notice */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: Four Role Tiles */}
              {step === 1 && (
                <div 
                  role="radiogroup" 
                  aria-label="Select Campus Role" 
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5"
                >
                  {ROLE_TILES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.role}
                        role="radio"
                        aria-checked={selectedRole === t.role}
                        onClick={() => handleRoleSelect(t.role)}
                        className="flex flex-col text-left p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all group focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-mono font-medium text-zinc-400 px-2 py-0.5 rounded bg-zinc-800/80">
                            {t.badge}
                          </span>
                        </div>
                        <div className="font-semibold text-xs sm:text-sm text-white group-hover:text-emerald-300 transition-colors">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {t.summary}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* STEP 2: Role Detail / Account Selection */}
              {step === 2 && selectedRole && (
                <div className="space-y-4 mb-5">
                  {directoryLoading ? (
                    <div className="space-y-2 py-4">
                      <div className="h-9 bg-zinc-800/80 animate-pulse rounded-xl" />
                      <div className="h-9 bg-zinc-800/80 animate-pulse rounded-xl" />
                      <div className="h-9 bg-zinc-800/80 animate-pulse rounded-xl" />
                    </div>
                  ) : (
                    <>
                      {/* 1. Admin Role (2 Cards) */}
                      {selectedRole === 'admin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {directory?.admins.map((adm) => {
                            const isSelected = identifier.toLowerCase() === adm.email.toLowerCase();
                            return (
                              <button
                                key={adm.email}
                                onClick={() => handleAccountSelect(adm.name, adm.email)}
                                className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                                  isSelected 
                                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white' 
                                    : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-bold text-white">{adm.name}</div>
                                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{adm.email}</div>
                                </div>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. Coordinator Role (Department Chips) */}
                      {selectedRole === 'department_coordinator' && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Choose Department
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {directory?.coordinators.map((coord) => {
                              const isSelected = identifier.toLowerCase() === coord.email.toLowerCase();
                              return (
                                <button
                                  key={coord.email}
                                  onClick={() => handleAccountSelect(coord.name, coord.email)}
                                  className={`p-2.5 rounded-xl border text-left transition-all ${
                                    isSelected 
                                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm' 
                                      : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
                                  }`}
                                >
                                  <div className="text-xs font-bold text-white flex items-center justify-between">
                                    <span>{coord.department || coord.name}</span>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                                    {coord.email}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 3. Faculty Role (Dept Chips + Searchable 40 Faculty List) */}
                      {selectedRole === 'faculty' && (
                        <div className="space-y-3">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={facultySearch}
                              onChange={(e) => setFacultySearch(e.target.value)}
                              placeholder="Search 40 faculty by name or F-ID (e.g. F06)..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                            />
                          </div>

                          {/* Department Filter Chips */}
                          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                            {['ALL', 'CSE', 'ECE', 'EE', 'ME', 'CE', 'PH', 'MA', 'HSS'].map((dept) => (
                              <button
                                key={dept}
                                onClick={() => setFacultyDeptFilter(dept)}
                                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                                  facultyDeptFilter === dept 
                                    ? 'bg-white text-zinc-950 font-bold' 
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                              >
                                {dept}
                              </button>
                            ))}
                          </div>

                          {/* Searchable Scrollable Faculty List */}
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {facultyList.length === 0 ? (
                              <div className="text-center py-6 text-xs text-zinc-500">
                                No faculty members found matching "{facultySearch}".
                              </div>
                            ) : (
                              facultyList.map((fac) => {
                                const isSelected = identifier.toUpperCase() === fac.faculty_id.toUpperCase() || identifier.toLowerCase() === fac.email.toLowerCase();
                                return (
                                  <button
                                    key={fac.email}
                                    onClick={() => handleAccountSelect(`${fac.name} (${fac.faculty_id})`, fac.faculty_id)}
                                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                      isSelected 
                                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white' 
                                        : 'bg-zinc-950/70 border-zinc-800 hover:bg-zinc-800/80 text-zinc-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 font-bold">
                                        {fac.faculty_id}
                                      </span>
                                      <div>
                                        <div className="text-xs font-semibold text-white leading-tight">{fac.name}</div>
                                        <div className="text-[10px] text-zinc-400">{fac.department} Department · {fac.email}</div>
                                      </div>
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* 4. Club Role (Searchable 11 Clubs Grid) */}
                      {selectedRole === 'club' && (
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={clubSearch}
                              onChange={(e) => setClubSearch(e.target.value)}
                              placeholder="Search 11 student clubs (e.g. Dance, E-Cell)..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-400 transition-colors"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                            {clubList.length === 0 ? (
                              <div className="col-span-2 text-center py-6 text-xs text-zinc-500">
                                No clubs found matching "{clubSearch}".
                              </div>
                            ) : (
                              clubList.map((cl) => {
                                const isSelected = identifier.toLowerCase() === cl.email.toLowerCase();
                                return (
                                  <button
                                    key={cl.email}
                                    onClick={() => handleAccountSelect(cl.club_name, cl.email)}
                                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                      isSelected 
                                        ? 'bg-rose-500/15 border-rose-500/50 text-white' 
                                        : 'bg-zinc-950/70 border-zinc-800 hover:bg-zinc-800/80 text-zinc-300'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-white">{cl.club_name}</div>
                                      <div className="text-[10px] text-zinc-400 font-mono truncate">{cl.email}</div>
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selected Account 1-Click Action & Password Hint */}
                      {selectedAccountName && (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">Selected Account:</span>
                            <span className="font-bold text-white">{selectedAccountName}</span>
                          </div>
                          {demoModeActive && (
                            <div className="text-[11px] text-emerald-400 font-mono">
                              Demo password for {selectedRole}: {ROLE_PASSWORDS[selectedRole]}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => executeLogin(identifier, password || ROLE_PASSWORDS[selectedRole])}
                            className="w-full py-2 px-3 rounded-lg font-bold text-xs bg-white text-zinc-950 hover:bg-zinc-100 transition-all shadow-md flex items-center justify-center gap-1.5"
                          >
                            <span>Sign in as {selectedAccountName}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  {step === 1 ? 'Or enter credentials manually' : 'Custom credentials'}
                </span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              {/* Manual Form (Email or Faculty ID + Password + Show/Hide) */}
              <form onSubmit={handleManualSubmit} className="space-y-3 mt-1">
                <div>
                  <label htmlFor="identifier-input" className="block text-xs font-medium text-zinc-300 mb-1">
                    Email or Faculty ID
                  </label>
                  <input
                    id="identifier-input"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin@cit.edu or F06"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="password-input" className="block text-xs font-medium text-zinc-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-zinc-950 bg-white hover:bg-zinc-100 shadow-xl shadow-white/10 transition-all hover:scale-[1.01] active:scale-[0.99] focus:outline-none disabled:opacity-50"
                >
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-5 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>Chilika Institute of Technology · Campus Scheduling Platform</div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-mono">Rule-Based RBAC</span>
            <span>·</span>
            <span className="text-zinc-400 font-mono">CP-SAT Optimized</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
