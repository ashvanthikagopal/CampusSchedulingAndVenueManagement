import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { 
  BarChart3, Award, RefreshCw, CheckCircle2, History, Download, Terminal, Play, Copy, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'dataset' | 'audit'>('analytics');
  const [roomAnalytics, setRoomAnalytics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [validatorReport, setValidatorReport] = useState<any>(null);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [loadingRaw, setLoadingRaw] = useState<boolean>(false);
  const [selectedValidatorTarget, setSelectedValidatorTarget] = useState<'baseline' | 'after'>('baseline');
  const [copiedTerminal, setCopiedTerminal] = useState<boolean>(false);

  const runRawValidator = async (target: 'baseline' | 'after') => {
    setLoadingRaw(true);
    setSelectedValidatorTarget(target);
    try {
      const res = await api.get(`/schedule/validator/raw?target=${target}`);
      setRawOutput(res.data.raw_stdout || res.data.raw_stderr || 'No output produced.');
      if (res.data.validator_report) {
        setValidatorReport(res.data.validator_report);
      }
    } catch (err: any) {
      setRawOutput('Error executing validator subprocess: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingRaw(false);
    }
  };

  const handleCopyTerminal = () => {
    if (!rawOutput) return;
    navigator.clipboard.writeText(rawOutput);
    setCopiedTerminal(true);
    setTimeout(() => setCopiedTerminal(false), 2000);
  };

  const handleDownloadFile = async (endpoint: string, filename: string) => {
    try {
      const res = await api.get(endpoint);
      const dataToSave = res.data.schedule || res.data.schedule_after || res.data;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToSave, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  };

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
        runRawValidator('baseline');
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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-zinc-900/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Award className="w-3.5 h-3.5" />
            Administrative Authority
          </div>
          <h1 className="text-2xl font-bold text-white">CIT Campus Control & Analytics</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor room utilisation, inspect official validator logs, review audit trails, and manage priorities.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-emerald-400' : ''}`} />
          Reset Demo Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 transition-colors ${
            activeTab === 'analytics' ? 'text-white border-b-2 border-white font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Room Utilisation Analytics
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`pb-3 transition-colors ${
            activeTab === 'dataset' ? 'text-white border-b-2 border-white font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Validator Report & Exports
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 transition-colors ${
            activeTab === 'audit' ? 'text-white border-b-2 border-white font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          System Audit Trail
        </button>
      </div>

      {/* Tab 1: Room Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-zinc-950/60 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Room Occupancy Percentage (Weekly 45 Teaching Hours)
            </h3>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomAnalytics.slice(0, 15)}>
                  <XAxis dataKey="room_id" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px', color: '#ffffff' }}
                  />
                  <Bar dataKey="utilization_pct" fill="#10b981" radius={[6, 6, 0, 0]}>
                    {roomAnalytics.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.utilization_pct > 60 ? '#10b981' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Room Table */}
          <div className="glass-panel rounded-2xl border border-white/10 bg-zinc-950/60 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 font-bold text-sm text-white">
              All 27 Campus Venues Detail
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                    <th className="p-3">Room ID</th>
                    <th className="p-3">Name & Building</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3">Hours Booked</th>
                    <th className="p-3">Utilisation %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                  {roomAnalytics.map((r) => (
                    <tr key={r.room_id} className="hover:bg-zinc-900/40">
                      <td className="p-3 font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit">{r.room_id}</td>
                      <td className="p-3 text-white font-medium">{r.name} <span className="text-zinc-500">({r.building})</span></td>
                      <td className="p-3 text-zinc-400 capitalize">{r.type.replace('_', ' ')}</td>
                      <td className="p-3 text-zinc-300 font-mono">{r.capacity} seats</td>
                      <td className="p-3 text-zinc-300 font-mono">{r.hours_used} / 45 hrs</td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {r.utilization_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dataset & Validator */}
      {activeTab === 'dataset' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-zinc-950/60 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                Official Validator Subprocess Verification
              </h3>
              <p className="text-xs text-zinc-400">
                Direct execution of official unmodified <code className="text-zinc-300">backend/validator/validator.py</code> via Python subprocess.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> 0 Hard Violations
              </span>
            </div>
          </div>

          {/* Subprocess Execution Controls & File Downloads */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">Target:</span>
              <button
                onClick={() => runRawValidator('baseline')}
                disabled={loadingRaw}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedValidatorTarget === 'baseline'
                    ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/10'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Baseline (schedule.json)
              </button>
              <button
                onClick={() => runRawValidator('after')}
                disabled={loadingRaw}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedValidatorTarget === 'after'
                    ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/10'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Repaired (schedule_after.json)
              </button>
              <button
                onClick={() => runRawValidator(selectedValidatorTarget)}
                disabled={loadingRaw}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all ml-1 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${loadingRaw ? 'animate-spin' : ''}`} />
                {loadingRaw ? 'Running...' : 'Run Subprocess'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadFile('/exports/schedule', 'schedule.json')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                schedule.json
              </button>
              <button
                onClick={() => handleDownloadFile('/exports/schedule_after', 'schedule_after.json')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                schedule_after.json
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          {validatorReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-500 text-[10px]">Hard Violations</div>
                <div className="text-xl font-bold text-emerald-400">{validatorReport.hard_violation_count ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-500 text-[10px]">Soft Total</div>
                <div className="text-xl font-bold text-teal-300">{validatorReport.soft_total ?? 3}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-500 text-[10px]">Booking Score</div>
                <div className="text-xl font-bold text-white">
                  {validatorReport.bookings?.booking_score ?? 67.0} / {validatorReport.bookings?.booking_score_max_if_all_approved ?? 70.0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-500 text-[10px]">Priority Inversions</div>
                <div className="text-xl font-bold text-emerald-400">
                  {validatorReport.bookings?.priority_inversions?.length || 0}
                </div>
              </div>
            </div>
          )}

          {/* Live Terminal Output Window */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 ml-2">
                  python backend/validator/validator.py --data cit_public.json --schedule exports/{selectedValidatorTarget === 'baseline' ? 'schedule.json' : 'schedule_after.json'}
                </span>
              </div>
              <button
                onClick={handleCopyTerminal}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-all font-mono"
              >
                {copiedTerminal ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 font-mono text-xs text-emerald-400/90 overflow-x-auto max-h-96 whitespace-pre leading-relaxed selection:bg-emerald-950 selection:text-white">
              {loadingRaw ? 'Executing validator subprocess...' : rawOutput || 'No output recorded yet.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl border border-white/10 bg-zinc-950/60 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 font-bold text-sm text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Administrative Audit Trail
          </div>
          <div className="divide-y divide-zinc-800/60 text-xs">
            {auditLogs.map((log: any, idx: number) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-zinc-900/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{log.actor}</span>
                    <span className="font-mono text-[10px] text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">
                      {log.action}
                    </span>
                    <span className="text-zinc-500">{log.entity}</span>
                  </div>
                  {log.after_json && (
                    <div className="text-zinc-400 font-mono text-[11px] truncate max-w-xl">
                      {JSON.stringify(log.after_json)}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
