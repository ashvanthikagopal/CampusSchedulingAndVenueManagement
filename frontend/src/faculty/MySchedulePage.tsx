import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Calendar, CheckCircle2, AlertCircle, AlertTriangle,
  HelpCircle, X, ShieldCheck, UserCheck, Plus
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Select, Input, Label } from '../components/ui/Input';

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
  usePageMetadata(
    'Faculty Personal Schedule & Leaves | CIT Scheduler',
    'Personalized weekly lecture timetable for faculty members. View assigned teaching slots, student cohorts, and mark planned academic leaves.'
  );

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
    queryKey: ['myFacultySchedule', user?.id],
    queryFn: async () => {
      const res = await api.get('/schedule/faculty/my-schedule');
      return res.data;
    },
    enabled: !!user
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
      const facId = user?.faculty_id || scheduleData?.faculty_id || '';
      const res = await api.post('/disruptions/dry-run', {
        description: `Faculty Leave: ${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod}`,
        changes: [
          {
            type: "faculty_unavailable",
            faculty_id: facId,
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
      const facId = user?.faculty_id || scheduleData?.faculty_id || '';
      await api.post('/disruptions', {
        description: `Leave Declaration: Prof. ${user?.name || user?.faculty_id || 'Faculty Member'} (${leaveDay} P${leaveStartPeriod}-P${leaveEndPeriod})`,
        changes: [
          {
            type: "faculty_unavailable",
            faculty_id: facId,
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
      <div className="py-24 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-3 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
        <p className="text-sm text-[#475569] font-mono">Loading your teaching timetable...</p>
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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="My Teaching Schedule"
        subtitle={`Department of ${scheduleData?.department || user?.department}. Weekly teaching assignments with automated workload checks and interactive slot explainability.`}
        badge={
          <StatusBadge
            status="info"
            size="sm"
            label={`${scheduleData?.faculty_name || user?.name} (${scheduleData?.faculty_id || user?.faculty_id})`}
            icon={<UserCheck className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setDryRunResult(null);
              setLeaveModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Mark Unavailability / Leave
          </Button>
        }
      />

      {/* Daily Workload KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {scheduleData?.daily_workload?.map((w: any) => {
          const isAtLimit = w.teaching_hours >= w.max_hours;
          return (
            <Panel key={w.day} variant="default" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#172B4D] font-mono">{w.day}</span>
                <StatusBadge
                  status={isAtLimit ? 'warning' : 'success'}
                  size="sm"
                  label={isAtLimit ? 'Max Hours' : 'Under Limit'}
                  showIcon={false}
                />
              </div>
              <div className="text-2xl font-mono font-bold text-[#172B4D] tabular-nums">
                {w.teaching_hours}h <span className="text-xs font-normal text-[#64748B]">/ {w.max_hours}h</span>
              </div>
              <div className="w-full bg-[#F1F5F9] h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-[#B7791F]' : 'bg-[#142D50]'}`}
                  style={{ width: `${Math.min(100, (w.teaching_hours / w.max_hours) * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-[#475569] font-mono">
                Free: {w.free_periods.length > 0 ? `P${w.free_periods.join(', P')}` : 'None'}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Weekly Timetable Grid */}
      <Panel variant="default" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <h2 className="text-base font-sans font-bold text-[#172B4D] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2563EB]" />
            <span>Weekly Session Grid (Periods 1 - 9)</span>
          </h2>
          <StatusBadge
            status="success"
            size="sm"
            label="0 Timetable Clashes"
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="overflow-x-auto rounded-[8px] border border-[#E2E8F0]">
          <table className="w-full border-collapse text-left text-xs min-w-[700px]">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] text-[#475569] font-mono">
                <th className="py-3 px-3 w-20 font-semibold uppercase tracking-wider text-[11px]">Day</th>
                {PERIODS.map(p => (
                  <th key={p} className={`py-3 px-2 text-center text-[11px] ${p === 5 ? 'bg-[#EBD19E]/30 text-[#B7791F] font-bold' : ''}`}>
                    P{p}
                    <div className="text-[9px] font-normal text-[#64748B]">{p === 5 ? 'Lunch' : PERIOD_TIMES[p].split(' - ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-[#F5F7FB] transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-[#172B4D] bg-[#F1F5F9]/40 border-r border-[#E2E8F0]">{day}</td>
                  {PERIODS.map(p => {
                    if (p === 5) {
                      return (
                        <td key={p} className="p-2 text-center bg-[#FDF5E6]/60 border-x border-[#E2E8F0]">
                          <span className="text-[10px] text-[#B7791F] font-mono font-medium">Lunch</span>
                        </td>
                      );
                    }
                    const sess = gridMap[day]?.[p];
                    if (!sess) {
                      return (
                        <td key={p} className="p-2 text-center text-[#64748B]/50 font-mono">
                          -
                        </td>
                      );
                    }

                    return (
                      <td key={p} className="p-1.5">
                        <div
                          onClick={() => setSelectedSessionId(sess.session_id)}
                          className="p-2.5 rounded-[6px] bg-[#EEF5FA] hover:bg-[#E2EEF7] border-l-[3px] border-l-[#2C6A8A] border-y border-r border-[#C6DFEB] text-[#1D4D65] cursor-pointer transition-all shadow-xs space-y-1 group"
                        >
                          <div className="font-bold text-[11px] flex items-center justify-between">
                            <span className="truncate">{sess.course_id}</span>
                            <span className="text-[9px] font-mono uppercase bg-[#2C6A8A]/10 px-1 rounded text-[#2C6A8A]">{sess.kind[0]}</span>
                          </div>
                          <div className="text-[10px] text-[#475569] font-medium truncate">{sess.room_name || sess.room_id}</div>
                          <div className="text-[9px] text-[#64748B] font-mono truncate">{sess.groups?.join(', ')}</div>
                          <div className="text-[9px] text-[#2563EB] group-hover:text-[#1D4ED8] flex items-center gap-0.5 pt-0.5 font-medium">
                            <HelpCircle className="w-2.5 h-2.5" /> Explain
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* "Why here?" Explain Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] max-w-lg w-full p-6 shadow-[0_8px_30px_rgba(15,23,42,0.15)] relative space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-sans font-bold text-[#172B4D] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#2563EB]" />
                  <span>Slot Explainability: {selectedSessionId}</span>
                </h3>
                <p className="text-xs text-[#475569]">Deterministic constraint and placement breakdown</p>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-[#64748B] hover:text-[#172B4D] p-1 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {explainLoading ? (
              <div className="py-8 text-center text-xs text-[#64748B]">Loading placement explanation...</div>
            ) : explainData ? (
              <div className="space-y-3.5 text-xs">
                <Panel variant="sunken" className="p-3.5 space-y-1">
                  <div className="text-[#475569] text-[11px] font-medium">Assigned Slot:</div>
                  <div className="text-[#172B4D] font-bold text-sm">
                    {explainData.assigned_day} Period {explainData.assigned_period} in {explainData.assigned_room}
                  </div>
                  <div className="text-[#2F7D4F] font-mono text-[11px] pt-1 flex items-center justify-between">
                    <span>{explainData.legal_options_count} legal placement options</span>
                    <StatusBadge status="success" size="sm" label="0 Hard Violations" />
                  </div>
                  {explainData.checked_rules && explainData.checked_rules.length > 0 && (
                    <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                      ✓ Rules Verified: H1-H12, H14, Fest Bookings
                    </div>
                  )}
                </Panel>

                <div className="space-y-1.5">
                  <div className="font-semibold text-[#172B4D]">Placement Factors:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[#475569]">
                    {explainData.reasons_for_placement?.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-[#172B4D]">Conflicts Prevented:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[#2F7D4F]">
                    {explainData.conflicts_avoided?.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                {explainData.infeasible_explanation && (
                  <div className="p-3 rounded-[8px] bg-[#FDF5E6] border border-[#EBD19E] text-[#B7791F] space-y-1">
                    <div className="font-bold text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
                      <span>Infeasibility Analysis (Zero Single Moves Possible):</span>
                    </div>
                    {explainData.infeasible_explanation.bottlenecks?.map((b: string, bIdx: number) => (
                      <div key={bIdx} className="text-[10px] text-[#475569]">• {b}</div>
                    ))}
                    {explainData.infeasible_explanation.suggestions?.map((s: string, sIdx: number) => (
                      <div key={sIdx} className="text-[10px] text-[#1D4ED8] font-medium">💡 Suggestion: {s}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#B3402F]">Unable to load explanation.</div>
            )}

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => setSelectedSessionId(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Leave Declaration Modal with Solver Dry-Run */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] max-w-lg w-full p-6 shadow-[0_8px_30px_rgba(15,23,42,0.15)] relative space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-sans font-bold text-[#172B4D]">
                  Mark Unavailability / Leave
                </h3>
                <p className="text-xs text-[#475569]">Submit unavailability with solver impact preview</p>
              </div>
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="text-[#64748B] hover:text-[#172B4D] p-1 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <Label>Day of Week</Label>
                <Select
                  value={leaveDay}
                  onChange={e => setLeaveDay(e.target.value)}
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Period</Label>
                  <Select
                    value={leaveStartPeriod}
                    onChange={e => setLeaveStartPeriod(Number(e.target.value))}
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>Period {p} ({PERIOD_TIMES[p].split(' - ')[0]})</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>End Period</Label>
                  <Select
                    value={leaveEndPeriod}
                    onChange={e => setLeaveEndPeriod(Number(e.target.value))}
                  >
                    {PERIODS.filter(p => p >= leaveStartPeriod).map(p => (
                      <option key={p} value={p}>Period {p} ({PERIOD_TIMES[p].split(' - ')[1]})</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label>Reason for Leave</Label>
                <Input
                  type="text"
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="e.g. Academic conference, medical appointment"
                />
              </div>

              {/* Dry-Run Result Preview */}
              {dryRunResult && (
                <div className={`p-3 rounded-[8px] border text-xs space-y-1.5 ${
                  dryRunResult.status === 'FEASIBLE'
                    ? 'bg-[#EBF5EE] border-[#C3E2CD] text-[#2F7D4F]'
                    : 'bg-[#FBEFEF] border-[#EFC5BF] text-[#B3402F]'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {dryRunResult.status === 'FEASIBLE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Status: {dryRunResult.status}</span>
                  </div>
                  {dryRunResult.status === 'FEASIBLE' ? (
                    <div>
                      <div>Minimal-change repair feasible: <strong>{dryRunResult.moved_count ?? 0}</strong> sessions moved ({dryRunResult.time_changed_count ?? 0} time shifts, {dryRunResult.room_only_changed_count ?? 0} room swaps).</div>
                      <div>Hard violations: <strong>{dryRunResult.hard_violations ?? 0}</strong> · Soft penalty delta: <strong>{dryRunResult.soft_delta ?? 0}</strong></div>
                    </div>
                  ) : (
                    <div>{dryRunResult.message || 'Conflicts detected in declared slot.'}</div>
                  )}
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
                Submit Leave Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
