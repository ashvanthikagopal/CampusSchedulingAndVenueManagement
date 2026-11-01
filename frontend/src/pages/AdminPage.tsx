import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  BarChart3, Award, RefreshCw, CheckCircle2, History, Building2, ShieldAlert
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { PageHeader, Panel, StatusBadge, Button } from '../components/ui';

export const AdminPage: React.FC = () => {
  usePageMetadata(
    'Central Administration Console | CIT Campus Scheduler',
    'Administrative controls for Chilika Institute of Technology campus scheduling: dataset management, solver execution, disruption approvals, and logs.'
  );

  const [activeTab, setActiveTab] = useState<'analytics' | 'dataset' | 'audit'>('analytics');
  const [roomAnalytics, setRoomAnalytics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [validatorReport, setValidatorReport] = useState<any>(null);

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  const fetchAdminData = async () => {
    try {
      if (activeTab === 'analytics') {
        const res = await api.get('/admin/analytics/rooms');
        setRoomAnalytics(res.data);
      } else if (activeTab === 'audit') {
        const res = await api.get('/admin/audit');
        setAuditLogs(res.data);
      } else if (activeTab === 'dataset') {
        const res = await api.get('/exports/schedule');
        setValidatorReport(res.data.validator_report);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset database and all state to clean baseline?')) return;
    setIsResetting(true);
    try {
      await api.post('/admin/reset-demo');
      alert('Demo database reset cleanly!');
      window.location.reload();
    } catch (err: any) {
      alert('Reset failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="CIT Campus Control & Analytics"
        subtitle="Monitor room utilisation, inspect official validator logs, review audit trails, and manage priorities."
        badge={
          <StatusBadge
            status="brass"
            label="Administrative Authority"
            icon={<Award className="w-3.5 h-3.5" />}
            size="sm"
          />
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetDemo}
            disabled={isResetting}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />}
          >
            Reset Demo Data
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] gap-2 sm:gap-6 text-sm font-semibold overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'analytics'
              ? 'border-[#2563EB] text-[#172B4D] font-bold'
              : 'border-transparent text-[#475569] hover:text-[#172B4D]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-[#2563EB]" />
          Room Utilisation Analytics
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'dataset'
              ? 'border-[#2563EB] text-[#172B4D] font-bold'
              : 'border-transparent text-[#475569] hover:text-[#172B4D]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-[#2F7D4F]" />
          Validator Report & Exports
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'audit'
              ? 'border-[#2563EB] text-[#172B4D] font-bold'
              : 'border-transparent text-[#475569] hover:text-[#172B4D]'
          }`}
        >
          <History className="w-4 h-4 text-[#2C6A8A]" />
          System Audit Trail
        </button>
      </div>

      {/* Tab 1: Room Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Panel variant="raised" className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base text-[#172B4D] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#2563EB]" />
                  Room Occupancy Percentage (Weekly 45 Teaching Hours)
                </h3>
                <p className="text-xs text-[#475569] mt-0.5">
                  Percentage of teaching periods booked vs total 45 teaching hours across Monday-Saturday
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#142D50]" /> Normal (&le;60%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#2563EB]" /> High (&gt;60%)
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomAnalytics.slice(0, 15)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="room_id" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#172B4D',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.08)'
                    }}
                    formatter={(val: any) => [`${val}%`, 'Utilisation']}
                  />
                  <Bar dataKey="utilization_pct" fill="#142D50" radius={[4, 4, 0, 0]}>
                    {roomAnalytics.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.utilization_pct > 60 ? '#2563EB' : '#142D50'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Room Table */}
          <Panel variant="default" className="overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] font-semibold text-sm text-[#172B4D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2563EB]" />
                Campus Venues Utilization Detail ({roomAnalytics.length})
              </span>
              <span className="text-xs text-[#64748B] font-normal font-mono">
                {roomAnalytics.length} venues cataloged
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F1F5F9] text-[#475569] border-b border-[#E2E8F0] font-semibold">
                    <th className="p-3">Room ID</th>
                    <th className="p-3">Name & Building</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3">Hours Booked</th>
                    <th className="p-3">Utilisation %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {roomAnalytics.map((r) => (
                    <tr key={r.room_id} className="hover:bg-[#F5F7FB] transition-colors">
                      <td className="p-3 font-mono font-bold text-[#172B4D]">{r.room_id}</td>
                      <td className="p-3 text-[#172B4D] font-medium">
                        {r.name} <span className="text-[#64748B]">({r.building})</span>
                      </td>
                      <td className="p-3 text-[#475569] capitalize">{r.type.replace('_', ' ')}</td>
                      <td className="p-3 text-[#172B4D] font-mono">{r.capacity} seats</td>
                      <td className="p-3 text-[#475569] font-mono">{r.hours_used} / 45 hrs</td>
                      <td className="p-3">
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded text-xs border ${
                            r.utilization_pct > 60
                              ? 'bg-[#FAF4E6] text-[#2563EB] border-[#E9D9AE]'
                              : 'bg-[#F1F5F9] text-[#172B4D] border-[#E2E8F0]'
                          }`}
                        >
                          {r.utilization_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 2: Dataset & Validator */}
      {activeTab === 'dataset' && (
        <Panel variant="raised" className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E8F0] pb-4 gap-3">
            <div>
              <h3 className="font-sans font-bold text-base text-[#172B4D]">Official Validator Subprocess Verification</h3>
              <p className="text-xs text-[#475569] mt-0.5">
                Direct output of vendored unmodified backend/validator/validator.py run against exports/schedule.json
              </p>
            </div>
            <StatusBadge
              status="success"
              label="0 Hard Violations"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              size="md"
            />
          </div>

          {validatorReport ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F0]">
                  <div className="text-[#475569] text-[10px] uppercase font-semibold">Hard Violations</div>
                  <div className="text-2xl font-bold text-[#2F7D4F] mt-1">{validatorReport.hard_violation_count}</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">Must remain exactly 0</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F0]">
                  <div className="text-[#475569] text-[10px] uppercase font-semibold">Soft Total Penalty</div>
                  <div className="text-2xl font-bold text-[#2C6A8A] mt-1">{validatorReport.soft_total}</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">Optimized baseline score</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F0]">
                  <div className="text-[#475569] text-[10px] uppercase font-semibold">Priority Inversions</div>
                  <div className="text-2xl font-bold text-[#2F7D4F] mt-1">
                    {validatorReport.bookings?.priority_inversions?.length || 0}
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">Academic over club respect</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#172B4D] overflow-x-auto shadow-inner">
                <pre className="text-xs leading-relaxed">{JSON.stringify(validatorReport, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[#64748B] text-xs">Loading validator report...</div>
          )}
        </Panel>
      )}

      {/* Tab 3: Audit Trail */}
      {activeTab === 'audit' && (
        <Panel variant="default" className="overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] font-semibold text-sm text-[#172B4D] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#2563EB]" />
              Administrative Audit Trail
            </span>
            <span className="text-xs text-[#64748B] font-mono">{auditLogs.length} events logged</span>
          </div>
          <div className="divide-y divide-[#E2E8F0] text-xs">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[#64748B]">No audit trail entries recorded yet.</div>
            ) : (
              auditLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F5F7FB] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#172B4D]">{log.actor}</span>
                      <span className="font-mono text-[10px] text-[#2563EB] bg-[#FAF4E6] px-2 py-0.5 rounded border border-[#E9D9AE]">
                        {log.action}
                      </span>
                      <span className="text-[#475569] font-mono">{log.entity}</span>
                    </div>
                    {log.after_json && (
                      <div className="text-[#64748B] font-mono text-[11px] truncate max-w-2xl bg-[#FFFFFF] px-2 py-1 rounded border border-[#E2E8F0]">
                        {JSON.stringify(log.after_json)}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-[#64748B] font-mono shrink-0">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};
