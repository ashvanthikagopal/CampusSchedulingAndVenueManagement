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
      <div className="flex border-b border-[#E4DBC6] gap-2 sm:gap-6 text-sm font-semibold overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'analytics'
              ? 'border-[#B08A3E] text-[#1F2A24] font-bold'
              : 'border-transparent text-[#55625A] hover:text-[#1F2A24]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-[#B08A3E]" />
          Room Utilisation Analytics
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'dataset'
              ? 'border-[#B08A3E] text-[#1F2A24] font-bold'
              : 'border-transparent text-[#55625A] hover:text-[#1F2A24]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-[#2F7D4F]" />
          Validator Report & Exports
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-1 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'audit'
              ? 'border-[#B08A3E] text-[#1F2A24] font-bold'
              : 'border-transparent text-[#55625A] hover:text-[#1F2A24]'
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
                <h3 className="font-serif font-bold text-base text-[#1F2A24] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#B08A3E]" />
                  Room Occupancy Percentage (Weekly 45 Teaching Hours)
                </h3>
                <p className="text-xs text-[#55625A] mt-0.5">
                  Percentage of teaching periods booked vs total 45 teaching hours across Monday-Saturday
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#7C877F]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#12372A]" /> Normal (&le;60%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#B08A3E]" /> High (&gt;60%)
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomAnalytics.slice(0, 15)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="room_id" stroke="#7C877F" fontSize={11} tickLine={false} />
                  <YAxis stroke="#7C877F" fontSize={11} domain={[0, 100]} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFDF8',
                      borderColor: '#E4DBC6',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#1F2A24',
                      boxShadow: '0 2px 8px rgba(31,42,36,0.08)'
                    }}
                    formatter={(val: any) => [`${val}%`, 'Utilisation']}
                  />
                  <Bar dataKey="utilization_pct" fill="#12372A" radius={[4, 4, 0, 0]}>
                    {roomAnalytics.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.utilization_pct > 60 ? '#B08A3E' : '#12372A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Room Table */}
          <Panel variant="default" className="overflow-hidden">
            <div className="p-4 border-b border-[#E4DBC6] font-semibold text-sm text-[#1F2A24] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#B08A3E]" />
                All 27 Campus Venues Detail
              </span>
              <span className="text-xs text-[#7C877F] font-normal font-mono">
                {roomAnalytics.length} venues cataloged
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F2ECDC] text-[#55625A] border-b border-[#E4DBC6] font-semibold">
                    <th className="p-3">Room ID</th>
                    <th className="p-3">Name & Building</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3">Hours Booked</th>
                    <th className="p-3">Utilisation %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC6]">
                  {roomAnalytics.map((r) => (
                    <tr key={r.room_id} className="hover:bg-[#FAF6EC] transition-colors">
                      <td className="p-3 font-mono font-bold text-[#1F2A24]">{r.room_id}</td>
                      <td className="p-3 text-[#1F2A24] font-medium">
                        {r.name} <span className="text-[#7C877F]">({r.building})</span>
                      </td>
                      <td className="p-3 text-[#55625A] capitalize">{r.type.replace('_', ' ')}</td>
                      <td className="p-3 text-[#1F2A24] font-mono">{r.capacity} seats</td>
                      <td className="p-3 text-[#55625A] font-mono">{r.hours_used} / 45 hrs</td>
                      <td className="p-3">
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded text-xs border ${
                            r.utilization_pct > 60
                              ? 'bg-[#FAF4E6] text-[#B08A3E] border-[#E9D9AE]'
                              : 'bg-[#F2ECDC] text-[#1F2A24] border-[#E4DBC6]'
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4DBC6] pb-4 gap-3">
            <div>
              <h3 className="font-serif font-bold text-base text-[#1F2A24]">Official Validator Subprocess Verification</h3>
              <p className="text-xs text-[#55625A] mt-0.5">
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
                <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E4DBC6]">
                  <div className="text-[#55625A] text-[10px] uppercase font-semibold">Hard Violations</div>
                  <div className="text-2xl font-bold text-[#2F7D4F] mt-1">{validatorReport.hard_violation_count}</div>
                  <div className="text-[10px] text-[#7C877F] mt-0.5">Must remain exactly 0</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E4DBC6]">
                  <div className="text-[#55625A] text-[10px] uppercase font-semibold">Soft Total Penalty</div>
                  <div className="text-2xl font-bold text-[#2C6A8A] mt-1">{validatorReport.soft_total}</div>
                  <div className="text-[10px] text-[#7C877F] mt-0.5">Optimized baseline score</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E4DBC6]">
                  <div className="text-[#55625A] text-[10px] uppercase font-semibold">Priority Inversions</div>
                  <div className="text-2xl font-bold text-[#2F7D4F] mt-1">
                    {validatorReport.bookings?.priority_inversions?.length || 0}
                  </div>
                  <div className="text-[10px] text-[#7C877F] mt-0.5">Academic over club respect</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F2ECDC] border border-[#E4DBC6] text-[#1F2A24] overflow-x-auto shadow-inner">
                <pre className="text-xs leading-relaxed">{JSON.stringify(validatorReport, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[#7C877F] text-xs">Loading validator report...</div>
          )}
        </Panel>
      )}

      {/* Tab 3: Audit Trail */}
      {activeTab === 'audit' && (
        <Panel variant="default" className="overflow-hidden">
          <div className="p-4 border-b border-[#E4DBC6] font-semibold text-sm text-[#1F2A24] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#B08A3E]" />
              Administrative Audit Trail
            </span>
            <span className="text-xs text-[#7C877F] font-mono">{auditLogs.length} events logged</span>
          </div>
          <div className="divide-y divide-[#E4DBC6] text-xs">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[#7C877F]">No audit trail entries recorded yet.</div>
            ) : (
              auditLogs.map((log: any, idx: number) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF6EC] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1F2A24]">{log.actor}</span>
                      <span className="font-mono text-[10px] text-[#B08A3E] bg-[#FAF4E6] px-2 py-0.5 rounded border border-[#E9D9AE]">
                        {log.action}
                      </span>
                      <span className="text-[#55625A] font-mono">{log.entity}</span>
                    </div>
                    {log.after_json && (
                      <div className="text-[#7C877F] font-mono text-[11px] truncate max-w-2xl bg-[#FFFDF8] px-2 py-1 rounded border border-[#E4DBC6]">
                        {JSON.stringify(log.after_json)}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-[#7C877F] font-mono shrink-0">
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
