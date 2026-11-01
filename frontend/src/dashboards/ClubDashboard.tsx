import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, ShieldCheck, CheckCircle2,
  AlertTriangle, ArrowRight, PlusCircle, Sparkles,
  Users, Check, X, Award, RotateCcw
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export const ClubDashboard: React.FC = () => {
  const { user } = useAuth();
  const clubName = user?.club_name || user?.name || 'Student Club';

  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/bookings/mine');
      setMyBookings(res.data || []);
    } catch (err: any) {
      console.error('Failed to load club bookings:', err);
      setErrorMsg('Failed to load club booking requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clubName]);

  const handleCancelBooking = async (reqId: string) => {
    if (!window.confirm(`Are you sure you want to cancel booking request ${reqId}?`)) return;
    setErrorMsg(null);
    try {
      await api.post(`/bookings/${reqId}/cancel`);
      setSuccessMsg(`Booking request ${reqId} cancelled successfully.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to cancel booking request.');
    }
  };

  const approvedCount = myBookings.filter((b) => b.status === 'approved').length;
  const pendingCount = myBookings.filter((b) => b.status === 'pending').length;
  const altCount = myBookings.filter((b) => b.status === 'alternative_offered').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${clubName} · Venue Booking Portal`}
        subtitle={`Official club representative portal. Submit Spectra Week event requests via standard form or plain language, view solver decisions, and manage venue allocations.`}
        badge={
          <StatusBadge
            status="info"
            size="sm"
            label={`${clubName} Identity`}
            icon={<Award className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/timetable">
              <Button
                variant="secondary"
                size="md"
                icon={<Calendar className="w-4 h-4 text-[#B08A3E]" />}
              >
                View Venue Availability
              </Button>
            </Link>
            <Link to="/bookings">
              <Button
                variant="evergreen"
                size="md"
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Submit Venue Request
              </Button>
            </Link>
          </div>
        }
      />

      {successMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#FAF6EC] border border-[#B08A3E]/40 text-[#9A7633] text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2F7D4F]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#FDF5E6] border border-[#EBD19E] text-[#B7791F] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Club Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Club Requests"
          value={myBookings.length}
          subtitle="Submitted for Spectra Week"
          icon={<Calendar className="w-4 h-4" />}
          trend={{ text: 'Tracked in Ledger', type: 'positive' }}
        />
        <StatCard
          title="Approved Venues"
          value={approvedCount}
          subtitle="Allocated with 0 Inversions"
          highlight={true}
          icon={<CheckCircle2 className="w-4 h-4" />}
          trend={{ text: 'Confirmed', type: 'positive' }}
        />
        <StatCard
          title="Alternatives Offered"
          value={altCount}
          subtitle="Best Available Conflict-Free Slot"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: altCount > 0 ? 'Review Alternative' : 'None', type: 'neutral' }}
        />
        <StatCard
          title="Pending Requests"
          value={pendingCount}
          subtitle="Can be cancelled while pending"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: pendingCount > 0 ? 'Under Review' : 'Queue Clear', type: 'neutral' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: My Club Bookings History */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-[#1F2A24] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#B08A3E]" />
              <span>{clubName} Venue Bookings History</span>
            </h2>
            <Link
              to="/bookings"
              className="text-xs text-[#B08A3E] hover:text-[#9A7633] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>New Request</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {myBookings.length === 0 ? (
              <Panel variant="sunken" className="p-8 text-center space-y-3">
                <p className="text-xs text-[#55625A]">
                  No venue booking requests submitted yet for {clubName}.
                </p>
                <Link to="/bookings">
                  <Button variant="evergreen" size="sm" icon={<PlusCircle className="w-4 h-4" />}>
                    Submit Your First Venue Request
                  </Button>
                </Link>
              </Panel>
            ) : (
              myBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#FFFDF8] p-4 rounded-[10px] border border-[#E4DBC6] shadow-[0_1px_2px_rgba(31,42,36,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-[#B08A3E] bg-[#FAF6EC] px-2.5 py-1 rounded-[6px] border border-[#B08A3E]/30 leading-none">
                        {b.id}
                      </span>
                      <span className="font-semibold text-sm text-[#1F2A24]">{b.title}</span>
                      <StatusBadge
                        status={
                          b.status === 'approved'
                            ? 'success'
                            : b.status === 'alternative_offered'
                            ? 'warning'
                            : b.status === 'rejected'
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                        label={b.status ? b.status.replace('_', ' ') : 'Pending'}
                      />
                    </div>
                    <div className="text-xs text-[#55625A]">
                      Attendance: {b.attendance} · Duration: {b.duration_periods}h · Category: {b.requested_category || 'club_event'}
                    </div>
                    <div className="text-xs text-[#55625A]">
                      {b.assigned_room ? (
                        <span className="text-[#12372A] font-semibold">
                          Assigned: {b.assigned_room} ({b.assigned_day} P{b.start_period}-P{b.end_period})
                        </span>
                      ) : (
                        <span className="text-[#7C877F]">Requested: {b.requested_room || 'Any suitable venue'}</span>
                      )}
                    </div>
                    {b.reason && (
                      <div className="text-xs text-[#55625A] italic">
                        Decision Rationale: "{b.reason}"
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {b.status === 'pending' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCancelBooking(b.id)}
                        icon={<RotateCcw className="w-3.5 h-3.5 text-[#A84B2C]" />}
                      >
                        Cancel Request
                      </Button>
                    )}
                    {b.status === 'alternative_offered' && (
                      <span className="text-[11px] font-mono text-[#B08A3E] bg-[#FAF6EC] px-2 py-1 rounded border border-[#B08A3E]/30">
                        Alternative Proposed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Submission Guide & Policy */}
        <div className="lg:col-span-4 space-y-4">
          <Panel variant="default" className="space-y-3.5">
            <h3 className="font-serif font-bold text-sm text-[#1F2A24] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B08A3E]" />
              <span>How Booking Works</span>
            </h3>
            <ul className="space-y-2 text-xs text-[#55625A]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F] shrink-0 mt-0.5" />
                <span>Submit standard form or plain English/Hinglish text.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F] shrink-0 mt-0.5" />
                <span>Review extracted details before confirming submission.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F] shrink-0 mt-0.5" />
                <span>Integer CP-SAT solver allocates venues strictly by priority.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F] shrink-0 mt-0.5" />
                <span>You can cancel your own requests while pending.</span>
              </li>
            </ul>
            <div className="pt-2">
              <Link to="/bookings">
                <Button variant="evergreen" size="sm" className="w-full">
                  Create New Booking
                </Button>
              </Link>
            </div>
          </Panel>

          <Panel variant="sunken" className="p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#B7791F] font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Priority & Role Ceiling Policy</span>
            </div>
            <p className="text-[#55625A] leading-relaxed text-[11px]">
              Club bookings are classified as <code>club_event</code> (Rank 6 in priority). The solver mathematically guarantees 0 priority inversions across all 25 campus requests.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
};
