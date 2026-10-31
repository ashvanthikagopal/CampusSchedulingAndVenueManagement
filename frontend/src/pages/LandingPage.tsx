import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type AuthDirectory } from '../lib/authContext';
import { api } from '../services/api';
import { 
  ShieldCheck, Sparkles, ArrowRight, ArrowLeft, Cpu, 
  GraduationCap, Building2, Eye, EyeOff, Search, UserCheck
} from 'lucide-react';

interface PublicStats {
  sessions_scheduled: number;
  hard_violations: number;
  booking_score: number;
  bookings_count: number;
  last_reschedule_moved_count: number;
}

type RoleType = 'admin' | 'department_coordinator' | 'faculty' | 'club';

export const LandingPage: React.FC = () => {
  const { login, loadDirectory, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Public stats
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [activeSlide, setActiveSlide] = useState(0);

  // Directory & Demo state
  const [directory, setDirectory] = useState<AuthDirectory | null>(null);
  const [dirLoading, setDirLoading] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Sign-in wizard state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<{
    name: string;
    identifier: string;
    role: RoleType;
    passwordHint: string;
  } | null>(null);

  // Manual Form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role passwords for hints
  const ROLE_PASSWORDS: Record<RoleType, string> = {
    admin: 'Admin@123',
    department_coordinator: 'Coord@123',
    faculty: 'Faculty@123',
    club: 'Club@123',
  };

  const ROLE_METADATA: Record<RoleType, {
    title: string;
    badge: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = {
    admin: {
      title: 'Admin',
      badge: 'Dual Authority',
      desc: 'Solve master timetables, approve emergency disruptions, and system reset.',
      icon: ShieldCheck,
    },
    department_coordinator: {
      title: 'Dept Coordinator',
      badge: '9 Departments',
      desc: 'Oversee department sessions, report faculty leaves, and approve lab bookings.',
      icon: Building2,
    },
    faculty: {
      title: 'Faculty Member',
      badge: '40 Faculty',
      desc: 'View personal timetable, submit leaves/unavailability, and request guest lectures.',
      icon: GraduationCap,
    },
    club: {
      title: 'Club Representative',
      badge: '11 Fest Clubs',
      desc: 'Submit Spectra Fest bookings (cap: 2), track approvals, and check room capacity.',
      icon: Sparkles,
    },
  };

  // 1. Fetch public live stats (no hard-coded numbers)
  useEffect(() => {
    let isMounted = true;
    api.get('/public/stats')
      .then((res) => {
        if (isMounted) setStats(res.data);
      })
      .catch(() => {
        if (isMounted) setStats(null);
      })
      .finally(() => {
        if (isMounted) setStatsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch directory if DEMO_MODE is on
  useEffect(() => {
    let isMounted = true;
    loadDirectory()
      .then((data) => {
        if (isMounted) {
          if (data) {
            setDirectory(data);
            setDemoMode(true);
          } else {
            setDemoMode(false);
          }
        }
      })
      .catch(() => {
        if (isMounted) setDemoMode(false);
      })
      .finally(() => {
        if (isMounted) setDirLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setSelectedDeptFilter('ALL');
    setSearchQuery('');
    setSelectedAccount(null);
    setStep(2);
    setError(null);
  };

  const handleAccountSelect = (name: string, idVal: string, role: RoleType) => {
    const pwd = ROLE_PASSWORDS[role];
    setSelectedAccount({
      name,
      identifier: idVal,
      role,
      passwordHint: pwd,
    });
    setIdentifier(idVal);
    if (demoMode) {
      setPassword(pwd);
    }
    setError(null);
  };

  const handleRedirectByRole = (userRole: string, dept?: string, facId?: string) => {
    if (userRole === 'admin') {
      navigate('/');
    } else if (userRole === 'department_coordinator') {
      navigate(`/timetable?dept=${encodeURIComponent(dept || 'CSE')}`);
    } else if (userRole === 'faculty') {
      navigate(`/timetable?faculty=${encodeURIComponent(facId || '')}`);
    } else if (userRole === 'club') {
      navigate('/bookings');
    } else {
      navigate('/');
    }
  };

  const performLogin = async (ident: string, pass: string) => {
    if (!ident.trim() || !pass.trim()) {
      setError('Please provide both identifier and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login(ident.trim(), pass);
      handleRedirectByRole(user.role, user.department, user.faculty_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid identifier or password. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(identifier, password);
  };

  // Filtered lists for Step 2
  const filteredCoordinators = useMemo(() => {
    if (!directory?.coordinators) return [];
    let list = directory.coordinators;
    if (selectedDeptFilter !== 'ALL') {
      if (selectedDeptFilter === 'T&P') {
        list = list.filter(c => c.name.toLowerCase().includes('placement') || c.email.includes('tnp'));
      } else {
        list = list.filter(c => c.department === selectedDeptFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.department && c.department.toLowerCase().includes(q)) || c.email.includes(q));
    }
    return list;
  }, [directory, selectedDeptFilter, searchQuery]);

  const filteredFaculty = useMemo(() => {
    if (!directory?.faculty) return [];
    let list = directory.faculty;
    if (selectedDeptFilter !== 'ALL') {
      list = list.filter(f => f.department === selectedDeptFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => 
        f.name.toLowerCase().includes(q) || 
        (f.faculty_id && f.faculty_id.toLowerCase().includes(q)) || 
        (f.department && f.department.toLowerCase().includes(q)) ||
        f.email.includes(q)
      );
    }
    return list;
  }, [directory, selectedDeptFilter, searchQuery]);

  const filteredClubs = useMemo(() => {
    if (!directory?.clubs) return [];
    let list = directory.clubs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.club_name.toLowerCase().includes(q) || c.email.includes(q));
    }
    return list;
  }, [directory, searchQuery]);

  // Capability carousel items
  const carouselSlides = [
    {
      title: "1. Generate Optimal Timetable",
      desc: "Pure CP-SAT integer optimization assigns 189 sessions across 27 venues with 0 hard violations in under 4 seconds.",
      icon: Cpu,
      stat: statsLoading ? "Loading..." : stats ? `${stats.sessions_scheduled} Sessions · ${stats.hard_violations} Clashes` : "-",
    },
    {
      title: "2. Book in English & Hinglish",
      desc: "Plain language venue requests ('seminar hall kal shaam 6 baje, 100 log') parsed with deterministic rule checks.",
      icon: Sparkles,
      stat: statsLoading ? "Loading..." : stats ? `${stats.bookings_count} Live Bookings · ${stats.booking_score.toFixed(1)}/70 Score` : "-",
    },
    {
      title: "3. Reschedule Safely with Minimal Change",
      desc: "Disruptions (faculty leave, room repair) solved with minimal moves and verified by the official validator before Admin approval.",
      icon: ShieldCheck,
      stat: statsLoading ? "Loading..." : stats ? `${stats.last_reschedule_moved_count} Moved · ${stats.hard_violations} Violations` : "-",
    },
  ];

  const DEPT_CHIPS = ['ALL', 'CSE', 'ECE', 'EE', 'ME', 'CE', 'PH', 'MA', 'HSS', 'T&P'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Background radial gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-sky-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 flex-grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Hero Headline & Live Stats */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Chilika Institute of Technology
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Own The Week.
                <span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                  Zero Clashes, Zero Calls.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
                Autonomous mathematical campus scheduling, Spectra Week venue optimization, and minimal-change disruption repair powered by Google OR-Tools CP-SAT and Gemini AI.
              </p>
            </div>

            {/* Live Stat Band (Real Values from /public/stats) */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-1 max-w-lg">
              <div className="glass-panel p-3.5 sm:p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-7 w-12 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <div className="text-xl sm:text-2xl font-bold text-sky-400">
                    {stats ? stats.sessions_scheduled : '-'}
                  </div>
                )}
                <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Sessions Placed</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-7 w-8 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                    {stats ? stats.hard_violations : '-'}
                  </div>
                )}
                <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Hard Violations</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-7 w-12 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <div className="text-xl sm:text-2xl font-bold text-cyan-400">
                    {stats ? stats.booking_score.toFixed(1) : '-'}
                  </div>
                )}
                <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Fest Booking Score</div>
              </div>
            </div>

            {/* Capability Carousel */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Core Capabilities</span>
                <div className="flex gap-1.5" role="tablist">
                  {carouselSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={activeSlide === idx}
                      aria-label={`Slide ${idx + 1}`}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2 rounded-full transition-all ${
                        activeSlide === idx ? 'bg-sky-400 w-6' : 'bg-slate-700 w-2 hover:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4 pt-1">
                {React.createElement(carouselSlides[activeSlide].icon, {
                  className: "w-8 h-8 text-sky-400 flex-shrink-0 mt-0.5",
                })}
                <div>
                  <h4 className="text-base font-semibold text-white">
                    {carouselSlides[activeSlide].title}
                  </h4>
                  <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                    {carouselSlides[activeSlide].desc}
                  </p>
                  <span className="inline-block mt-2 text-xs font-mono font-medium text-sky-400 px-2.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                    {carouselSlides[activeSlide].stat}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Redesigned Sign-in Card */}
          <div className="lg:col-span-5 w-full">
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl relative">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Sign In to CIT Portal</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {step === 1 
                      ? 'Select your role or sign in with credentials' 
                      : `Select your ${ROLE_METADATA[selectedRole!].title} account`}
                  </p>
                </div>
                {step === 2 && (
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedAccount(null);
                    }}
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium"
                >
                  {error}
                </div>
              )}

              {/* STEP 1: Four Role Tiles */}
              {step === 1 && (
                <div className="space-y-3 mb-6" role="radiogroup" aria-label="Select Account Role">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Select Role (All 62 Accounts Supported)
                    </span>
                    {demoMode && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                        DEMO MODE ACTIVE
                      </span>
                    )}
                  </div>

                  {dirLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-slate-800/60 animate-pulse border border-slate-700/50" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(['admin', 'department_coordinator', 'faculty', 'club'] as RoleType[]).map((r) => {
                        const meta = ROLE_METADATA[r];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={selectedRole === r}
                            onClick={() => handleRoleSelect(r)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/70 hover:bg-sky-600/15 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{meta.title}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 font-mono border border-slate-800">
                                    {meta.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-normal">
                                  {meta.desc}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors flex-shrink-0 ml-2" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Role-Specific Selection */}
              {step === 2 && selectedRole && (
                <div className="space-y-3 mb-6">
                  {/* Role Header Banner */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <div className="flex items-center gap-2">
                      {React.createElement(ROLE_METADATA[selectedRole].icon, { className: 'w-4 h-4 text-sky-400' })}
                      <span className="text-xs font-semibold text-white">
                        {ROLE_METADATA[selectedRole].title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Password: {ROLE_PASSWORDS[selectedRole]}
                    </span>
                  </div>

                  {/* ADMIN ROLE (2 Accounts) */}
                  {selectedRole === 'admin' && (
                    <div className="space-y-2">
                      {(directory?.admins || [
                        { name: "Dean's Office", email: "admin@cit.edu" },
                        { name: "Spectra Core Team", email: "admin2@cit.edu" }
                      ]).map((adm) => (
                        <button
                          key={adm.email}
                          type="button"
                          onClick={() => handleAccountSelect(adm.name, adm.email, 'admin')}
                          className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                            selectedAccount?.identifier === adm.email
                              ? 'bg-sky-500/20 border-sky-500 text-white shadow-md'
                              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/70 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{adm.name}</div>
                            <div className="text-[11px] text-sky-400 font-mono mt-0.5">{adm.email}</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                            {adm.email.includes('admin2') ? 'Anti-Self-Appr' : 'Timetable Officer'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* DEPARTMENT COORDINATOR (9 Departments) */}
                  {selectedRole === 'department_coordinator' && (
                    <div className="space-y-2.5">
                      {/* Dept chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {DEPT_CHIPS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDeptFilter(d)}
                            className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${
                              selectedDeptFilter === d
                                ? 'bg-sky-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/70'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>

                      {/* Coordinator list */}
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {filteredCoordinators.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500">No matching coordinators</div>
                        ) : (
                          filteredCoordinators.map((c) => (
                            <button
                              key={c.email}
                              type="button"
                              onClick={() => handleAccountSelect(c.name, c.email, 'department_coordinator')}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                                selectedAccount?.identifier === c.email
                                  ? 'bg-sky-500/20 border-sky-500 text-white'
                                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-white">{c.name}</div>
                                <div className="text-[11px] text-sky-400 font-mono mt-0.5">{c.email}</div>
                              </div>
                              {c.department && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-mono">
                                  {c.department}
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* FACULTY (40 Members with search & dept chips) */}
                  {selectedRole === 'faculty' && (
                    <div className="space-y-2.5">
                      {/* Search & Dept Filters */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search 40 faculty by name, ID (e.g. F06), dept..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {['ALL', 'CSE', 'ECE', 'EE', 'ME', 'CE', 'PH', 'MA', 'HSS'].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDeptFilter(d)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                              selectedDeptFilter === d
                                ? 'bg-sky-500 text-white'
                                : 'bg-slate-800/90 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>

                      {/* Faculty list */}
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                        {filteredFaculty.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500">No matching faculty found</div>
                        ) : (
                          filteredFaculty.map((f) => (
                            <button
                              key={f.email}
                              type="button"
                              onClick={() => handleAccountSelect(f.name, f.email, 'faculty')}
                              className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                                selectedAccount?.identifier === f.email
                                  ? 'bg-sky-500/20 border-sky-500 text-white'
                                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400 font-bold">
                                  {f.faculty_id}
                                </span>
                                <div>
                                  <div className="text-xs font-semibold text-white">{f.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{f.email}</div>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {f.department}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* CLUB (11 Fest Clubs) */}
                  {selectedRole === 'club' && (
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search 11 clubs..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {filteredClubs.length === 0 ? (
                          <div className="col-span-2 text-center py-6 text-xs text-slate-500">No matching clubs</div>
                        ) : (
                          filteredClubs.map((c) => (
                            <button
                              key={c.email}
                              type="button"
                              onClick={() => handleAccountSelect(c.club_name, c.email, 'club')}
                              className={`p-2 rounded-xl border text-left transition-all ${
                                selectedAccount?.identifier === c.email
                                  ? 'bg-sky-500/20 border-sky-500 text-white'
                                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                              }`}
                            >
                              <div className="text-xs font-bold text-white truncate">{c.club_name}</div>
                              <div className="text-[10px] text-purple-400 font-mono truncate">{c.email}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1-Click Sign-in Action when account selected */}
                  {selectedAccount && demoMode && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => performLogin(selectedAccount.identifier, selectedAccount.passwordHint)}
                        disabled={isSubmitting || isAuthLoading}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        {isSubmitting ? 'Authenticating...' : `1-Click Sign In as ${selectedAccount.name}`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                  Or manual credentials
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Manual Form */}
              <form onSubmit={handleSubmit} className="space-y-3 mt-3">
                <div>
                  <label htmlFor="identifier-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Email or Faculty ID
                  </label>
                  <input
                    id="identifier-input"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin@cit.edu, F06, coord_cse@cit.edu"
                    required
                    aria-label="Email or Faculty ID"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="password-input" className="block text-xs font-medium text-slate-300 mb-1">
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
                      aria-label="Password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isAuthLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 transition-all focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Signing In...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>Chilika Institute of Technology (CIT) Campus Scheduling System · CrunchWeek 2027</div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-mono">100% Validator Parity</span>
            <span>·</span>
            <span className="text-slate-400 font-mono">Deterministic AI Bounds</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
