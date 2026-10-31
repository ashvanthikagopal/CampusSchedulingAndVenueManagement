import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type AuthDirectory } from '../lib/authContext';
import { api } from '../services/api';
import {
  ShieldCheck, Sparkles, ArrowRight, Cpu,
  Building2, GraduationCap, Users, Search,
  ArrowLeft, Eye, EyeOff, Check, AlertCircle
} from 'lucide-react';

interface PublicStats {
  sessions_scheduled: number;
  hard_violations: number;
  booking_score: number;
  bookings_count: number;
  last_reschedule_moved_count: number;
  soft_penalty_total?: number;
}

type RoleType = 'admin' | 'coordinator' | 'faculty' | 'club';

const ROLE_PASSWORDS: Record<RoleType, string> = {
  admin: 'Admin@123',
  coordinator: 'Coord@123',
  faculty: 'Faculty@123',
  club: 'Club@123',
};

export const LandingPage: React.FC = () => {
  const { login, loadDirectory, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Public stats state
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<boolean>(false);

  // Directory state
  const [directory, setDirectory] = useState<AuthDirectory | null>(null);
  const [dirLoading, setDirLoading] = useState<boolean>(true);

  // Sign-in card navigation & form state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<{ name: string; identifier: string } | null>(null);

  // Filter & search states for Step 2
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Manual credentials form state
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carousel state
  const [activeSlide, setActiveSlide] = useState(0);

  // 1. Fetch live public stats
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const res = await api.get('/public/stats');
        if (isMounted) {
          setStats(res.data);
          setStatsError(false);
        }
      } catch (err) {
        console.error('Failed to load public stats:', err);
        if (isMounted) setStatsError(true);
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch directory for role-based selector
  useEffect(() => {
    let isMounted = true;
    const fetchDir = async () => {
      setDirLoading(true);
      const data = await loadDirectory();
      if (isMounted) {
        setDirectory(data);
        setDirLoading(false);
      }
    };
    fetchDir();
    return () => { isMounted = false; };
  }, []);

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setSelectedAccount(null);
    setSearchQuery('');
    setDeptFilter('All');
    setError(null);
    setStep(2);
  };

  const handleAccountSelect = (name: string, identifier: string) => {
    setSelectedAccount({ name, identifier });
    setManualIdentifier(identifier);
    if (selectedRole) {
      setManualPassword(ROLE_PASSWORDS[selectedRole]);
    }
    setError(null);
  };

  const handleExecuteLogin = async (ident: string, pass: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const u = await login(ident, pass);
      // Redirect based on role
      if (u.role === 'admin') {
        navigate('/');
      } else if (u.role === 'department_coordinator') {
        navigate('/timetable');
      } else if (u.role === 'faculty') {
        navigate('/timetable');
      } else if (u.role === 'club') {
        navigate('/bookings');
      } else {
        navigate('/timetable');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email/ID or password. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdentifier.trim() || !manualPassword.trim()) {
      setError('Please provide both an identifier and password.');
      return;
    }
    handleExecuteLogin(manualIdentifier.trim(), manualPassword);
  };

  // Filtered lists for Step 2
  const filteredFaculty = useMemo(() => {
    if (!directory?.faculty) return [];
    return directory.faculty.filter((f) => {
      const matchesDept = deptFilter === 'All' || f.department === deptFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        f.name.toLowerCase().includes(q) ||
        f.faculty_id.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.department && f.department.toLowerCase().includes(q));
      return matchesDept && matchesSearch;
    });
  }, [directory, deptFilter, searchQuery]);

  const filteredClubs = useMemo(() => {
    if (!directory?.clubs) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return directory.clubs;
    return directory.clubs.filter((c) =>
      c.club_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [directory, searchQuery]);

  const filteredCoordinators = useMemo(() => {
    if (!directory?.coordinators) return [];
    if (deptFilter === 'All') return directory.coordinators;
    return directory.coordinators.filter((c) => {
      if (deptFilter === 'T&P') return c.name.includes('Training') || c.email.includes('tnp');
      return c.department === deptFilter;
    });
  }, [directory, deptFilter]);

  const coordinatorDeptChips = ['All', 'CSE', 'ECE', 'EE', 'ME', 'CE', 'PH', 'MA', 'HSS', 'T&P'];
  const facultyDeptChips = ['All', 'CSE', 'ECE', 'EE', 'ME', 'CE', 'PH', 'MA', 'HSS', 'ADMIN'];

  const carouselSlides = [
    {
      title: '1. Optimal Timetable Generation',
      desc: 'CP-SAT integer optimization schedules institutional teaching sessions across campus venues with zero hard violations in under 45 seconds.',
      icon: Cpu,
      stat: statsLoading
        ? 'Loading metrics...'
        : statsError
        ? 'Timetable Active'
        : `${stats?.sessions_scheduled ?? '-'} Sessions · ${stats?.hard_violations ?? '-'} Clashes`
    },
    {
      title: '2. Natural Language Venue Booking',
      desc: "Plain language venue requests ('seminar hall kal shaam 6 baje, 100 log') parsed and validated by deterministic priority rules.",
      icon: Sparkles,
      stat: statsLoading
        ? 'Loading bookings...'
        : statsError
        ? 'Fest Booking Engine'
        : `${stats?.bookings_count ?? '-'} Bookings · ${stats?.booking_score ? stats.booking_score.toFixed(1) : '-'}/70 Score`
    },
    {
      title: '3. Minimal-Change Disruption Repair',
      desc: 'Campus disruptions (faculty leave, room maintenance) are resolved with minimal moves and verified by the official validator before human approval.',
      icon: ShieldCheck,
      stat: statsLoading
        ? 'Loading history...'
        : statsError
        ? 'Zero Violations'
        : `${stats?.last_reschedule_moved_count ?? 0} Moved · 0 Violations`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-sky-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 flex-grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Hero Headline & Live Stats */}
          <div className="lg:col-span-6 space-y-7 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Chilika Institute of Technology
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Own The Week.
                <span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                  Zero Clashes, Zero Calls.
                </span>
              </h1>
              <p className="text-base text-slate-400 max-w-xl leading-relaxed">
                Autonomous integer programming campus timetable engine, Spectra Week venue optimization, and minimal-change disruption repair powered by Google OR-Tools CP-SAT and Gemini AI.
              </p>
            </div>

            {/* Live Stats Row with Loading Skeletons */}
            <div className="grid grid-cols-3 gap-3.5 max-w-lg">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-8 w-16 bg-slate-800/80 rounded animate-pulse mb-1" />
                ) : (
                  <div className="text-2xl font-bold text-sky-400">
                    {statsError || stats?.sessions_scheduled === undefined ? '-' : stats.sessions_scheduled}
                  </div>
                )}
                <div className="text-xs text-slate-400 font-medium">Sessions Scheduled</div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-8 w-12 bg-slate-800/80 rounded animate-pulse mb-1" />
                ) : (
                  <div className="text-2xl font-bold text-emerald-400">
                    {statsError || stats?.hard_violations === undefined ? '-' : stats.hard_violations}
                  </div>
                )}
                <div className="text-xs text-slate-400 font-medium">Hard Violations</div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                {statsLoading ? (
                  <div className="h-8 w-16 bg-slate-800/80 rounded animate-pulse mb-1" />
                ) : (
                  <div className="text-2xl font-bold text-cyan-400">
                    {statsError || stats?.booking_score === undefined ? '-' : stats.booking_score.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-slate-400 font-medium">Fest Booking Score</div>
              </div>
            </div>

            {/* Capability Carousel */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Core Capabilities</span>
                <div className="flex gap-1.5" role="tablist" aria-label="Capability carousel controls">
                  {carouselSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      role="tab"
                      aria-selected={activeSlide === idx}
                      aria-label={`Slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        activeSlide === idx ? 'bg-sky-400 w-6' : 'bg-slate-700 w-2 hover:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4 pt-1">
                {React.createElement(carouselSlides[activeSlide].icon, {
                  className: 'w-8 h-8 text-sky-400 shrink-0 mt-0.5'
                })}
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">
                    {carouselSlides[activeSlide].title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {carouselSlides[activeSlide].desc}
                  </p>
                  <span className="inline-block mt-2 text-[11px] font-mono font-medium text-sky-400 px-2.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                    {carouselSlides[activeSlide].stat}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Redesigned Step-Based Sign-In Card */}
          <div className="lg:col-span-6 w-full">
            <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-800 bg-slate-900/85 shadow-2xl relative">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Sign In to CIT Portal</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {step === 1
                      ? 'Choose your role to explore authorized accounts or enter credentials'
                      : `Select member for ${selectedRole === 'coordinator' ? 'Dept Coordinator' : selectedRole === 'club' ? 'Club Representative' : selectedRole}`}
                  </p>
                </div>
                {step === 2 && (
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedAccount(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: Four Role Tiles */}
              {step === 1 && (
                <div className="space-y-4 mb-6" role="radiogroup" aria-label="Select your role to sign in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Admin Tile */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedRole === 'admin'}
                      onClick={() => handleRoleSelect('admin')}
                      className="p-3.5 rounded-xl border text-left transition-all group bg-slate-800/70 hover:bg-sky-600/15 border-slate-700/80 hover:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">Campus Admin</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Full campus schedule control, institute events approval, system-wide conflict resolution.
                      </p>
                    </button>

                    {/* Department Coordinator Tile */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedRole === 'coordinator'}
                      onClick={() => handleRoleSelect('coordinator')}
                      className="p-3.5 rounded-xl border text-left transition-all group bg-slate-800/70 hover:bg-emerald-600/15 border-slate-700/80 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">Dept Coordinator</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Department timetable ownership, departmental lab booking approvals, manual session moves.
                      </p>
                    </button>

                    {/* Faculty Tile */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedRole === 'faculty'}
                      onClick={() => handleRoleSelect('faculty')}
                      className="p-3.5 rounded-xl border text-left transition-all group bg-slate-800/70 hover:bg-amber-600/15 border-slate-700/80 hover:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">Faculty Member</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Personal teaching timetable, unavailability requests, guest lecture venue bookings.
                      </p>
                    </button>

                    {/* Club Rep Tile */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedRole === 'club'}
                      onClick={() => handleRoleSelect('club')}
                      className="p-3.5 rounded-xl border text-left transition-all group bg-slate-800/70 hover:bg-purple-600/15 border-slate-700/80 hover:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">Club Representative</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Student event requests, venue availability tracking, fest week clash prevention.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Member Selector Based on Chosen Role */}
              {step === 2 && (
                <div className="space-y-3.5 mb-5">
                  {dirLoading ? (
                    <div className="space-y-2 py-4">
                      <div className="h-10 bg-slate-800/70 rounded-xl animate-pulse" />
                      <div className="h-10 bg-slate-800/70 rounded-xl animate-pulse" />
                      <div className="h-10 bg-slate-800/70 rounded-xl animate-pulse" />
                    </div>
                  ) : (
                    <>
                      {/* ADMIN ROLE: 2 Cards */}
                      {selectedRole === 'admin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {directory?.admins.map((adm) => {
                            const isSelected = selectedAccount?.identifier === adm.email;
                            return (
                              <button
                                key={adm.email}
                                type="button"
                                onClick={() => handleAccountSelect(adm.name, adm.email)}
                                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-sky-500/20 border-sky-400 shadow-md shadow-sky-500/10'
                                    : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-bold text-white">{adm.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{adm.email}</div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* COORDINATOR ROLE: Department Chips + Coordinator List */}
                      {selectedRole === 'coordinator' && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {coordinatorDeptChips.map((dept) => (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => setDeptFilter(dept)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                  deptFilter === dept
                                    ? 'bg-emerald-500 text-slate-950 shadow'
                                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                              >
                                {dept}
                              </button>
                            ))}
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {filteredCoordinators.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                No coordinators found for {deptFilter}.
                              </div>
                            ) : (
                              filteredCoordinators.map((c) => {
                                const isSelected = selectedAccount?.identifier === c.email;
                                return (
                                  <button
                                    key={c.email}
                                    type="button"
                                    onClick={() => handleAccountSelect(c.name, c.email)}
                                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-emerald-500/20 border-emerald-400'
                                        : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-white flex items-center gap-2">
                                        {c.name}
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                          {c.department}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.email}</div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* FACULTY ROLE: Search + Department Chips + 40 Faculty List */}
                      {selectedRole === 'faculty' && (
                        <div className="space-y-2.5">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search 40 faculty by name, F-ID (e.g. F06), or dept..."
                              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Dept Chips */}
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {facultyDeptChips.map((dept) => (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => setDeptFilter(dept)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                                  deptFilter === dept
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {dept}
                              </button>
                            ))}
                          </div>

                          {/* Scrollable Faculty List */}
                          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                            {filteredFaculty.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                No faculty members found matching "{searchQuery}".
                              </div>
                            ) : (
                              filteredFaculty.map((f) => {
                                const isSelected = selectedAccount?.identifier === f.faculty_id || selectedAccount?.identifier === f.email;
                                return (
                                  <button
                                    key={f.faculty_id}
                                    type="button"
                                    onClick={() => handleAccountSelect(f.name, f.faculty_id)}
                                    className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between border ${
                                      isSelected
                                        ? 'bg-amber-500/20 border-amber-400 text-white'
                                        : 'bg-slate-800/60 hover:bg-slate-800 border-transparent text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                        {f.faculty_id}
                                      </span>
                                      <div>
                                        <div className="text-xs font-semibold text-white">{f.name}</div>
                                        <div className="text-[10px] text-slate-400">Dept: {f.department} · {f.email}</div>
                                      </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* CLUB ROLE: Search + 11 Clubs Grid */}
                      {selectedRole === 'club' && (
                        <div className="space-y-2.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search 11 student clubs..."
                              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                            {filteredClubs.length === 0 ? (
                              <div className="col-span-2 p-4 text-center text-xs text-slate-500">
                                No clubs found matching "{searchQuery}".
                              </div>
                            ) : (
                              filteredClubs.map((c) => {
                                const isSelected = selectedAccount?.identifier === c.email;
                                return (
                                  <button
                                    key={c.email}
                                    type="button"
                                    onClick={() => handleAccountSelect(c.club_name, c.email)}
                                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-purple-500/20 border-purple-400'
                                        : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700'
                                    }`}
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-white">{c.club_name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{c.email}</div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Prominent One-Click Sign-In Action When An Account is Selected */}
                      {selectedAccount && selectedRole && (
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mt-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              Selected: <strong className="text-white">{selectedAccount.name}</strong>
                            </span>
                            <span className="text-[11px] font-mono text-sky-400">
                              Demo password: <strong className="text-slate-200">{ROLE_PASSWORDS[selectedRole]}</strong>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExecuteLogin(selectedAccount.identifier, ROLE_PASSWORDS[selectedRole])}
                            disabled={isSubmitting || isAuthLoading}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            <span>{isSubmitting ? 'Signing In...' : `Sign in as ${selectedAccount.name}`}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Separator to Manual Form */}
              <div className="relative flex py-2 items-center my-3">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Or enter credentials manually
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Manual Form (One field Email or Faculty ID + Password with Show/Hide toggle) */}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label htmlFor="identifier-input" className="block text-xs font-medium text-slate-300 mb-1">
                    Email or Faculty ID
                  </label>
                  <input
                    id="identifier-input"
                    type="text"
                    value={manualIdentifier}
                    onChange={(e) => setManualIdentifier(e.target.value)}
                    placeholder="e.g. F06 or coord_cse@cit.edu"
                    autoComplete="username"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password-input" className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isAuthLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all focus:outline-none disabled:opacity-50"
                >
                  {isSubmitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-5 text-center text-xs text-slate-500">
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
