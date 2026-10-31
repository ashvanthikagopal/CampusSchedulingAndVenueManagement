import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, 
  HelpCircle, X, ShieldCheck, UserCheck, Plus, Sparkles
} from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const PERIOD_TIMES: Record<number, string> = {
  1: '08:00 - 09:00',
  2: '09:00 - 10:00',
  3: '10:00 - 11:00',
  4: '11:00 - 12:00',
  5: '12:00 - 13:00 (Lunch)',
  6: '13:00 - 14:00',
  7: '14:00 - 15:00',
  8: '15:00 - 16:00',
  9: '16:00 - 17:00'
};

export const MySchedulePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Unavailability modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDay, setLeaveDay] = useState('MON');
  const [leaveStartPeriod, setLeaveStartPeriod] = useState(1);
  const [leaveEndPeriod, setLeaveEndPeriod] = useState(3);
  const [leaveReason, setLeaveReason] = useState('Faculty academic leave');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Fetch faculty schedule
  const { data: scheduleData, isLoading, refetch } = useQuery({
    queryKey: ['myFacultySchedule', user?.faculty_id],
    queryFn: async () => {
      const res = await api.get('/schedule/faculty/my-schedule');
      return res.data;
    },
    enabled: !!user?.faculty_id
  });

  // Fetch explain data for selected session
  const { data: explainData, isLoading: explainLoading } = useQuery({
    queryKey: ['sessionExplain', selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const res = await api.get(`/schedule/sessions/${selectedSessionId}/explain`);
      return res.data;
    },
    enabled: !!selectedSessionId
  });

  const handleDryRun = async () => {
    setDryRunLoading(true);
    setDryRunResult(null);
    try {
      const periods = [];
      for (let p = Number(leaveStartPeriod); p <= Number(leaveEndPeriod); p++) {
        periods.push(p);
      }
      const res = await api.post('/disruptions/dry-run', {
        description: `Faculty Leave: ${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod}`,
        changes: [
          {
            type: "faculty_unavailable",
            faculty_id: user?.faculty_id,
            days: [leaveDay],
            periods: periods,
            reason: leaveReason
          }
        ]
      });
      setDryRunResult(res.data);
      if (res.data.status === 'FEASIBLE') {
        showToast('Dry-run succeeded: 0 hard violations verified!', 'success');
      } else {
        showToast('Dry-run warning: disruption produces schedule conflicts.', 'warning');
      }
    } catch (err: any) {
      showToast('Dry-run error: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleSubmitLeave = async () => {
    setIsSubmittingLeave(true);
    try {
      const periods = [];
      for (let p = Number(leaveStartPeriod); p <= Number(leaveEndPeriod); p++) {
        periods.push(p);
      }
      await api.post('/disruptions', {
        description: `Leave Declaration: Prof. ${user?.name} (${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod})`,
        changes: [
          {
            type: "faculty_unavailable",
            faculty_id: user?.faculty_id,
            days: [leaveDay],
            periods: periods,
            reason: leaveReason
          }
        ]
      });
      showToast('Leave request submitted to Admin approval queue!', 'success');
      setLeaveModalOpen(false);
      setDryRunResult(null);
      refetch();
    } catch (err: any) {
      showToast('Submission error: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-mono">Loading your teaching timetable...</p>
      </div>
    );
  }

  // Build grid map: day -> period -> session
  const gridMap: Record<string, Record<number, any>> = {};
  DAYS.forEach(d => {
    gridMap[d] = {};
  });

  scheduleData?.sessions?.forEach((s: any) => {
    if (gridMap[s.day]) {
      gridMap[s.day][s.start_period] = s;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-sky-950/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-3">
            <UserCheck className="w-3.5 h-3.5" />
            Faculty Portal · {scheduleData?.faculty_name || user?.name} ({scheduleData?.faculty_id || user?.faculty_id})
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            My Teaching Schedule
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Department of {scheduleData?.department || user?.department}. Weekly teaching assignments with automated workload checks and interactive slot explainability.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-md shadow-sky-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Mark Unavailability / Leave</span>
          </button>
        </div>
      </div>

      {/* Daily Workload KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {scheduleData?.daily_workload?.map((w: any) => {
          const isAtLimit = w.teaching_hours >= w.max_hours;
          return (
            <div key={w.day} className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">{w.day}</span>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                  isAtLimit ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {isAtLimit ? 'Max Hours' : 'Under Limit (H12)'}
                </span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {w.teaching_hours}h <span className="text-xs font-normal text-slate-500">/ {w.max_hours}h limit</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isAtLimit ? 'bg-amber-400' : 'bg-sky-400'}`}
                  style={{ width: `${Math.min(100, (w.teaching_hours / w.max_hours) * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400">
                Free: {w.free_periods.length > 0 ? `Periods ${w.free_periods.join(', ')}` : 'None'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Timetable Grid */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-400" />
            Weekly Session Grid (Periods 1 - 9)
          </h2>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> 0 Timetable Clashes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-3 w-24">Day</th>
                {PERIODS.map(p => (
                  <th key={p} className={`py-3 px-2 text-center ${p === 5 ? 'bg-slate-950/80 text-amber-400 font-bold' : ''}`}>
                    P{p}
                    <div className="text-[9px] font-normal text-slate-500">{p === 5 ? 'Lunch' : PERIOD_TIMES[p].split(' - ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-3 font-bold text-white bg-slate-900/60">{day}</td>
                  {PERIODS.map(p => {
                    if (p === 5) {
                      return (
                        <td key={p} className="p-2 text-center bg-slate-950/60 border-x border-slate-800/60">
                          <span className="text-[10px] text-amber-500/80 font-mono">Lunch</span>
                        </td>
                      );
                    }
                    const sess = gridMap[day]?.[p];
                    if (!sess) {
                      return (
                        <td key={p} className="p-2 text-center">
                          <span className="text-[10px] text-slate-700 font-mono">-</span>
                        </td>
                      );
                    }

                    return (
                      <td key={p} className="p-1.5">
                        <div
                          onClick={() => setSelectedSessionId(sess.session_id)}
                          className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-200 cursor-pointer transition-all hover:scale-[1.02] shadow-sm space-y-1"
                        >
                          <div className="font-bold text-[11px] text-white flex items-center justify-between">
                            <span>{sess.course_id}</span>
                            <span className="text-[9px] font-mono text-sky-400 capitalize">{sess.kind[0]}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 font-medium">{sess.room_name || sess.room_id}</div>
                          <div className="text-[9px] text-slate-400 truncate">{sess.groups?.join(', ')}</div>
                          <button className="text-[9px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 pt-1">
                            <HelpCircle className="w-2.5 h-2.5" /> Why here?
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* "Why here?" Explain Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900 max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-sky-400" />
                  Slot Explainability: {selectedSessionId}
                </h3>
                <p className="text-xs text-slate-400">Deterministic constraint and placement breakdown</p>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {explainLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading placement explanation...</div>
            ) : explainData ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-slate-400">Assigned Slot:</div>
                  <div className="text-white font-bold text-sm">
                    {explainData.assigned_day} Period {explainData.assigned_period} in {explainData.assigned_room}
                  </div>
                  <div className="text-emerald-400 font-mono text-[11px] pt-1">
                    {explainData.legal_options_count} total mathematically legal options across campus
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">Placement Factors:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    {explainData.reasons_for_placement?.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">Conflicts Prevented:</div>
                  <ul className="list-disc list-inside space-y-1 text-emerald-400/90">
                    {explainData.conflicts_avoided?.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                {explainData.alternative_slots && explainData.alternative_slots.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="font-semibold text-slate-300">Top Verified Alternatives:</div>
                    <div className="space-y-1.5">
                      {explainData.alternative_slots.map((alt: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300 flex items-center justify-between text-[11px]">
                          <span>{alt.day} Period {alt.start_period} in {alt.room_name || alt.room_id}</span>
                          <span className="font-mono text-emerald-400">Δ soft: {alt.soft_delta ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-rose-400">Unable to load explanation.</div>
            )}

            <button
              onClick={() => setSelectedSessionId(null)}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leave Declaration Modal with Solver Dry-Run */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900 max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-400" />
                  Mark Unavailability / Leave
                </h3>
                <p className="text-xs text-slate-400">Submit unavailability with solver impact preview</p>
              </div>
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Day of Week</label>
                <select
                  value={leaveDay}
                  onChange={e => setLeaveDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Period</label>
                  <select
                    value={leaveStartPeriod}
                    onChange={e => setLeaveStartPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>Period {p} ({PERIOD_TIMES[p].split(' - ')[0]})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Period</label>
                  <select
                    value={leaveEndPeriod}
                    onChange={e => setLeaveEndPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    {PERIODS.filter(p => p >= leaveStartPeriod).map(p => (
                      <option key={p} value={p}>Period {p} ({PERIOD_TIMES[p].split(' - ')[1]})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Leave</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="e.g. Academic conference, medical appointment"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              {/* Dry-Run Result Preview */}
              {dryRunResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  dryRunResult.status === 'FEASIBLE'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {dryRunResult.status === 'FEASIBLE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Status: {dryRunResult.status}</span>
                  </div>
                  {dryRunResult.status === 'FEASIBLE' ? (
                    <div>
                      <div>Minimal-change repair feasible: <strong>{dryRunResult.moved_count}</strong> sessions moved ({dryRunResult.time_changed_count} time shifts, {dryRunResult.room_only_changed_count} room swaps).</div>
                      <div>Hard violations: <strong>{dryRunResult.hard_violations}</strong> · Soft penalty delta: <strong>{dryRunResult.soft_delta}</strong></div>
                    </div>
                  ) : (
                    <div>{dryRunResult.message}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDryRun}
                disabled={dryRunLoading}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors disabled:opacity-50"
              >
                {dryRunLoading ? 'Simulating Repair...' : 'Run Feasibility Dry-Run'}
              </button>
              <button
                type="button"
                onClick={handleSubmitLeave}
                disabled={isSubmittingLeave}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

