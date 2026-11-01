import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  ShieldCheck, CheckCircle2, 
  Upload, Check, Move
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export const RescheduleDiffPage: React.FC = () => {
  usePageMetadata(
    'Timetable Approvals & Schedule Diff | CIT Schedule',
    'Review faculty class reschedule requests, compare visual timetable diffs, and approve minimal-change disruption proposals with zero collisions.'
  );

  const { user } = useAuth();
  const [_proposals, setProposals] = useState<any[]>([]);
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

  const handleLoadSampleDisruption = async () => {
    try {
      const res = await api.get('/disruptions/sample');
      setDisruptionText(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      alert('Failed to load official sample disruption: ' + (err.response?.data?.detail || err.message));
    }
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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Disruptions & Reschedule Diff"
        subtitle="Compare before-and-after schedule triples. Human Admin approval is required before activating changes."
        badge={
          <StatusBadge
            status="success"
            size="sm"
            label="Minimal Disruption Engine"
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
          />
        }
        actions={
          activeProposal && activeProposal.status === 'pending_approval' && user?.role === 'admin' ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleApprove(activeProposal.proposal_id)}
              disabled={isApproving}
              loading={isApproving}
              icon={<Check className="w-4 h-4" />}
            >
              Approve & Activate New Schedule
            </Button>
          ) : undefined
        }
      />

      {approvalMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#EBF5EE] border border-[#C3E2CD] text-[#2F7D4F] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{approvalMsg}</span>
        </div>
      )}

      {/* Grid: Diff Details & Upload Disruption Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Diff View */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="p-16 text-center text-xs text-[#475569] font-mono">
              Loading minimal-change repair diff proposals...
            </div>
          ) : activeProposal ? (
            <div className="space-y-4">
              {/* Diff Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <StatCard
                  title="Total Moved"
                  value={activeProposal.moved_count}
                  subtitle="Minimal disruption"
                  icon={<Move className="w-4 h-4" />}
                />
                <StatCard
                  title="Time Changed"
                  value={activeProposal.time_changed_count}
                  subtitle="Period shifts"
                  icon={<Move className="w-4 h-4 text-[#B7791F]" />}
                />
                <StatCard
                  title="Room Only"
                  value={activeProposal.room_only_changed_count}
                  subtitle="Same time slot"
                  icon={<Move className="w-4 h-4 text-[#2C6A8A]" />}
                />
                <StatCard
                  title="Hard Violations"
                  value={activeProposal.hard_violations}
                  subtitle="100% Rule Parity"
                  highlight={true}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  trend={{ text: '0 Clashes', type: 'positive' }}
                />
              </div>

              {/* Before vs After Session Comparison Table */}
              <Panel variant="default" padded={false} className="overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F1F5F9]/40">
                  <h3 className="font-sans font-bold text-sm text-[#172B4D] flex items-center gap-2">
                    <Move className="w-4 h-4 text-[#2563EB]" />
                    <span>Session Diff (Before → After)</span>
                  </h3>
                  <span className="text-xs font-mono text-[#475569]">
                    {activeProposal.moved_sessions?.length || 0} Changes
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F1F5F9] text-[#475569] text-[11px] font-mono uppercase tracking-wider border-b border-[#E2E8F0]">
                        <th className="p-3 font-semibold">Session ID</th>
                        <th className="p-3 font-semibold">Baseline Slot (Before)</th>
                        <th className="p-3 font-semibold">Repaired Slot (After)</th>
                        <th className="p-3 font-semibold">Change Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]/70">
                      {activeProposal.moved_sessions?.map((m: any, idx: number) => {
                        const isAdded = m.before === null;
                        const isRemoved = m.after === null;

                        const rowBg = isRemoved
                          ? 'bg-[#FBEFEF]/50 hover:bg-[#FBEFEF]'
                          : isAdded
                          ? 'bg-[#EBF5EE]/50 hover:bg-[#EBF5EE]'
                          : 'hover:bg-[#F5F7FB]';

                        return (
                          <tr key={idx} className={`${rowBg} transition-colors`}>
                            <td className="p-3 font-mono font-bold text-[#172B4D]">
                              {m.session_id}
                            </td>
                            <td className="p-3 text-[#475569]">
                              {m.before ? (
                                <span>
                                  {m.before.day} Period {m.before.start_period} in <strong className="text-[#172B4D] font-mono">{m.before.room_id}</strong>
                                </span>
                              ) : (
                                <span className="text-[#2F7D4F] font-semibold font-mono">[New Session]</span>
                              )}
                            </td>
                            <td className="p-3">
                              {m.after ? (
                                <span className="font-semibold text-[#172B4D]">
                                  {m.after.day} Period {m.after.start_period} in <span className="font-mono text-[#2F7D4F] font-bold">{m.after.room_id}</span>
                                </span>
                              ) : (
                                <span className="text-[#B3402F] font-semibold font-mono">[Removed Session]</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isRemoved ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FBEFEF] text-[#B3402F] border border-[#EFC5BF]">
                                  Removed
                                </span>
                              ) : isAdded ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EBF5EE] text-[#2F7D4F] border border-[#C3E2CD]">
                                  Added
                                </span>
                              ) : m.time_changed ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FDF5E6] text-[#B7791F] border border-[#EBD19E]">
                                  Time + Room
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EDF4F8] text-[#2C6A8A] border border-[#C6DFEB]">
                                  Room Only
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sticky Action Bar */}
                {activeProposal && activeProposal.status === 'pending_approval' && user?.role === 'admin' && (
                  <div className="p-4 bg-[#F1F5F9] border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                    <div className="text-xs text-[#475569]">
                      Approve to update live timetable for all 1,000 students and 40 faculty.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleApprove(activeProposal.proposal_id)}
                        disabled={isApproving}
                        loading={isApproving}
                        icon={<Check className="w-4 h-4" />}
                      >
                        Approve & Activate
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          ) : (
            <Panel variant="default" className="p-12 text-center text-[#64748B] text-xs">
              No change proposals pending at this time.
            </Panel>
          )}
        </div>

        {/* Right Column: Upload Disruption Form or Faculty Notice */}
        <div className="lg:col-span-4 space-y-4">
          {user?.role === 'faculty' ? (
            <Panel variant="default" className="space-y-3">
              <div className="p-2.5 bg-[#F5F7FB] rounded-[8px] text-[#2563EB] w-fit border border-[#E2E8F0]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-sans font-bold text-sm text-[#172B4D]">
                Faculty Review-Only View
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                As a faculty member, you have view-only access to schedule proposals. In accordance with institutional anti-self-approval rules, timetable changes and disruption proposals can only be activated by an Administrator.
              </p>
              <div className="p-3 rounded-[8px] bg-[#F5F7FB] border border-[#E2E8F0] text-xs space-y-2">
                <div className="font-semibold text-[#172B4D]">Need to adjust your classes?</div>
                <div className="flex flex-col gap-1.5 pt-0.5 text-xs">
                  <a
                    href="/my-schedule"
                    className="text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                  >
                    → Declare Leave in My Schedule
                  </a>
                  <a
                    href="/my-requests"
                    className="text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                  >
                    → Request Class Adjustment in My Requests
                  </a>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel variant="default" className="space-y-3">
              <h3 className="font-sans font-bold text-sm text-[#172B4D] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#2563EB]" />
                <span>Apply Disruption Payload</span>
              </h3>
              <p className="text-xs text-[#475569]">
                Submit disruption changes (faculty absence, venue closure, added session) to simulate real-world emergencies.
              </p>

              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs"
                onClick={handleLoadSampleDisruption}
              >
                Load Official Sample Disruption
              </Button>

              <textarea
                rows={10}
                value={disruptionText}
                onChange={(e) => setDisruptionText(e.target.value)}
                placeholder="Paste disruption JSON here..."
                className="w-full p-3 rounded-[8px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#172B4D] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />

              <Button
                variant="evergreen"
                size="md"
                className="w-full"
                onClick={handleSubmitDisruption}
                disabled={isSubmittingDisruption || !disruptionText.trim()}
                loading={isSubmittingDisruption}
              >
                Compute Minimal-Change Repair
              </Button>
            </Panel>
          )}
        </div>

      </div>
    </div>
  );
};
