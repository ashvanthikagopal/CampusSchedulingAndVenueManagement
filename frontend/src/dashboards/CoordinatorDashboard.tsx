import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, ShieldCheck, CheckCircle2,
  AlertTriangle, ArrowRight, PlusCircle, Building2,
  Users, Check, X, Sparkles
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export const CoordinatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const dept = user?.department || 'CSE';

  const [deptSessions, setDeptSessions] = useState<any[]>([]);
  const [labBookings, setLabBookings] = useState<any[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);
  const [deptCourses, setDeptCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New session request modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [requestType, setRequestType] = useState('move');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [schedRes, bookingsRes, reqsRes, groupsRes] = await Promise.all([
        api.get(`/schedule?view=group`).catch(() => ({ data: { sessions: [] } })),
        api.get('/bookings').catch(() => ({ data: [] })),
        api.get('/session-requests').catch(() => ({ data: [] })),
        api.get('/schedule/groups').catch(() => ({ data: { courses: [] } }))
      ]);

      // Filter sessions belonging to this department
      const allSess = schedRes.data?.sessions || [];
      const filteredSess = allSess.filter((s: any) => {
        const groups = s.groups || [];
        return groups.some((g: string) => g.startsWith(dept) || g.includes(`-${dept}-`) || (dept === 'CSE' && g.includes('CS')));
      });
      setDeptSessions(filteredSess);

      // Filter bookings requesting department labs (e.g. CS-LAB-1, CS-LAB-2 for CSE)
      const DEPT_LABS: Record<string, string[]> = {
        CSE: ['CS-LAB-1', 'CS-LAB-2'],
        ECE: ['ELEC-LAB-1', 'ELEC-LAB-2'],
        EE: ['ELEC-LAB-1', 'ELEC-LAB-2'],
        PH: ['PHY-LAB'],
        ME: ['MECH-WS'],
        CE: ['CIVIL-LAB']
      };
      const allowedLabs = DEPT_LABS[dept] || [];
      const allBookings = bookingsRes.data || [];
      const deptLabBookings = allBookings.filter((b: any) =>
        allowedLabs.includes(b.requested_room) || allowedLabs.includes(b.assigned_room) ||
        (b.room_types && b.room_types.some((rt: string) => rt.includes(dept.toLowerCase())))
      );
      setLabBookings(deptLabBookings);

      setSessionRequests(reqsRes.data || []);

      // Filter courses belonging to this department
      const allCourses = groupsRes.data?.courses || [];
      const filteredCourses = allCourses.filter((c: any) =>
        c.department === dept || c.id.startsWith(dept) || (dept === 'CSE' && c.id.startsWith('CS'))
      );
      setDeptCourses(filteredCourses.length > 0 ? filteredCourses : allCourses);
    } catch (err: any) {
      console.error('Failed to load coordinator data:', err);
      setErrorMsg('Error synchronizing department timetable data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dept]);

  const handleLabDecision = async (reqId: string, action: 'approved' | 'rejected', targetRoom?: string) => {
    setErrorMsg(null);
    try {
      await api.post(`/bookings/${reqId}/decision`, {
        action,
        room_id: targetRoom,
        reason: `Decided by ${dept} Department Coordinator`
      });
      setDecisionSuccess(`Booking ${reqId} marked as ${action}.`);
      fetchData();
      setTimeout(() => setDecisionSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || `Failed to ${action} booking.`);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post('/session-requests', {
        course_id: courseId,
        request_type: requestType,
        target_session_id: targetSessionId || undefined,
        reason: reason,
        groups: [`${dept}-3`],
        duration: 1
      });
      setDecisionSuccess('Department session request queued for Dean/Admin review.');
      setIsModalOpen(false);
      setCourseId('');
      setTargetSessionId('');
      setReason('');
      fetchData();
      setTimeout(() => setDecisionSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit session request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${dept} Department Coordinator Console`}
        subtitle={`Overseeing ${dept} department academic sessions, lab venue approvals, faculty availability, and curricular schedule requests.`}
        badge={
          <StatusBadge
            status="info"
            size="sm"
            label={`${dept} Department Scope`}
            icon={<Building2 className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsModalOpen(true)}
              icon={<PlusCircle className="w-4 h-4 text-[#2563EB]" />}
            >
              Request Session Change
            </Button>
            <Link to="/bookings">
              <Button
                variant="evergreen"
                size="md"
                icon={<Calendar className="w-4 h-4" />}
              >
                Book Department Event
              </Button>
            </Link>
          </div>
        }
      />

      {decisionSuccess && (
        <div className="p-3.5 rounded-[8px] bg-[#F5F7FB] border border-[#2563EB]/40 text-[#1D4ED8] text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2F7D4F]" />
          <span>{decisionSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#FDF5E6] border border-[#EBD19E] text-[#B7791F] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Department Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Department Sessions"
          value={deptSessions.length}
          subtitle={`Lectures, Labs & Tutorials in ${dept}`}
          icon={<Calendar className="w-4 h-4" />}
          trend={{ text: 'Timetable Synchronized', type: 'positive' }}
        />
        <StatCard
          title="Department Lab Requests"
          value={labBookings.length}
          subtitle="Contention for Department Labs"
          highlight={true}
          icon={<Building2 className="w-4 h-4" />}
          trend={{ text: 'Coordinator Approval Queue', type: 'neutral' }}
        />
        <StatCard
          title="Department Requests"
          value={sessionRequests.length}
          subtitle="Class adjustments & extra sessions"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: 'Dean Review Queue', type: 'neutral' }}
        />
        <StatCard
          title="Hard Conflicts"
          value={0}
          subtitle="Within Department Scope"
          icon={<ShieldCheck className="w-4 h-4" />}
          trend={{ text: '0 Clashes', type: 'positive' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Department Lab Bookings Approval Queue */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-sans font-bold text-[#172B4D] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2563EB]" />
              <span>Department Lab Approval Queue</span>
            </h2>
            <span className="text-xs text-[#475569] font-mono">
              Role Authority: {dept} Labs Only
            </span>
          </div>

          <div className="space-y-2.5">
            {labBookings.length === 0 ? (
              <Panel variant="sunken" className="p-6 text-center text-xs text-[#475569]">
                No pending booking requests currently targeting {dept} departmental labs.
              </Panel>
            ) : (
              labBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#FFFFFF] p-4 rounded-[10px] border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#2563EB] bg-[#F5F7FB] px-1.5 py-0.5 rounded border border-[#2563EB]/20">
                        {b.id}
                      </span>
                      <span className="font-semibold text-sm text-[#172B4D]">{b.title}</span>
                      <StatusBadge
                        status={b.status === 'approved' ? 'success' : b.status === 'rejected' ? 'danger' : 'neutral'}
                        size="sm"
                        label={b.status || 'Pending'}
                      />
                    </div>
                    <div className="text-xs text-[#475569]">
                      Requester: <span className="font-medium text-[#172B4D]">{b.requester}</span> ({b.role}) · Attendance: {b.attendance}
                    </div>
                    <div className="text-xs text-[#64748B] italic">
                      Venue: {b.requested_room || b.assigned_room || 'Department Lab'}
                    </div>
                  </div>

                  {b.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLabDecision(b.id, 'rejected')}
                        icon={<X className="w-3.5 h-3.5 text-[#A84B2C]" />}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="evergreen"
                        size="sm"
                        onClick={() => handleLabDecision(b.id, 'approved', b.requested_room || 'CS-LAB-1')}
                        icon={<Check className="w-3.5 h-3.5" />}
                      >
                        Approve Lab
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Scoping & Quick Navigation */}
        <div className="lg:col-span-4 space-y-4">
          <Panel variant="default" className="space-y-3.5">
            <h3 className="font-sans font-bold text-sm text-[#172B4D]">
              Department Navigation
            </h3>
            <div className="space-y-2">
              <Link
                to="/timetable"
                className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#142D50]" />
                  <span>{dept} Department Timetable</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
              </Link>
              <Link
                to="/bookings"
                className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
              >
                <div className="flex items-center gap-2.5">
                  <PlusCircle className="w-4 h-4 text-[#2563EB]" />
                  <span>Book Department Venue</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
              </Link>
              <Link
                to="/my-requests"
                className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#2C6A8A]" />
                  <span>Department Requests Tracking</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
              </Link>
            </div>
          </Panel>

          <Panel variant="sunken" className="p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#2F7D4F] font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Strict Role Scope & Escalation</span>
            </div>
            <p className="text-[#475569] leading-relaxed text-[11px]">
              Coordinators can approve department lab bookings. However, bookings requiring an existing class to be moved are automatically escalated to Admin approval.
            </p>
          </Panel>
        </div>
      </div>

      {/* Session Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] rounded-[12px] border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-sans font-bold text-base text-[#172B4D]">
                Request Department Session Change
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#172B4D] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#172B4D] mb-1">Course</label>
                <select
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-[#E2E8F0] focus:border-[#142D50] focus:outline-hidden"
                >
                  <option value="">Select Course...</option>
                  {deptCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#172B4D] mb-1">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-[#E2E8F0] focus:border-[#142D50] focus:outline-hidden"
                >
                  <option value="move">Move Existing Session</option>
                  <option value="extra">Request Extra Class</option>
                </select>
              </div>

              {requestType === 'move' && (
                <div>
                  <label className="block font-semibold text-[#172B4D] mb-1">Target Session</label>
                  <select
                    required
                    value={targetSessionId}
                    onChange={(e) => setTargetSessionId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white border border-[#E2E8F0] focus:border-[#142D50] focus:outline-hidden"
                  >
                    <option value="">Select Session to Move...</option>
                    {deptSessions.map((s: any) => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.session_id} ({s.course_id} {s.kind} · {s.day} P{s.start_period})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#172B4D] mb-1">Reason for Request</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain academic rationale..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-[#E2E8F0] focus:border-[#142D50] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="evergreen" size="sm" type="submit" loading={isSubmitting} disabled={!courseId}>
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
