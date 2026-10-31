import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { ClubTimetable } from './ClubTimetable';
import { 
  Calendar, Filter, Sparkles, 
  X, CheckCircle2, AlertOctagon, Move
} from 'lucide-react';

export const TimetableGrid: React.FC = () => {
  const { user } = useAuth();

  // If logged in as club representative, render dedicated Club Representative Timetable
  if (user?.role === 'club') {
    return <ClubTimetable />;
  }
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterView, setFilterView] = useState<string>('all'); // all | group | faculty | room
  const [filterId, setFilterId] = useState<string>('');
  const [isWeek7, setIsWeek7] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [loadingExplain, setLoadingExplain] = useState<boolean>(false);

  // Manual move modal state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState('');
  const [targetDay, setTargetDay] = useState('MON');
  const [targetPeriod, setTargetPeriod] = useState(1);
  const [targetRoom, setTargetRoom] = useState('CR-101');
  const [moveResult, setMoveResult] = useState<any>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const periods = [
    { p: 1, time: '08:00 - 09:00', label: 'P1' },
    { p: 2, time: '09:00 - 10:00', label: 'P2' },
    { p: 3, time: '10:00 - 11:00', label: 'P3' },
    { p: 4, time: '11:00 - 12:00', label: 'P4' },
    { p: 5, time: '12:00 - 13:00', label: 'P5' },
    { p: 'LUNCH', time: '13:00 - 14:00', label: 'LUNCH' },
    { p: 6, time: '14:00 - 15:00', label: 'P6' },
    { p: 7, time: '15:00 - 16:00', label: 'P7' },
    { p: 8, time: '16:00 - 17:00', label: 'P8' },
    { p: 9, time: '17:00 - 18:00', label: 'P9' },
    { p: 10, time: '18:00 - 19:00', label: 'P10 (Event)' },
    { p: 11, time: '19:00 - 20:00', label: 'P11 (Event)' },
    { p: 12, time: '20:00 - 21:00', label: 'P12 (Event)' },
    { p: 13, time: '21:00 - 22:00', label: 'P13 (Event)' },
  ];

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      let url = `/schedule?week=${isWeek7 ? 7 : 1}`;
      if (filterView !== 'all' && filterId) {
        url += `&view=${filterView}&id=${encodeURIComponent(filterId)}`;
      }
      const res = await api.get(url);
      setScheduleData(res.data);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [filterView, filterId, isWeek7]);

  const handleSelectSession = async (sess: any) => {
    if (sess.is_event) return;
    setSelectedSession(sess);
    setLoadingExplain(true);
    setExplanation(null);
    try {
      const res = await api.get(`/schedule/sessions/${sess.session_id}/explain`);
      setExplanation(res.data);
    } catch (err) {
      console.error('Failed to get explanation:', err);
    } finally {
      setLoadingExplain(false);
    }
  };

  const openMoveModal = (sess: any) => {
    setTargetSessionId(sess.session_id);
    setTargetDay(sess.day);
    setTargetPeriod(sess.start_period);
    setTargetRoom(sess.room_id);
    setMoveResult(null);
    setMoveModalOpen(true);
  };

  const handleExecuteMove = async () => {
    setIsSubmittingMove(true);
    setMoveResult(null);
    try {
      const res = await api.post('/schedule/move', {
        session_id: targetSessionId,
        target_day: targetDay,
        target_start_period: targetPeriod,
        target_room_id: targetRoom,
      });
      setMoveResult(res.data);
      if (res.data.valid) {
        fetchSchedule();
      }
    } catch (err: any) {
      setMoveResult({
        valid: false,
        message: err.response?.data?.detail || 'Move request failed',
        violations: [{ rule: 'AUTH', detail: err.response?.data?.detail }],
      });
    } finally {
      setIsSubmittingMove(false);
    }
  };

  const getKindColor = (kind: string, isEvent?: boolean) => {
    if (isEvent) return 'bg-pink-500/20 border-pink-500/40 text-pink-300';
    switch (kind) {
      case 'lecture':
        return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
      case 'tutorial':
        return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
      case 'lab':
        return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  // Find sessions active for cell (day, period)
  const getCellSessions = (day: string, p: number) => {
    if (!scheduleData?.sessions) return [];
    return scheduleData.sessions.filter((s: any) => {
      if (s.day !== day) return false;
      const endP = s.end_period || s.start_period;
      return s.start_period <= p && p <= endP;
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-sky-400" />
            Master Academic Timetable
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized schedule across 14 Student Groups, 40 Faculty, and 27 Venues
          </p>
        </div>

        {/* Filter Controls & Week 7 Switch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Week 7 Toggle */}
          <button
            onClick={() => setIsWeek7(!isWeek7)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isWeek7
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-lg shadow-pink-500/10'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isWeek7 ? 'Week 7: Spectra Fest Mode' : 'Switch to Week 7 View'}
          </button>

          {/* Filter Type */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={filterView}
              onChange={(e) => {
                setFilterView(e.target.value);
                setFilterId('');
              }}
              className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3"
            >
              <option value="all" className="bg-slate-900 text-white">All Sessions</option>
              <option value="group" className="bg-slate-900 text-white">By Student Group</option>
              <option value="faculty" className="bg-slate-900 text-white">By Faculty</option>
              <option value="room" className="bg-slate-900 text-white">By Room / Venue</option>
            </select>
          </div>

          {/* Filter ID Input */}
          {filterView !== 'all' && (
            <input
              type="text"
              placeholder={
                filterView === 'group' ? 'e.g. Y1-A, CSE-2, ECE-3' :
                filterView === 'faculty' ? 'e.g. F06, F19, F37' : 'e.g. AUD, LH-1, CS-LAB-1'
              }
              value={filterId}
              onChange={(e) => setFilterId(e.target.value.toUpperCase())}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          )}

          {/* Color Legend */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-400 pl-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Lecture</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tutorial</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Lab (3h)</span>
            {isWeek7 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Fest Event</span>}
          </div>
        </div>
      </div>

      {/* Timetable Table Container */}
      <div className="glass-panel rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-500">Loading master timetable grid...</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24 sticky left-0 bg-slate-900/90 z-20">
                  Day
                </th>
                {periods.map((item, idx) => (
                  <th
                    key={idx}
                    className={`p-2.5 text-center text-xs font-semibold tracking-wider ${
                      item.p === 'LUNCH'
                        ? 'bg-amber-950/20 text-amber-400 w-20 border-x border-amber-500/20'
                        : typeof item.p === 'number' && item.p >= 10
                        ? 'bg-pink-950/20 text-pink-300 w-28 border-l border-slate-800/80'
                        : 'text-slate-300 w-32 border-l border-slate-800/50'
                    }`}
                  >
                    <div>{item.label}</div>
                    <div className="text-[10px] font-normal text-slate-500">{item.time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {days.map((day) => (
                <tr key={day} className="hover:bg-slate-900/30 transition-colors">
                  {/* Day Label */}
                  <td className="p-3 text-sm font-bold text-sky-400 sticky left-0 bg-slate-950/90 z-10 border-r border-slate-800">
                    {day}
                  </td>

                  {/* Period Columns */}
                  {periods.map((item, pIdx) => {
                    if (item.p === 'LUNCH') {
                      return (
                        <td
                          key={pIdx}
                          className="bg-amber-950/10 border-x border-amber-500/20 text-center text-[10px] text-amber-500/60 font-mono tracking-widest uppercase p-1 select-none"
                        >
                          LUNCH
                        </td>
                      );
                    }

                    const curP = item.p as number;
                    const cellSessions = getCellSessions(day, curP);

                    return (
                      <td
                        key={pIdx}
                        className={`p-1.5 align-top border-l border-slate-800/40 min-h-[90px] ${
                          curP >= 10 ? 'bg-pink-950/5' : ''
                        }`}
                      >
                        <div className="space-y-1.5">
                          {cellSessions.map((sess: any) => {
                            const isStart = sess.start_period === curP;
                            return (
                              <div
                                key={sess.session_id}
                                onClick={() => handleSelectSession(sess)}
                                className={`p-2 rounded-lg border text-xs cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${getKindColor(
                                  sess.kind,
                                  sess.is_event
                                )} ${!isStart ? 'opacity-85 border-dashed' : ''}`}
                              >
                                <div className="flex items-center justify-between font-bold text-[11px] truncate">
                                  <span>{sess.course_id || sess.session_id}</span>
                                  <span className="font-mono text-[9px] px-1 rounded bg-black/30">
                                    {sess.room_id}
                                  </span>
                                </div>
                                <div className="text-[10px] opacity-90 truncate mt-0.5">
                                  {sess.faculty_name || sess.faculty_id || sess.groups?.join(', ')}
                                </div>
                                {sess.displaced_by && (
                                  <div className="text-[9px] font-semibold text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded mt-1">
                                    Displaced by {sess.displaced_by}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Drawer: Explain This Slot */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">
                  Slot Explanation & Why Here
                </h3>
                <span className="font-mono text-xs text-sky-400">
                  {selectedSession.session_id} ({selectedSession.course_id})
                </span>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingExplain ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Evaluating deterministic constraint facts...
              </div>
            ) : explanation ? (
              <div className="space-y-5 text-xs text-slate-300">
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 leading-relaxed">
                  {explanation.explanation_text}
                </div>

                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2">
                    Reasons for Current Placement
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                    {explanation.reasons_for_placement.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2">
                    Campus Conflicts Avoided
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside text-emerald-400/90">
                    {explanation.conflicts_avoided.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                {/* Move button for authorized roles */}
                {(user?.role === 'admin' || user?.role === 'department_coordinator') && (
                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={() => openMoveModal(selectedSession)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                    >
                      <Move className="w-4 h-4 text-sky-400" />
                      Move or Reassign Session
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal: Manual Move Session */}
      {moveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Manual Placement Dialog</h3>
              <button onClick={() => setMoveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Session ID</label>
                <input
                  type="text"
                  disabled
                  value={targetSessionId}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Target Day</label>
                  <select
                    value={targetDay}
                    onChange={(e) => setTargetDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Start Period</label>
                  <select
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    {[1, 2, 3, 4, 6, 7, 8, 9].map((p) => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Target Room</label>
                  <input
                    type="text"
                    value={targetRoom}
                    onChange={(e) => setTargetRoom(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              {moveResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    moveResult.valid
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {moveResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                    {moveResult.valid ? 'Validated by Rules Engine: 0 Hard Violations' : 'Placement Blocked'}
                  </div>
                  <div className="mt-1">{moveResult.message}</div>
                  {moveResult.violations?.length > 0 && (
                    <ul className="mt-2 space-y-1 list-disc list-inside opacity-90">
                      {moveResult.violations.map((v: any, idx: number) => (
                        <li key={idx}>[{v.rule}] {v.detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setMoveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMove}
                disabled={isSubmittingMove}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition-all disabled:opacity-50"
              >
                {isSubmittingMove ? 'Validating...' : 'Validate & Apply Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
