import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { 
  Calendar, Filter, Sparkles, 
  X, CheckCircle2, AlertOctagon, Move,
  GraduationCap, UserCheck, DoorOpen, RotateCcw
} from 'lucide-react';

interface StudentGroup {
  id: string;
  name: string;
  year: number;
  department: string;
  size: number;
  needs_accessible?: boolean;
}

interface Faculty {
  id: string;
  name: string;
  department: string;
}

interface Room {
  id: string;
  name: string;
  building?: string;
  type: string;
  capacity: number;
}

export const TimetableGrid: React.FC = () => {
  const { user } = useAuth();
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterView, setFilterView] = useState<string>('all'); // all | group | faculty | room
  const [filterId, setFilterId] = useState<string>('');
  const [isWeek7, setIsWeek7] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [loadingExplain, setLoadingExplain] = useState<boolean>(false);

  // Filter options loaded from backend
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);

  // Track initial default assignment per user
  const initialDefaultApplied = useRef(false);

  // Manual move modal state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveSession, setMoveSession] = useState<any>(null);
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

  // 1. Fetch metadata options (student groups, faculty, rooms)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [groupsRes, facRes, roomsRes] = await Promise.all([
          api.get('/schedule/groups'),
          api.get('/schedule/faculty'),
          api.get('/schedule/rooms'),
        ]);
        setGroups(groupsRes.data || []);
        setFacultyList(facRes.data || []);
        setRoomsList(roomsRes.data || []);
      } catch (err) {
        console.error('Failed to load timetable options:', err);
      }
    };
    fetchMetadata();
  }, []);

  // 2. Set role-based default view once user and groups are loaded
  useEffect(() => {
    if (initialDefaultApplied.current || !user || groups.length === 0) return;

    if (user.role === 'student') {
      const studentGroup = user.group_id || user.group || 'Y1-A';
      setFilterView('group');
      setFilterId(studentGroup);
    } else if (user.role === 'faculty') {
      const facId = user.faculty_id || 'F06';
      setFilterView('faculty');
      setFilterId(facId);
    } else if (user.role === 'department_coordinator') {
      const dept = user.department || 'CSE';
      const deptGroups = groups.filter((g) => g.department === dept);
      const defaultGroup = deptGroups.length > 0 ? deptGroups[0].id : 'CSE-2';
      setFilterView('group');
      setFilterId(defaultGroup);
    } else {
      // Admin, club, etc: default to master grid
      setFilterView('all');
      setFilterId('');
    }

    initialDefaultApplied.current = true;
  }, [user, groups]);

  // 3. Fetch schedule from backend
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
    setMoveSession(sess);
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

  // Check if viewing a single class
  const isSingleGroupView = filterView === 'group' && !!filterId;
  const selectedGroupObj = groups.find((g) => g.id === filterId);

  // Compute stats for selected class
  const activeSessions = scheduleData?.sessions || [];
  const uniqueClassSessions = activeSessions.filter((s: any) => !s.is_event);
  const totalSessionsCount = uniqueClassSessions.length;
  const totalHours = uniqueClassSessions.reduce(
    (acc: number, s: any) => acc + (s.duration || 1),
    0
  );
  const lectureCount = uniqueClassSessions.filter((s: any) => s.kind === 'lecture').length;
  const labCount = uniqueClassSessions.filter((s: any) => s.kind === 'lab').length;
  const tutorialCount = uniqueClassSessions.filter((s: any) => s.kind === 'tutorial').length;

  // Filter groups for coordinator scope
  const isCoordinator = user?.role === 'department_coordinator';
  const coordDept = user?.department || '';
  const myDeptGroups = isCoordinator
    ? groups.filter((g) => g.department === coordDept)
    : [];
  const otherGroups = isCoordinator
    ? groups.filter((g) => g.department !== coordDept)
    : groups;

  const activeMoveSession = moveSession || selectedSession || scheduleData?.sessions?.find((s: any) => s.session_id === targetSessionId);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-sky-400" />
            {isSingleGroupView
              ? `${selectedGroupObj?.name || filterId} Timetable`
              : 'Master Academic Timetable'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isSingleGroupView
              ? `Weekly schedule for ${selectedGroupObj?.name || filterId} (${selectedGroupObj?.department} Department · Year ${selectedGroupObj?.year})`
              : 'Synchronized schedule across 14 Student Groups, 40 Faculty, and 27 Venues'}
          </p>
        </div>

        {/* Filter Controls & Week 7 Switch */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
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

          {/* Filter View Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={filterView}
              onChange={(e) => {
                const val = e.target.value;
                setFilterView(val);
                if (val === 'all') {
                  setFilterId('');
                } else if (val === 'group') {
                  // Default to first group or coordinator department group
                  if (isCoordinator && myDeptGroups.length > 0) {
                    setFilterId(myDeptGroups[0].id);
                  } else if (groups.length > 0) {
                    setFilterId(groups[0].id);
                  }
                } else if (val === 'faculty') {
                  setFilterId(user?.faculty_id || (facultyList.length > 0 ? facultyList[0].id : ''));
                } else if (val === 'room') {
                  setFilterId(roomsList.length > 0 ? roomsList[0].id : '');
                }
              }}
              className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3"
            >
              <option value="all" className="bg-slate-900 text-white">All Sessions (Master Grid)</option>
              <option value="group" className="bg-slate-900 text-white">By Student Class (Group)</option>
              <option value="faculty" className="bg-slate-900 text-white">By Faculty Member</option>
              <option value="room" className="bg-slate-900 text-white">By Room / Venue</option>
            </select>
          </div>

          {/* Dynamic Dropdowns for Group / Faculty / Room */}
          {filterView === 'group' && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <GraduationCap className="w-3.5 h-3.5 text-sky-400 ml-2" />
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3 max-w-[280px]"
              >
                {isCoordinator && myDeptGroups.length > 0 ? (
                  <>
                    <optgroup label={`${coordDept} Department Classes (Your Scope)`} className="bg-slate-900 text-sky-300 font-bold">
                      {myDeptGroups.map((g) => (
                        <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                          {g.id} — {g.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other Campus Classes" className="bg-slate-900 text-slate-400 font-semibold">
                      {otherGroups.map((g) => (
                        <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                          {g.id} — {g.name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  <>
                    <optgroup label="Year 1 (Common Curriculum)" className="bg-slate-900 text-sky-400 font-semibold">
                      {groups
                        .filter((g) => g.year === 1)
                        .map((g) => (
                          <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                            {g.id} — {g.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Year 2 (Core B.Tech)" className="bg-slate-900 text-emerald-400 font-semibold">
                      {groups
                        .filter((g) => g.year === 2)
                        .map((g) => (
                          <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                            {g.id} — {g.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Year 3 (Specialization & Electives)" className="bg-slate-900 text-purple-400 font-semibold">
                      {groups
                        .filter((g) => g.year === 3)
                        .map((g) => (
                          <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                            {g.id} — {g.name}
                          </option>
                        ))}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
          )}

          {filterView === 'faculty' && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-amber-400 ml-2" />
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3 max-w-[280px]"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                    {f.id} — {f.name} ({f.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterView === 'room' && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400 ml-2" />
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3 max-w-[280px]"
              >
                {roomsList.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                    {r.id} — {r.name} ({r.type}, Cap: {r.capacity})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset / All Classes button */}
          {filterView !== 'all' && (
            <button
              onClick={() => {
                setFilterView('all');
                setFilterId('');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
              title="Return to Master Timetable"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              All Classes
            </button>
          )}

          {/* Color Legend */}
          <div className="hidden 2xl:flex items-center gap-3 text-[11px] text-slate-400 pl-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Lecture</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tutorial</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Lab (3h)</span>
            {isWeek7 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Fest Event</span>}
          </div>
        </div>
      </div>

      {/* Selected Class Summary Banner */}
      {isSingleGroupView && (
        <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900/80 to-indigo-950/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {selectedGroupObj?.name || `Student Group ${filterId}`}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {filterId}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedGroupObj?.department === 'COMMON' ? 'Common Curriculum' : `${selectedGroupObj?.department} Department`}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Year {selectedGroupObj?.year || '1'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>Class Size: <strong className="text-slate-200">{selectedGroupObj?.size || 60} Students</strong></span>
                <span>·</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 0 Schedule Clashes
                </span>
                {user?.role === 'student' && (
                  <>
                    <span>·</span>
                    <span className="text-indigo-400 font-semibold">Your Enrolled Class (Read-Only)</span>
                  </>
                )}
                {isCoordinator && myDeptGroups.some((g) => g.id === filterId) && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">Your Department Scope (Move Enabled)</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
            <div className="text-center">
              <div className="text-2xl font-bold text-sky-400 font-mono">
                {totalSessionsCount}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Weekly Sessions
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {totalHours} hrs
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Total Hours
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>{lectureCount} Lectures</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>{labCount} Labs ({labCount * 3}h)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{tutorialCount} Tutorials</span>
              </div>
            </div>

            {user?.role !== 'student' && (
              <button
                onClick={() => {
                  setFilterView('all');
                  setFilterId('');
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5 ml-auto md:ml-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                All Classes
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timetable Table Container */}
      <div className="glass-panel rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-500">
            Loading {isSingleGroupView ? `${filterId} timetable...` : 'master timetable grid...'}
          </div>
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
                              const isMultiHour = (sess.duration || 1) > 1;

                              // Clean presentation for single class vs master stack
                              if (isSingleGroupView) {
                                if (!isStart) {
                                  // Multi-hour lab continuation cell
                                  return (
                                    <div
                                      key={`${sess.session_id}-${curP}`}
                                      onClick={() => handleSelectSession(sess)}
                                      className="p-2 rounded-lg border border-dashed border-purple-500/40 bg-purple-950/20 text-purple-300 text-xs cursor-pointer transition-all hover:bg-purple-950/30"
                                      title={`${sess.course_id} Lab (Hour ${curP - sess.start_period + 1} of ${sess.duration})`}
                                    >
                                      <div className="flex items-center justify-between font-semibold text-[10px]">
                                        <span className="truncate">↳ {sess.course_id} Lab (cont.)</span>
                                        <span className="font-mono text-[9px] px-1 rounded bg-black/30">
                                          {sess.room_id}
                                        </span>
                                      </div>
                                      <div className="text-[9px] opacity-75 truncate mt-0.5">
                                        Hr {curP - sess.start_period + 1} of {sess.duration} · {sess.faculty_name || sess.faculty_id}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={sess.session_id}
                                    onClick={() => handleSelectSession(sess)}
                                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.02] shadow-md ${getKindColor(
                                      sess.kind,
                                      sess.is_event
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between font-bold text-xs">
                                      <span className="tracking-tight">{sess.course_id || sess.session_id}</span>
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-semibold">
                                        {sess.room_id}
                                      </span>
                                    </div>

                                    {/* Kind badge & multi-hour notice */}
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/30">
                                        {sess.kind} {isMultiHour ? `(${sess.duration}h)` : ''}
                                      </span>
                                      {sess.basket_slot && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                                          Basket: {sess.basket_slot}
                                        </span>
                                      )}
                                    </div>

                                    {/* Faculty / Instructor */}
                                    <div className="text-[10px] font-medium opacity-90 truncate mt-1">
                                      {sess.faculty_name || sess.faculty_id || sess.groups?.join(', ')}
                                    </div>

                                    {/* Displacement warning for Week 7 */}
                                    {sess.displaced_by && (
                                      <div className="text-[9px] font-semibold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded mt-1.5 border border-rose-500/30">
                                        Displaced by {sess.displaced_by}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Master grid view: compact cards
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

                {/* Move button for authorized roles: Admin and Department Coordinator */}
                {(user?.role === 'admin' || user?.role === 'department_coordinator') && (
                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={() => openMoveModal(selectedSession)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-all shadow-lg shadow-sky-600/20"
                    >
                      <Move className="w-4 h-4" />
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

            {/* Read-Only Summary Card for Selected Session */}
            {activeMoveSession && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {activeMoveSession.course_id || activeMoveSession.session_id}
                    </span>
                    {activeMoveSession.kind && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {activeMoveSession.kind}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    {activeMoveSession.session_id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-400 border-t border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Faculty</span>
                    <span className="text-slate-200 font-medium truncate block">
                      {activeMoveSession.faculty_name || activeMoveSession.faculty_id || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Groups</span>
                    <span className="text-slate-200 font-medium truncate block">
                      {Array.isArray(activeMoveSession.groups) && activeMoveSession.groups.length > 0
                        ? activeMoveSession.groups.join(', ')
                        : activeMoveSession.groups || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Current Placement</span>
                    <span className="text-sky-300 font-mono font-medium">
                      {activeMoveSession.day} · Period {activeMoveSession.start_period} · Room {activeMoveSession.room_id}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Session ID</label>
                <input
                  type="text"
                  disabled
                  value={targetSessionId}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  To move a different class, close this dialog and click it on the grid.
                </p>
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
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
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
