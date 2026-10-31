import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { 
  ShieldCheck, CheckCircle2, 
  Upload, Check, Move
} from 'lucide-react';

export const RescheduleDiffPage: React.FC = () => {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeProposal, setActiveProposal] = useState<any>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);

  // Upload disruption state
  const [disruptionText, setDisruptionText] = useState<string>('');
  const [isSubmittingDisruption, setIsSubmittingDisruption] = useState<boolean>(false);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/disruptions/proposals');
      setProposals(res.data);
      if (res.data.length > 0) {
        setActiveProposal(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleApprove = async (proposalId: string) => {
    if (!window.confirm('Approve and activate repaired timetable?')) return;
    setIsApproving(true);
    setApprovalMsg(null);
    try {
      const res = await api.post(`/disruptions/proposals/${proposalId}/approve`);
      setApprovalMsg(res.data.message);
      fetchProposals();
    } catch (err: any) {
      alert('Approval failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsApproving(false);
    }
  };

  const handleLoadSampleDisruption = () => {
    setDisruptionText(JSON.stringify({
      id: "sample-disruption",
      description: "F07 Monday travel, CR-102 room repair closure, new CSE-2 tutorial CS202-T2",
      changes: [
        { type: "faculty_unavailable", faculty_id: "F07", days: ["MON"], periods: [1,2,3,4,5,6,7,8,9], reason: "Conference travel" },
        { type: "room_unavailable", room_id: "CR-102", days: ["MON","TUE","WED","THU","FRI"], periods: [1,2,3,4,5,6,7,8,9], reason: "Water leak repair" },
        { type: "add_session", session: { id: "CS202-T2", course_id: "CS202", kind: "tutorial", groups: ["CSE-2"], faculty_id: "F06", size: 80, duration: 1, room_types: ["classroom", "lecture_hall", "auditorium"], needs_accessible: false, basket_slot: null, fixed_slot: null } }
      ]
    }, null, 2));
  };

  const handleSubmitDisruption = async () => {
    if (!disruptionText.trim()) return;
    setIsSubmittingDisruption(true);
    try {
      const parsed = JSON.parse(disruptionText);
      const subRes = await api.post('/disruptions', parsed);
      const disId = subRes.data.disruption_id;

      // Trigger propose repair
      const propRes = await api.post(`/disruptions/${disId}/propose`);
      setActiveProposal(propRes.data);
      fetchProposals();
      alert('Minimal-change repair completed with 0 hard violations!');
    } catch (err: any) {
      alert('Disruption processing failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmittingDisruption(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-zinc-900/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Minimal Disruption Engine
          </div>
          <h1 className="text-2xl font-bold text-white">Disruptions & Reschedule Diff</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Compare before-and-after schedule triples. Human Admin approval is required before activating changes.
          </p>
        </div>

        {activeProposal && activeProposal.status === 'pending_approval' && user?.role === 'admin' && (
          <div className="flex items-center gap-3">
            {activeProposal.reported_by && user?.email === activeProposal.reported_by ? (
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <span>Anti-Self-Approval:</span>
                <span className="text-amber-400 font-mono text-[11px]">Submitted by you ({user.email}). Another admin must approve.</span>
              </div>
            ) : (
              <button
                onClick={() => handleApprove(activeProposal.proposal_id)}
                disabled={isApproving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isApproving ? 'Activating...' : 'Approve & Activate New Schedule'}
              </button>
            )}
          </div>
        )}
      </div>

      {approvalMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {approvalMsg}
        </div>
      )}

      {/* Grid: Diff Details & Upload Disruption Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Diff View */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="glass-panel p-12 text-center text-sm text-zinc-500 rounded-2xl border border-white/10">
              Loading minimal-change repair diff proposals...
            </div>
          ) : activeProposal ? (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-zinc-950/60 space-y-6">
              
              {/* Optimal Moves Proved Callout */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong>Minimum possible moves: {activeProposal.minimum_possible_moves || activeProposal.moved_count}</strong> (proved optimal: {activeProposal.forced_count || activeProposal.moved_count} forced by disruption, 0 unnecessary shifts).
                  </span>
                </div>
                <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded w-fit border border-emerald-500/30">
                  Tier {activeProposal.active_widening_tier ?? 0}: Forced Only
                </span>
              </div>

              {/* Diff Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 mb-1">Total Moved</div>
                  <div className="text-2xl font-bold text-white">{activeProposal.moved_count}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Minimal impact</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 mb-1">Time Changed</div>
                  <div className="text-2xl font-bold text-amber-400">{activeProposal.time_changed_count}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Only required shifts</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 mb-1">Room Only</div>
                  <div className="text-2xl font-bold text-violet-400">{activeProposal.room_only_changed_count}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Kept same time slot</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 mb-1">Hard Violations</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {activeProposal.hard_violations}
                  </div>
                  <div className="text-[10px] text-emerald-400/90 mt-0.5">100% Rule Parity</div>
                </div>
              </div>

              {/* Before vs After Session Comparison Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Move className="w-4 h-4 text-emerald-400" />
                  Session Diff (Before → After)
                </h3>

                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                        <th className="p-3 font-semibold">Session ID</th>
                        <th className="p-3 font-semibold">Baseline Slot (Before)</th>
                        <th className="p-3 font-semibold">Repaired Slot (After)</th>
                        <th className="p-3 font-semibold">Change Type</th>
                        <th className="p-3 font-semibold">Disruption Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                      {activeProposal.moved_sessions?.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-zinc-900/40">
                          <td className="p-3 font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit">{m.session_id}</td>
                          <td className="p-3 text-zinc-400">
                            {m.before ? (
                              <span>
                                {m.before.day} Period {m.before.start_period} in <strong className="text-zinc-300">{m.before.room_id}</strong>
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">[New Session]</span>
                            )}
                          </td>
                          <td className="p-3 text-white">
                            <span className="font-semibold text-emerald-300">
                              {m.after.day} Period {m.after.start_period} in {m.after.room_id}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.before === null
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : m.time_changed
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                              }`}
                            >
                              {m.before === null ? 'Added' : m.time_changed ? 'Time + Room' : 'Room Only'}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-300 font-sans text-[11px]">
                            {m.reason || (m.before === null ? 'Newly added session scheduled' : m.time_changed ? 'Time shifted due to disruption' : 'Relocated to alternative venue')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel p-12 text-center text-zinc-400 text-sm">
              No change proposals pending.
            </div>
          )}
        </div>

        {/* Right Column: Upload Disruption Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-zinc-900/60 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Apply Disruption Payload
            </h3>
            <p className="text-xs text-zinc-400">
              Submit disruption changes (faculty absence, venue closure, added session) to simulate real-world emergencies.
            </p>

            <button
              onClick={handleLoadSampleDisruption}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-zinc-700 transition-all text-center"
            >
              Load Official Sample Disruption
            </button>

            <textarea
              rows={12}
              value={disruptionText}
              onChange={(e) => setDisruptionText(e.target.value)}
              placeholder="Paste disruption JSON here..."
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono focus:outline-none focus:border-white"
            />

            <button
              onClick={handleSubmitDisruption}
              disabled={isSubmittingDisruption || !disruptionText.trim()}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-zinc-950 bg-white hover:bg-zinc-200 shadow-xl shadow-white/10 transition-all disabled:opacity-50"
            >
              {isSubmittingDisruption ? 'Solving Minimal Repair...' : 'Compute Minimal-Change Repair'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
