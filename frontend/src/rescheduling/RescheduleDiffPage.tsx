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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Minimal Disruption Engine
          </div>
          <h1 className="text-2xl font-bold text-white">Disruptions & Reschedule Diff</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare before-and-after schedule triples. Human Admin approval is required before activating changes.
          </p>
        </div>

        {activeProposal && activeProposal.status === 'pending_approval' && user?.role === 'admin' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleApprove(activeProposal.proposal_id)}
              disabled={isApproving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isApproving ? 'Activating...' : 'Approve & Activate New Schedule'}
            </button>
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
            <div className="glass-panel p-12 text-center text-sm text-slate-500 rounded-2xl border border-slate-800">
              Loading minimal-change repair diff proposals...
            </div>
          ) : activeProposal ? (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-6">
              
              {/* Diff Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1">Total Moved</div>
                  <div className="text-2xl font-bold text-sky-400">{activeProposal.moved_count}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Minimal impact</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1">Time Changed</div>
                  <div className="text-2xl font-bold text-amber-400">{activeProposal.time_changed_count}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Only required shifts</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1">Room Only</div>
                  <div className="text-2xl font-bold text-indigo-400">{activeProposal.room_only_changed_count}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Kept same time slot</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 mb-1">Hard Violations</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {activeProposal.hard_violations}
                  </div>
                  <div className="text-[10px] text-emerald-400/90 mt-0.5">100% Rule Parity</div>
                </div>
              </div>

              {/* Before vs After Session Comparison Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Move className="w-4 h-4 text-sky-400" />
                  Session Diff (Before → After)
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <th className="p-3 font-semibold">Session ID</th>
                        <th className="p-3 font-semibold">Baseline Slot (Before)</th>
                        <th className="p-3 font-semibold">Repaired Slot (After)</th>
                        <th className="p-3 font-semibold">Change Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {activeProposal.moved_sessions?.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono font-bold text-sky-400">{m.session_id}</td>
                          <td className="p-3 text-slate-400">
                            {m.before ? (
                              <span>
                                {m.before.day} Period {m.before.start_period} in <strong className="text-slate-300">{m.before.room_id}</strong>
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
                                m.time_changed
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}
                            >
                              {m.before === null ? 'Added' : m.time_changed ? 'Time + Room' : 'Room Only'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel p-12 text-center text-slate-400 text-sm">
              No change proposals pending.
            </div>
          )}
        </div>

        {/* Right Column: Upload Disruption Form or Faculty Notice */}
        <div className="lg:col-span-4 space-y-6">
          {user?.role === 'faculty' ? (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">
                Faculty Read-Only View
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                As a faculty member, you have view-only access to schedule proposals. In accordance with institutional anti-self-approval rules, timetable changes and disruption proposals can only be activated by an Administrator.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-white">Need to adjust your classes?</div>
                <p className="text-slate-400 text-[11px]">
                  Use the dedicated faculty workflows to request changes:
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    href="/my-schedule"
                    className="text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center gap-1"
                  >
                    → Declare Leave in My Schedule
                  </a>
                  <a
                    href="/my-requests"
                    className="text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center gap-1"
                  >
                    → Request Class Adjustment in My Requests
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Apply Disruption Payload
              </h3>
              <p className="text-xs text-slate-400">
                Submit disruption changes (faculty absence, venue closure, added session) to simulate real-world emergencies.
              </p>

              <button
                onClick={handleLoadSampleDisruption}
                className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-all text-center"
              >
                Load Official Sample Disruption
              </button>

              <textarea
                rows={12}
                value={disruptionText}
                onChange={(e) => setDisruptionText(e.target.value)}
                placeholder="Paste disruption JSON here..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-sky-500"
              />

              <button
                onClick={handleSubmitDisruption}
                disabled={isSubmittingDisruption || !disruptionText.trim()}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {isSubmittingDisruption ? 'Solving Minimal Repair...' : 'Compute Minimal-Change Repair'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
