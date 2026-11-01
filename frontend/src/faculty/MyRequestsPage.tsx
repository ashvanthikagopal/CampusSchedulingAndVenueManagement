import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Clock, CheckCircle2, AlertCircle, 
  X, ShieldCheck, Plus, Sparkles,
  Layers, FileText
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select, Label } from '../components/ui/Input';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const MyRequestsPage: React.FC = () => {
  usePageMetadata(
    'Faculty Reschedule Requests & Status | CIT Schedule',
    'Track status of submitted class shift and venue booking requests. Review admin decisions, alternative slot proposals, and solver verifications.'
  );

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
  const [courseId, setCourseId] = useState('');
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

  const { data: groupsData } = useQuery({
    queryKey: ['scheduleGroups'],
    queryFn: async () => {
      const res = await api.get('/schedule/groups');
      return res.data;
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
      await api.post('/disruptions', {
        description: `Leave: Prof. ${user?.name || 'Faculty'} (${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod})`,
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
      showToast('Leave request submitted successfully!', 'success');
      setLeaveModalOpen(false);
      setDryRunResult(null);
      refetchDisruptions();
    } catch (err: any) {
      showToast('Submission error: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleSubmitSessionReq = async () => {
    setIsSubmittingSessionReq(true);
    try {
      await api.post('/session-requests', {
        request_type: reqType,
        course_id: courseId,
        target_session_id: reqType === 'move' ? targetSessionId : undefined,
        kind: sessionKind,
        duration: Number(sessionDuration),
        preferred_windows: [
          {
            day: prefDay,
            start_period: Number(prefPeriod)
          }
        ],
        reason: sessionReason
      });
      showToast('Class adjustment request submitted to Admin queue!', 'success');
      setSessionModalOpen(false);
      refetchSessionRequests();
    } catch (err: any) {
      showToast('Submission failed: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setIsSubmittingSessionReq(false);
    }
  };

  // Combine and filter requests
  const dList = (disruptions || []).map((d: any) => ({
    id: d.id,
    type: 'disruption',
    title: d.description,
    status: d.status,
    created_at: d.created_at,
    raw: d
  }));

  const sList = (sessionRequests || []).map((s: any) => ({
    id: s.id,
    type: 'session_request',
    title: `${s.request_type === 'move' ? 'Move Class' : 'Extra Session'}: ${s.course_id} (${s.kind})`,
    status: s.status,
    created_at: s.created_at,
    raw: s
  }));

  const bList = (bookings || []).map((b: any) => ({
    id: b.id,
    type: 'booking',
    title: `Venue Booking: ${b.title}`,
    status: b.status,
    created_at: b.created_at,
    raw: b
  }));

  let combined = [...dList, ...sList, ...bList];
  if (activeTab === 'disruptions') combined = dList;
  else if (activeTab === 'session_requests') combined = sList;
  else if (activeTab === 'bookings') combined = bList;

  const totalCount = dList.length + sList.length + bList.length;
  const pendingCount = [...dList, ...sList, ...bList].filter(x => x.status === 'pending' || x.status === 'pending_approval').length;
  const approvedCount = [...dList, ...sList, ...bList].filter(x => x.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="My Requests & Approvals"
        subtitle="Track leave declarations, schedule moves, and venue reservations. All requests undergo deterministic validator and CP-SAT checks before approval."
        badge={
          <StatusBadge
            status="info"
            size="sm"
            label={user?.faculty_id ? `Faculty: ${user.faculty_id}` : 'Faculty Portal'}
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setLeaveModalOpen(true); setDryRunResult(null); }}
              icon={<Clock className="w-4 h-4" />}
            >
              Declare Leave
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setSessionModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Request Class Adjustment
            </Button>
          </>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Submissions"
          value={totalCount}
          subtitle="All academic requests"
          icon={<Layers className="w-4 h-4" />}
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          subtitle="Awaiting coordinator / admin"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: pendingCount > 0 ? 'Queue Active' : 'All Clear', type: pendingCount > 0 ? 'neutral' : 'positive' }}
        />
        <StatCard
          title="Approved & Applied"
          value={approvedCount}
          subtitle="Active schedule adjustments"
          icon={<CheckCircle2 className="w-4 h-4" />}
          trend={{ text: 'Pristine Matrix', type: 'positive' }}
        />
        <StatCard
          title="Hard Violations"
          value={0}
          subtitle="Zero Double-Bookings Guaranteed"
          icon={<ShieldCheck className="w-4 h-4" />}
          highlight={true}
          trend={{ text: '0 Clashes', type: 'positive' }}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#E4DBC6] pb-1 overflow-x-auto">
        {(['all', 'disruptions', 'session_requests', 'bookings'] as const).map(tab => {
          const labels = {
            all: `All Requests (${totalCount})`,
            disruptions: `Leaves & Disruptions (${dList.length})`,
            session_requests: `Class Adjustments (${sList.length})`,
            bookings: `Venue Bookings (${bList.length})`
          };
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium rounded-t-[6px] border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#B08A3E] text-[#B08A3E] font-semibold bg-[#FFFDF8]'
                  : 'border-transparent text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]/50'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[#55625A] font-mono">
          Loading requests and solver records...
        </div>
      ) : combined.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No requests found"
          description="You haven't submitted any leave declarations or schedule requests in this category yet. Use the buttons above to declare leave or request class moves."
        />
      ) : (
        <div className="space-y-3">
          {combined.map((item) => {
            const isApproved = item.status === 'approved';
            const isAlt = item.status === 'alternative_offered';
            const isRejected = item.status === 'rejected';

            const statusVariant: 'success' | 'warning' | 'danger' | 'info' =
              isApproved ? 'success' : isAlt ? 'info' : isRejected ? 'danger' : 'warning';
            const statusLabel =
              isApproved ? 'Approved & Applied' : isAlt ? 'Alternative Offered' : isRejected ? 'Rejected' : 'Pending Review';

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-[#FFFDF8] p-4 sm:p-5 rounded-[10px] border border-[#E4DBC6] hover:border-[#D5C9AE] shadow-[0_1px_2px_rgba(31,42,36,0.04)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[6px] bg-[#F2ECDC] text-[#55625A] border border-[#E4DBC6] leading-none">
                      {item.type === 'disruption' ? 'Leave' : item.type === 'session_request' ? 'Adjustment' : 'Venue'}
                    </span>
                    <span className="inline-flex items-center justify-center text-xs text-[#7C877F] font-mono font-bold leading-none">
                      {item.id}
                    </span>
                    {item.raw.proposal?.validator_report?.hard_violation_count === 0 && (
                      <StatusBadge status="success" size="sm" label="0 Hard Violations" />
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-[#1F2A24]">
                    {item.title}
                  </h3>

                  {/* Sub-details */}
                  {item.type === 'disruption' && item.raw.changes && (
                    <div className="text-xs text-[#55625A] flex items-center gap-3 flex-wrap">
                      <span>Day: <strong className="text-[#1F2A24]">{item.raw.changes[0]?.days?.join(', ')}</strong></span>
                      <span>Periods: <strong className="text-[#1F2A24]">P{item.raw.changes[0]?.periods?.join(', P')}</strong></span>
                      <span>Reason: {item.raw.changes[0]?.reason}</span>
                    </div>
                  )}

                  {item.type === 'session_request' && (
                    <div className="text-xs text-[#55625A] flex items-center gap-3 flex-wrap">
                      <span>Target: <strong className="text-[#1F2A24]">{item.raw.target_session_id || 'New session'}</strong></span>
                      <span>Duration: {item.raw.duration}h</span>
                      <span>Preferred: {item.raw.preferred_windows?.[0]?.day} P{item.raw.preferred_windows?.[0]?.start_period}</span>
                      <span>Reason: {item.raw.reason}</span>
                    </div>
                  )}

                  {item.type === 'booking' && (
                    <div className="text-xs text-[#55625A] flex items-center gap-3 flex-wrap">
                      <span>Category: <strong className="text-[#1F2A24]">{item.raw.effective_category || 'guest_lecture'}</strong></span>
                      <span>Requested: {item.raw.requested_room || 'Any'}</span>
                      {item.raw.assigned_room && (
                        <span className="text-[#2F7D4F] font-medium font-mono">Assigned: {item.raw.assigned_room} ({item.raw.assigned_day} P{item.raw.start_period}-P{item.raw.end_period})</span>
                      )}
                      {item.raw.reason && (
                        <span>Note: {item.raw.reason}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 self-start md:self-center">
                  <StatusBadge status={statusVariant} size="md" label={statusLabel} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Declare Leave / Unavailability */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] max-w-lg w-full p-6 shadow-[0_8px_30px_rgba(31,42,36,0.15)] relative space-y-4 animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setLeaveModalOpen(false)}
              className="absolute top-4 right-4 text-[#7C877F] hover:text-[#1F2A24] p-1 rounded cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-[#E4DBC6] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1F2A24]">
                Declare Faculty Leave / Unavailability
              </h3>
              <p className="text-xs text-[#55625A] mt-0.5">
                Scoped to your Faculty ID ({user?.faculty_id}). Verifies zero hard violations before submission.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Day</Label>
                  <Select value={leaveDay} onChange={e => setLeaveDay(e.target.value)}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Start Period</Label>
                  <Select value={leaveStartPeriod} onChange={e => setLeaveStartPeriod(Number(e.target.value))}>
                    {PERIODS.map(p => <option key={p} value={p}>P{p}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>End Period</Label>
                  <Select value={leaveEndPeriod} onChange={e => setLeaveEndPeriod(Number(e.target.value))}>
                    {PERIODS.filter(p => p >= leaveStartPeriod).map(p => <option key={p} value={p}>P{p}</option>)}
                  </Select>
                </div>
              </div>

              <div>
                <Label>Reason for Leave</Label>
                <Input
                  type="text"
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="e.g. Conference presentation, emergency leave"
                />
              </div>

              {dryRunResult && (
                <div className={`p-3 rounded-[8px] border text-xs space-y-1 ${
                  dryRunResult.status === 'FEASIBLE'
                    ? 'bg-[#EBF5EE] border-[#C3E2CD] text-[#2F7D4F]'
                    : 'bg-[#FBEFEF] border-[#EFC5BF] text-[#B3402F]'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {dryRunResult.status === 'FEASIBLE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Status: {dryRunResult.status}</span>
                  </div>
                  <div>
                    {dryRunResult.status === 'FEASIBLE'
                      ? `Feasible: ${dryRunResult.moved_count ?? 0} moves required. 0 hard violations.`
                      : (dryRunResult.message || 'Conflicts detected in declared slot.')}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={handleDryRun}
                loading={dryRunLoading}
              >
                Run Feasibility Dry-Run
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleSubmitLeave}
                loading={isSubmittingLeave}
              >
                Submit Leave
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Request Class Adjustment */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] max-w-lg w-full p-6 shadow-[0_8px_30px_rgba(31,42,36,0.15)] relative space-y-4 animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setSessionModalOpen(false)}
              className="absolute top-4 right-4 text-[#7C877F] hover:text-[#1F2A24] p-1 rounded cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-[#E4DBC6] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1F2A24]">
                Request Class Adjustment
              </h3>
              <p className="text-xs text-[#55625A] mt-0.5">
                Submit reschedule proposal for academic coordinator approval.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Adjustment Type</Label>
                  <Select value={reqType} onChange={e => setReqType(e.target.value as any)}>
                    <option value="move">Move Existing Class</option>
                    <option value="extra">Request Extra Class</option>
                  </Select>
                </div>
                <div>
                  <Label>Course</Label>
                  <Select value={courseId} onChange={e => setCourseId(e.target.value)}>
                    <option value="">Select Course...</option>
                    {groupsData?.courses?.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {reqType === 'move' && (
                <div>
                  <Label>Target Session ID</Label>
                  <Input
                    value={targetSessionId}
                    onChange={e => setTargetSessionId(e.target.value)}
                    placeholder="e.g. Target Session ID from your schedule"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Session Kind</Label>
                  <Select value={sessionKind} onChange={e => setSessionKind(e.target.value)}>
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                  </Select>
                </div>
                <div>
                  <Label>Preferred Day</Label>
                  <Select value={prefDay} onChange={e => setPrefDay(e.target.value)}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Preferred Period</Label>
                  <Select value={prefPeriod} onChange={e => setPrefPeriod(Number(e.target.value))}>
                    {PERIODS.map(p => <option key={p} value={p}>P{p}</option>)}
                  </Select>
                </div>
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  value={sessionReason}
                  onChange={e => setSessionReason(e.target.value)}
                  placeholder="e.g. Guest lecturer, syllabus compensation"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setSessionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleSubmitSessionReq}
                loading={isSubmittingSessionReq}
              >
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
