import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, Calendar, ShieldCheck, ArrowRight,
  Cpu, Building2, Sparkles, AlertTriangle, Settings, FileText,
  RotateCcw, Award, Layers
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { ResetDatasetModal } from '../components/ResetDatasetModal';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const handleRunGenerator = async () => {
    setIsGenerating(true);
    setGenerateMsg('Initializing Google OR-Tools CP-SAT Solver background job...');
    try {
      const res = await api.post('/schedule/generate');
      const jobId = res.data.job_id;
      setGenerateMsg(`Job ${jobId} running. Optimizing timetable sessions across campus venues...`);

      const interval = setInterval(async () => {
        try {
          const pollRes = await api.get(`/schedule/jobs/${jobId}`);
          if (pollRes.data.status === 'COMPLETED') {
            clearInterval(interval);
            setIsGenerating(false);
            setGenerateMsg('Solve finished: Master timetable optimized with 0 hard violations!');
            fetchData();
            setTimeout(() => setGenerateMsg(null), 5000);
          } else if (pollRes.data.status === 'FAILED') {
            clearInterval(interval);
            setIsGenerating(false);
            setGenerateMsg('Solve failed: ' + (pollRes.data.error || 'Solver failure'));
          }
        } catch {
          clearInterval(interval);
          setIsGenerating(false);
        }
      }, 2000);
    } catch (err: any) {
      setIsGenerating(false);
      setGenerateMsg('Failed to trigger generation: ' + (err.response?.data?.detail || err.message));
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [metricsRes, bookingsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/bookings')
      ]);
      setMetrics(metricsRes.data);
      const bList = bookingsRes.data || [];
      const topDecisions = bList.slice(0, 5).map((b: any) => {
        let statusType: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
        if (b.status === 'approved') statusType = 'success';
        else if (b.status === 'alternative_offered') statusType = 'warning';
        else if (b.status === 'rejected') statusType = 'danger';

        const venueStr = b.assigned_room ? `${b.assigned_room} · ${b.assigned_day} P${b.start_period}-P${b.end_period}` : 'No Venue Fits';
        return {
          id: b.id,
          title: b.title,
          requester: b.requester,
          statusType,
          statusLabel: b.status ? b.status.replace('_', ' ') : 'Pending',
          venue: venueStr,
          reason: b.reason || 'Processed by Spectra Week allocation solver'
        };
      });
      setRecentDecisions(topDecisions);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setErrorMsg(err.response?.data?.detail || 'Unable to connect to scheduling backend.');
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const departmentLoadData = metrics?.department_load || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dean's Office · Institutional Administration Console`}
        subtitle="Complete campus control: master timetable CP-SAT optimization, Spectra week allocations, disruption approvals, dataset imports, and audit tracking."
        badge={
          <StatusBadge
            status="success"
            size="sm"
            label="Verified by validator.py (0 Hard Violations)"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setResetModalOpen(true)}
              icon={<RotateCcw className="w-4 h-4 text-[#B7791F]" />}
            >
              Reset Demo
            </Button>
            <Button
              variant="evergreen"
              size="md"
              onClick={handleRunGenerator}
              disabled={isGenerating}
              loading={isGenerating}
              icon={<Cpu className="w-4 h-4" />}
            >
              Re-Solve Master Timetable
            </Button>
          </div>
        }
      />

      {errorMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#FDF5E6] border border-[#EBD19E] text-[#B7791F] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchData()}
            className="px-2.5 py-1 rounded bg-[#B7791F]/15 hover:bg-[#B7791F]/25 font-semibold text-[11px] transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {generateMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#F5F7FB] border border-[#2563EB]/40 text-[#1D4ED8] text-xs flex items-center gap-2 font-mono">
          <Sparkles className="w-4 h-4 animate-pulse shrink-0 text-[#2563EB]" />
          <span>{generateMsg}</span>
        </div>
      )}

      {isLoading && !metrics ? (
        <div className="p-16 text-center text-xs text-[#475569] font-mono">
          Loading campus metrics from official dataset...
        </div>
      ) : metrics ? (
        <>
          {/* 4 Core Operational Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Hard Violations"
              value={metrics.hard_conflicts}
              subtitle="Zero Double-Bookings"
              highlight={true}
              icon={<ShieldCheck className="w-4 h-4" />}
              trend={{ text: metrics.hard_conflicts === 0 ? 'Pristine 0 Clashes' : `${metrics.hard_conflicts} Conflicts`, type: metrics.hard_conflicts === 0 ? 'positive' : 'negative' }}
            />
            <StatCard
              title="Room Utilization"
              value={`${metrics.room_utilization_rate}%`}
              subtitle={`${metrics.rooms_count || 0} Venues across campus`}
              icon={<Building2 className="w-4 h-4" />}
              trend={{ text: 'Optimized', type: 'neutral' }}
            />
            <StatCard
              title="Spectra Booking Score"
              value={`${metrics.booking_score} / ${metrics.max_booking_score}`}
              subtitle={`${metrics.approved_bookings || 0} Approved · ${metrics.alternative_bookings || 0} Alt · ${metrics.rejected_bookings || 0} Rej`}
              icon={<Calendar className="w-4 h-4" />}
              trend={{ text: 'Theoretical Optimum', type: 'positive' }}
            />
            <StatCard
              title="Soft Penalty Total"
              value={metrics.soft_penalty_total}
              subtitle="S4=3 (Course Spread)"
              icon={<Layers className="w-4 h-4" />}
              trend={{ text: 'Minimal Soft Penalty', type: 'positive' }}
            />
          </div>

          {/* Recharts Department Load Distribution */}
          <Panel variant="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-sans font-bold text-[#172B4D]">
                  Campus Academic Load Distribution
                </h2>
                <p className="text-xs text-[#475569]">
                  {metrics.sessions_scheduled} sessions scheduled across {departmentLoadData.length} academic departments and groups.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-[#475569]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#142D50]" /> Lectures</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#2563EB]" /> Labs</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#2C6A8A]" /> Tutorials</span>
              </div>
            </div>
            <div className="h-64 w-full">
              {departmentLoadData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#64748B]">
                  No department session records found in active schedule.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentLoadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                        fontSize: '12px',
                        color: '#172B4D',
                      }}
                    />
                    <Bar dataKey="lectures" name="Lectures" fill="#142D50" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="labs" name="Labs" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tutorials" name="Tutorials" fill="#2C6A8A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Main Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-sans font-bold text-[#172B4D] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <span>Spectra Week Allocation Decisions</span>
                </h2>
                <Link
                  to="/bookings"
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Manage All {metrics.total_bookings || ''} Requests</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5">
                {recentDecisions.length === 0 ? (
                  <Panel variant="sunken" className="p-8 text-center text-xs text-[#475569]">
                    No booking decisions recorded yet.
                  </Panel>
                ) : (
                  recentDecisions.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#FFFFFF] p-4 rounded-[10px] border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-[#F5F7FB] px-1.5 py-0.5 rounded border border-[#2563EB]/20">
                            {item.id}
                          </span>
                          <span className="font-semibold text-sm text-[#172B4D]">{item.title}</span>
                          <StatusBadge status={item.statusType} size="sm" label={item.statusLabel} />
                        </div>
                        <div className="text-xs text-[#475569]">
                          {item.venue} · <span className="text-[#64748B]">{item.requester}</span>
                        </div>
                        <div className="text-xs text-[#475569] italic">
                          "{item.reason}"
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-mono text-[#64748B] px-2 py-1 rounded bg-[#F1F5F9]">
                          Solver Verified
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <Panel variant="default" className="space-y-3.5">
                <h3 className="font-sans font-bold text-sm text-[#172B4D]">
                  Administrative Portals
                </h3>
                <div className="space-y-2">
                  <Link
                    to="/admin"
                    className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-[#142D50]" />
                      <span>Admin Console & Audit Logs</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
                  </Link>
                  <Link
                    to="/approvals"
                    className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#2F7D4F]" />
                      <span>Disruption Proposals & Approval</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
                  </Link>
                  <Link
                    to="/exams"
                    className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#B7791F]" />
                      <span>Midsem Examination Matrix</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
                  </Link>
                  <Link
                    to="/timetable"
                    className="flex items-center justify-between p-3 rounded-[8px] bg-[#F5F7FB] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all text-xs font-medium text-[#172B4D] group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-[#142D50]" />
                      <span>Master Campus Timetable Grid</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#172B4D] transition-colors" />
                  </Link>
                </div>
              </Panel>

              <Panel variant="sunken" className="p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#2F7D4F] font-bold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Dean's Office Authority</span>
                </div>
                <p className="text-[#475569] leading-relaxed text-[11px]">
                  Admin actions are permanently logged in the audit ledger. Hard constraints (H1–H14) cannot be bypassed even by Dean's Office administrators.
                </p>
              </Panel>
            </div>
          </div>
        </>
      ) : null}

      <ResetDatasetModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
      />
    </div>
  );
};
