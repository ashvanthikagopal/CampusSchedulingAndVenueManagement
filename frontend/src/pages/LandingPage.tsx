import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { ShieldCheck, Sparkles, ArrowRight, Cpu } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { login, demoLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    }
  };

  const handleDemo = async (role: 'admin' | 'admin2' | 'coordinator' | 'faculty' | 'club' | 'student') => {
    setError(null);
    try {
      await demoLogin(role);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Demo login failed');
    }
  };

  const carouselSlides = [
    {
      title: "1. Generate Optimal Timetable",
      desc: "Pure CP-SAT integer optimization schedules 189 sessions across 27 venues with 0 hard violations in under 45 seconds.",
      icon: Cpu,
      stat: "189 Sessions · 0 Clashes"
    },
    {
      title: "2. Book in English & Hinglish",
      desc: "Plain language venue requests ('seminar hall kal shaam 6 baje, 100 log') parsed and validated by deterministic rule checks.",
      icon: Sparkles,
      stat: "24 Live Bookings · 67/70 Score"
    },
    {
      title: "3. Reschedule Safely with Minimal Change",
      desc: "Disruptions (faculty leave, room repair) are solved with minimal moves and verified by the official validator before human Admin approval.",
      icon: ShieldCheck,
      stat: "14 Moved · 0 Violations"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Background radial gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-sky-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Hero Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 flex-grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Headline & Value Props */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Chilika Institute of Technology
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Own The Week.
                <span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                  Zero Clashes, Zero Calls.
                </span>
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                Autonomous mathematical campus scheduling, Spectra Week venue optimization, and minimal-change disruption repair powered by Google OR-Tools CP-SAT and Gemini AI.
              </p>
            </div>

            {/* Live Stat Band */}
            <div className="grid grid-cols-3 gap-4 pt-2 max-w-lg">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="text-2xl font-bold text-sky-400">189</div>
                <div className="text-xs text-slate-400">Sessions Placed</div>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="text-2xl font-bold text-emerald-400">0</div>
                <div className="text-xs text-slate-400">Hard Violations</div>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="text-2xl font-bold text-cyan-400">67.0</div>
                <div className="text-xs text-slate-400">Fest Booking Score</div>
              </div>
            </div>

            {/* Trust Carousel / How It Works */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Core Capabilities</span>
                <div className="flex gap-1.5">
                  {carouselSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        activeSlide === idx ? 'bg-sky-400 w-6' : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4 pt-1">
                {React.createElement(carouselSlides[activeSlide].icon, {
                  className: "w-8 h-8 text-sky-400 flex-shrink-0 mt-0.5"
                })}
                <div>
                  <h4 className="text-base font-semibold text-white">
                    {carouselSlides[activeSlide].title}
                  </h4>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {carouselSlides[activeSlide].desc}
                  </p>
                  <span className="inline-block mt-2 text-xs font-mono font-medium text-sky-400 px-2.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                    {carouselSlides[activeSlide].stat}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Demo Accounts & Login Card */}
          <div className="lg:col-span-5">
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl relative">
              <div className="space-y-2 mb-6 text-center">
                <h3 className="text-xl font-bold text-white">Sign In to Zero Hour</h3>
                <p className="text-xs text-slate-400">
                  Select a pre-seeded demo role or sign in with your campus credentials
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                  {error}
                </div>
              )}

              {/* 1-Click Demo Login Role Selector */}
              <div className="space-y-2 mb-6">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  One-Click Demo Roles
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDemo('admin')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-sky-600/20 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      A
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Campus Admin</div>
                      <div className="text-[10px] text-slate-400">Full Access</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDemo('admin2')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-sky-600/20 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      A2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Admin 2 (Dean)</div>
                      <div className="text-[10px] text-slate-400">Anti-Self-Appr</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDemo('coordinator')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-sky-600/20 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      C
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Coordinator</div>
                      <div className="text-[10px] text-slate-400">CSE Department</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDemo('faculty')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-sky-600/20 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      F
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Prof. Sharma</div>
                      <div className="text-[10px] text-slate-400">Faculty (F06)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDemo('student')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-sky-600/20 hover:border-sky-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      S
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Student</div>
                      <div className="text-[10px] text-slate-400">Class Y1-A</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDemo('club')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-purple-600/20 hover:border-purple-500/40 border border-slate-700/80 text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs group-hover:scale-105">
                      CR
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Dance Club Rep</div>
                      <div className="text-[10px] text-slate-400">Fest Bookings</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Standard Email / Password Form */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or with credentials</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Campus Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@cit.edu"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 transition-all focus:outline-none disabled:opacity-50"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
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
