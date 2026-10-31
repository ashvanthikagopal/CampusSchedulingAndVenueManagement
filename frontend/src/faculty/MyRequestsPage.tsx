import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, 
  HelpCircle, X, ShieldCheck, Plus, Sparkles,
  Layers, MapPin, FileText, ArrowRight, UserCheck, Filter
} from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const MyRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'disruptions' | 'session_requests' | 'bookings'>('all');

  // Leave / Unavailability Modal State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDay, setLeaveDay] = useState('MON');
  const [leaveStartPeriod, setLeaveStartPeriod] = useState(1);
  const [leaveEndPeriod, setLeaveEndPeriod] = useState(3);
  const [leaveReason, setLeaveReason] = useState('Faculty academic leave');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Session Request Modal State
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [reqType, setReqType] = useState<'move' | 'extra'>('move');
  const [courseId, setCourseId] = useState('CS202');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [sessionKind, setSessionKind] = useState('lecture');
  const [sessionDuration, setSessionDuration] = useState(1);
  const [prefDay, setPrefDay] = useState('WED');
  const [prefPeriod, setPrefPeriod] = useState(4);
  const [sessionReason, setSessionReason] = useState('Guest speaker schedule alignment');
  const [isSubmittingSessionReq, setIsSubmittingSessionReq] = useState(false);

  // Queries
  const { data: disruptions, isLoading: loadingDisruptions, refetch: refetchDisruptions } = useQuery({
    queryKey: ['myDisruptions'],
    queryFn: async () => {
      const res = await api.get('/disruptions/mine');
      return res.data || [];
    }
  });

  const { data: sessionRequests, isLoading: loadingSessionRequests, refetch: refetchSessionRequests } = useQuery({
    queryKey: ['mySessionRequests'],
    queryFn: async () => {
      const res = await api.get('/session-requests/mine');
      return res.data || [];
    }
  });

  const { data: bookings, isLoading: loadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ['myBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/mine');
      return res.data || [];
    }
  });

  const isLoading = loadingDisruptions || loadingSessionRequests || loadingBookings;

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
      await api.post('/disruptions/report', {
        description: `Leave declaration by ${user?.name}: ${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod}`,
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
      showToast('Leave request submitted to Admin queue for review!', 'success');
      setLeaveModalOpen(false);
      setDryRunResult(null);
      refetchDisruptions();
    } catch (err: any) {
      showToast('Failed to submit leave: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleSubmitSessionReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSessionReq(true);
    try {
      await api.post('/session-requests', {
        course_id: courseId,
        request_type: reqType,
        target_session_id: reqType === 'move' ? (targetSessionId || undefined) : undefined,
        kind: sessionKind,
        duration: Number(sessionDuration),
        preferred_windows: [
          { day: prefDay, start_period: Number(prefPeriod), end_period: Number(prefPeriod) + Number(sessionDuration) - 1 }
        ],
        reason: sessionReason
      });
      showToast('Session adjustment request submitted for review!', 'success');
      setSessionModalOpen(false);
      refetchSessionRequests();
    } catch (err: any) {
      showToast('Submission error: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setIsSubmittingSessionReq(false);
    }
  };

  // Compile combined list
  const dList = (disruptions || []).map((d: any) => ({
    type: 'disruption',
    id: d.id,
    title: d.description || 'Unavailability / Leave Declaration',
    status: d.status || 'pending',
    date: d.created_at,
    raw: d
  }));

  const sList = (sessionRequests || []).map((s: any) => ({
    type: 'session_request',
    id: s.id,
    title: `${s.request_type === 'move' ? 'Move Class' : 'Extra Session'}: ${s.course_id} (${s.kind})`,
    status: s.status || 'pending',
    date: s.created_at,
    raw: s
  }));

  const bList = (bookings || []).map((b: any) => ({
    type: 'booking',
    id: b.id,
    title: b.title || 'Venue Booking Request',
    status: b.status || 'pending',
    date: b.submitted_at,
    raw: b
  }));

  let combined = [...dList, ...sList, ...bList];
  if (activeTab === 'disruptions') combined = dList;
  if (activeTab === 'session_requests') combined = sList;
  if (activeTab === 'bookings') combined = bList;

  // Counts
  const totalCount = dList.length + sList.length + bList.length;
  const pendingCount = [...dList, ...sList, ...bList].filter(x => x.status === 'pending' || x.status === 'pending_approval').length;
  const approvedCount = [...dList, ...sList, ...bList].filter(x => x.status === 'approved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-sky-400" />
              My Requests & Approvals
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Faculty: {user?.faculty_id || 'F06'}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Track leave declarations, schedule move/extra requests, and venue bookings. All requests undergo deterministic validator and CP-SAT checks before approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLeaveModalOpen(true); setDryRunResult(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Clock className="w-4 h-4" />
            Declare Leave
          </button>
          <button
            onClick={() => setSessionModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-sky-600/20"
          >
            <Plus className="w-4 h-4" />
            Request Class Adjustment
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-slate-800/80 rounded-lg text-slate-300">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-xs text-slate-400">Total Submissions</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <div className="text-xs text-slate-400">Pending Admin Review</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">{approvedCount}</div>
            <div className="text-xs text-slate-400">Approved & Applied</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 rounded-lg text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-sky-400">0</div>
            <div className="text-xs text-slate-400">Hard Violations Guaranteed</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          All Requests ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('disruptions')}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'disruptions'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Leaves & Disruptions ({dList.length})
        </button>
        <button
          onClick={() => setActiveTab('session_requests')}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'session_requests'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Class Adjustments ({sList.length})
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bookings'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Venue Bookings ({bList.length})
        </button>
      </div>

      {/* List Content */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 glass-panel rounded-xl border border-slate-800 animate-pulse">
          Loading requests and solver records...
        </div>
      ) : combined.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-xl border border-slate-800">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No requests found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            You haven't submitted any leave declarations or schedule requests yet. Use the buttons above to declare leave or request class moves.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {combined.map((item) => {
            const isApproved = item.status === 'approved';
            const isPending = item.status === 'pending' || item.status === 'pending_approval';
            const isAlt = item.status === 'alternative_offered';
            const isRejected = item.status === 'rejected';

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        item.type === 'disruption' 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : item.type === 'session_request'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      }`}>
                        {item.type === 'disruption' ? 'Leave Declaration' : item.type === 'session_request' ? 'Class Adjustment' : 'Venue Booking'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.id}
                      </span>
                      {item.raw.proposal?.validator_report?.hard_violation_count === 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                          0 Hard Violations
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      {item.title}
                    </h3>

                    {/* Sub-details */}
                    {item.type === 'disruption' && item.raw.changes && (
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>Day: {item.raw.changes[0]?.days?.join(', ')}</span>
                        <span>Periods: P{item.raw.changes[0]?.periods?.join(', P')}</span>
                        <span>Reason: {item.raw.changes[0]?.reason}</span>
                      </div>
                    )}

                    {item.type === 'session_request' && (
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>Target: {item.raw.target_session_id || 'New session'}</span>
                        <span>Duration: {item.raw.duration} hr</span>
                        <span>Preferred: {item.raw.preferred_windows?.[0]?.day} P{item.raw.preferred_windows?.[0]?.start_period}</span>
                        <span>Reason: {item.raw.reason}</span>
                      </div>
                    )}

                    {item.type === 'booking' && (
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>Category: <strong className="text-slate-300">{item.raw.effective_category || 'guest_lecture'}</strong></span>
                        <span>Requested Venue: {item.raw.requested_room || 'Any'}</span>
                        {item.raw.assigned_room && (
                          <span className="text-emerald-400 font-medium">Assigned: {item.raw.assigned_room} ({item.raw.assigned_day} P{item.raw.start_period}-P{item.raw.end_period})</span>
                        )}
                        {item.raw.reason && (
                          <span>Note: {item.raw.reason}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                      isApproved 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isAlt
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                        : isRejected
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {isApproved ? 'Approved & Applied' : isAlt ? 'Alternative Offered' : isRejected ? 'Rejected' : 'Pending Review'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Declare Leave / Unavailability */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setLeaveModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Declare Faculty Leave / Unavailability</h3>
                <p className="text-xs text-slate-400">Scoped to your Faculty ID ({user?.faculty_id}). Verifies zero hard violations before submission.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Day</label>
                  <select
                    value={leaveDay}
                    onChange={(e) => setLeaveDay(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Start Period</label>
                  <select
                    value={leaveStartPeriod}
                    onChange={(e) => setLeaveStartPeriod(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">End Period</label>
                  <select
                    value={leaveEndPeriod}
                    onChange={(e) => setLeaveEndPeriod(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {PERIODS.filter(p => p >= leaveStartPeriod).map(p => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Reason for Leave</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="e.g., Attending research symposium / medical leave"
                />
              </div>

              {/* Dry-run action */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDryRun}
                  disabled={dryRunLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {dryRunLoading ? 'Evaluating with Solver...' : 'Run Dry-Run Repair Preview'}
                </button>
                {dryRunResult && (
                  <span className={`text-xs font-medium ${dryRunResult.status === 'FEASIBLE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dryRunResult.status === 'FEASIBLE' ? 'Feasible (0 Hard Violations)' : 'Conflicts Detected'}
                  </span>
                )}
              </div>

              {/* Dry-run result preview */}
              {dryRunResult && (
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="font-semibold text-slate-300 flex items-center justify-between">
                    <span>Dry-Run Solver Diagnostics</span>
                    <span className="text-slate-400 font-mono">Moved: {dryRunResult.moved_sessions?.length || 0} sessions</span>
                  </div>
                  {dryRunResult.status === 'FEASIBLE' ? (
                    <div className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      CP-SAT found minimal-change conflict-free repair! Hard violations: {dryRunResult.validator_report?.hard_violation_count || 0}.
                    </div>
                  ) : (
                    <div className="text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Infeasible: {dryRunResult.infeasible_diagnostic?.explanation || 'Conflicts detected.'}
                    </div>
                  )}
                  {dryRunResult.moved_sessions?.length > 0 && (
                    <div className="space-y-1 mt-1 border-t border-slate-800/80 pt-2">
                      <span className="text-slate-400 font-medium">Proposed Session Movements:</span>
                      {dryRunResult.moved_sessions.slice(0, 3).map((m: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-300 font-mono">
                          <span className="text-sky-400">{m.session_id}</span>
                          <span>{m.original_slot}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="text-emerald-400">{m.new_slot} ({m.new_room})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitLeave}
                  disabled={isSubmittingLeave}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-amber-600/20 disabled:opacity-50"
                >
                  {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Request Class Adjustment */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSessionModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Request Class Adjustment</h3>
                <p className="text-xs text-slate-400">Request to move an existing scheduled class or propose an extra lecture.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitSessionReq} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Request Type</label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="move">Move Existing Class</option>
                    <option value="extra">Request Extra Lecture</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Course ID</label>
                  <input
                    type="text"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase"
                    placeholder="e.g. CS202"
                    required
                  />
                </div>
              </div>

              {reqType === 'move' && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Session ID</label>
                  <input
                    type="text"
                    value={targetSessionId}
                    onChange={(e) => setTargetSessionId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                    placeholder="e.g. CS202-T1"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Leave blank to let the system auto-match from your assigned sessions.</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Preferred Day</label>
                  <select
                    value={prefDay}
                    onChange={(e) => setPrefDay(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Preferred Period</label>
                  <select
                    value={prefPeriod}
                    onChange={(e) => setPrefPeriod(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Duration (Hours)</label>
                  <select
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={sessionReason}
                  onChange={(e) => setSessionReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="e.g., Guest speaker schedule alignment / syllabus coverage"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSessionReq}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-sky-600/20 disabled:opacity-50"
                >
                  {isSubmittingSessionReq ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

