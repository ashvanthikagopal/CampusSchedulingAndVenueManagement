import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { ClubTimetable } from './ClubTimetable';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Calendar, Filter, Sparkles, 
  X, CheckCircle2, AlertOctagon, Move,
  Users, BookOpen, Clock, Building2, HelpCircle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Select, Input, Label } from '../components/ui/Input';

interface GroupItem {
  id: string;
  name: string;
  size: number;
  year: number;
  department: string;
}

interface FilterOptionsData {
  groups: GroupItem[];
  by_year: Record<string, GroupItem[]>;
  by_dept: Record<string, GroupItem[]>;
  faculty: Array<{ id: string; name: string; department: string }>;
  rooms: Array<{ id: string; name: string; building: string; type: string }>;
}

export const TimetableGrid: React.FC = () => {
  usePageMetadata(
    'Master Interactive Timetable Grid | CIT Scheduler',
    'Browse and search the official CIT weekly timetable by room, faculty member, student group, or department with zero timetable clashes guaranteed.'
  );

  const { user } = useAuth();

  // If logged in as club representative, render dedicated Club Representative Timetable
  if (user?.role === 'club') {
    return <ClubTimetable />;
  }

  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [groupsData, setGroupsData] = useState<FilterOptionsData | null>(null);

  // Role-based initial filter state
  const [filterView, setFilterView] = useState<string>('all');
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
  const [targetRoom, setTargetRoom] = useState('');
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

  // 1. Fetch class groups and directory options from backend
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await api.get('/schedule/groups');
        setGroupsData(res.data);
      } catch (err) {
        console.error('Failed to load schedule groups:', err);
      }
    };
    loadGroups();
  }, []);

  // 2. Set default role-based views
  useEffect(() => {
    if (!user) return;
    if (user.role === 'student') {
      setFilterView('group');
      setFilterId(user.student_group || (groupsData?.groups?.[0]?.id ?? ''));
    } else if (user.role === 'faculty') {
      setFilterView('faculty');
      setFilterId(user.faculty_id || 'F06');
    } else if (user.role === 'department_coordinator') {
      setFilterView('group');
      const dept = user.department || 'CSE';
      setFilterId(`${dept}-2`);
    } else if (user.role === 'admin') {
      setFilterView('all');
      setFilterId('');
    }
  }, [user]);

  // 3. Fetch schedule from backend whenever filters change
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
      console.error('Failed to load timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [filterView, filterId, isWeek7]);

  // 4. Compute class summary metadata for single class views
  const classSummary = useMemo(() => {
    if (filterView !== 'group' || !filterId || !scheduleData?.sessions) return null;
    const groupMeta = groupsData?.groups?.find((g) => g.id === filterId);
    const sessions = scheduleData.sessions;
    const courseIds = new Set(sessions.map((s: any) => s.course_id));
    const totalHours = sessions.reduce((acc: number, s: any) => acc + (s.duration || 1), 0);
    const hasElectives = sessions.some((s: any) => s.is_basket || s.basket_id);

    return {
      group: groupMeta,
      sessionCount: sessions.length,
      coursesCount: courseIds.size,
      totalHours,
      hasElectives,
    };
  }, [filterView, filterId, scheduleData, groupsData]);

  // Click handler to open explanation drawer
  const handleSelectSession = async (session: any) => {
    setSelectedSession(session);
    setLoadingExplain(true);
    try {
      const res = await api.get(`/schedule/sessions/${session.session_id}/explain`);
      setExplanation(res.data);
    } catch (err) {
      console.error('Failed to explain session:', err);
      setExplanation(null);
    } finally {
      setLoadingExplain(false);
    }
  };

  // Open move modal
  const openMoveModal = (session: any) => {
    setTargetSessionId(session.session_id);
    setTargetDay(session.day);
    setTargetPeriod(session.start_period);
    setTargetRoom(session.room_id);
    setMoveResult(null);
    setMoveModalOpen(true);
  };

  // Execute manual move
  const handleExecuteMove = async () => {
    setIsSubmittingMove(true);
    setMoveResult(null);
    try {
      const res = await api.post('/schedule/move', {
        session_id: targetSessionId,
        target_day: targetDay,
        target_period: targetPeriod,
        target_room: targetRoom,
      });
      setMoveResult(res.data);
      if (res.data.valid) {
        fetchSchedule();
        setTimeout(() => {
          setMoveModalOpen(false);
          setMoveResult(null);
        }, 1500);
      }
    } catch (err: any) {
      setMoveResult({
        valid: false,
        message: err.response?.data?.detail || 'Failed to execute move request',
      });
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Session type tints per Campus Ledger specification
  const getKindStyle = (kind: string, isEvent?: boolean) => {
    if (isEvent) {
      return 'bg-[#FCF2EC] border-l-[3px] border-l-[#B0653E] border-y border-r border-[#F3D3C2] text-[#7D4323]';
    }
    switch (kind) {
      case 'lecture':
        return 'bg-[#EEF5FA] border-l-[3px] border-l-[#2C6A8A] border-y border-r border-[#C6DFEB] text-[#1D4D65]';
      case 'tutorial':
        return 'bg-[#EEF6F0] border-l-[3px] border-l-[#2F7D4F] border-y border-r border-[#C3E2CD] text-[#205737]';
      case 'lab':
        return 'bg-[#F4F0F9] border-l-[3px] border-l-[#6B4E8C] border-y border-r border-[#D9CEE8] text-[#4F3569]';
      case 'exam':
        return 'bg-[#FAF4E6] border-l-[3px] border-l-[#B7791F] border-y border-r border-[#EBD19E] text-[#7A4F10]';
      default:
        return 'bg-[#FFFFFF] border-l-[3px] border-l-[#E2E8F0] border-y border-r border-[#E2E8F0] text-[#172B4D]';
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

  const canMove = user?.role === 'admin' || user?.role === 'department_coordinator';
  const isSingleClassView = filterView === 'group' && Boolean(filterId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={
          isSingleClassView
            ? `Class Timetable: ${filterId}`
            : filterView === 'faculty' && user?.role === 'faculty'
            ? `Faculty Schedule: ${user.name || user.faculty_id}`
            : 'Master Academic Timetable'
        }
        subtitle={
          isSingleClassView
            ? `Viewing schedule matrix for ${classSummary?.group?.name || filterId}.`
            : groupsData ? `Synchronized weekly teaching schedule across ${groupsData.groups?.length || 0} Student Groups, ${groupsData.faculty?.length || 0} Faculty, and ${groupsData.rooms?.length || 0} Venues.` : 'Synchronized weekly teaching schedule across student groups, faculty, and campus venues.'
        }
        badge={
          <StatusBadge
            status="success"
            size="sm"
            label="0 Clashes Guaranteed"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Week 7 Spectra Fest Toggle */}
            <Button
              variant={isWeek7 ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setIsWeek7(!isWeek7)}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {isWeek7 ? 'Week 7: Spectra Fest' : 'Switch to Week 7'}
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar Panel */}
      <Panel variant="default" padded={false} className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-4">
          <div className="campus-timetable-filters">
            <div className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Filter:</span>
            </div>

            {/* Filter Mode Selector */}
            <Select
              value={filterView}
              onChange={(e) => {
                const nv = e.target.value;
                setFilterView(nv);
                if (nv === 'all') {
                  setFilterId('');
                } else if (nv === 'group') {
                  if (user?.role === 'student') {
                    setFilterId(user.student_group || (groupsData?.groups?.[0]?.id ?? ''));
                  } else if (user?.role === 'department_coordinator') {
                    const dGroup = groupsData?.groups?.find(g => g.department === user.department); setFilterId(dGroup ? dGroup.id : (groupsData?.groups?.[0]?.id ?? ''));
                  } else {
                    setFilterId(groupsData?.groups?.[0]?.id ?? '');
                  }
                } else if (nv === 'faculty') {
                  setFilterId(user?.role === 'faculty' ? (user.faculty_id || (groupsData?.faculty?.[0]?.id ?? '')) : (groupsData?.faculty?.[0]?.id ?? ''));
                } else if (nv === 'room') {
                  setFilterId(groupsData?.rooms?.[0]?.id ?? '');
                }
              }}
              className="w-full min-w-0 text-xs py-1.5"
            >
              {user?.role !== 'faculty' && user?.role !== 'student' && (
                <option value="all">All Classes & Venues</option>
              )}
              <option value="group">
                {user?.role === 'student' ? `My Class (${user.student_group || (groupsData?.groups?.[0]?.id ?? '')})` : 'By Student Class'}
              </option>
              {user?.role !== 'student' && (
                <option value="faculty">
                  {user?.role === 'faculty' ? `My Faculty Schedule${user.faculty_id ? ` (${user.faculty_id})` : ''}` : 'By Faculty Member'}
                </option>
              )}
              {user?.role !== 'faculty' && user?.role !== 'student' && (
                <option value="room">By Room / Venue</option>
              )}
            </Select>

            {/* Secondary Specific Selector Dropdown */}
            {filterView === 'group' && (
              user?.role === 'student' ? (
                <div className="px-3 py-1.5 rounded-[8px] bg-[#EBF5EE] border border-[#C3E2CD] text-xs text-[#2F7D4F] font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{user.student_group || (groupsData?.groups?.[0]?.id ?? '')}</span>
                </div>
              ) : (
                <Select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="w-full min-w-0 text-xs py-1.5"
                >
                  {user?.role === 'department_coordinator' && user.department && groupsData?.by_dept?.[user.department] && (
                    <optgroup label={`${user.department} Department Classes`} className="font-bold text-[#142D50]">
                      {groupsData.by_dept[user.department].map((g) => (
                        <option key={g.id} value={g.id}>
                          ★ {g.id} ({g.name})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupsData?.by_year ? (
                    Object.entries(groupsData.by_year).map(([yearLabel, grpList]) => (
                      <optgroup key={yearLabel} label={yearLabel}>
                        {grpList.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.id} — {g.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    ['Y1-A', 'Y1-B', 'Y1-C', 'Y1-D', 'CSE-2', 'ECE-2', 'EE-2', 'ME-2', 'CE-2'].map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))
                  )}
                </Select>
              )
            )}

            {filterView === 'faculty' && (
              user?.role === 'faculty' ? (
                <div className="px-3 py-1.5 rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#2563EB] font-mono font-semibold">
                  {user.faculty_id || 'Assigned'}
                </div>
              ) : (
                <Select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="w-full min-w-0 text-xs py-1.5"
                >
                  {groupsData?.faculty ? (
                    groupsData.faculty.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id} — {f.name} ({f.department})
                      </option>
                    ))
                  ) : (
                    <option value="F01">F01</option>
                  )}
                </Select>
              )
            )}

            {filterView === 'room' && (
              <Select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="w-full min-w-0 text-xs py-1.5"
              >
                {groupsData?.rooms ? (
                  groupsData.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.name} ({r.building})
                    </option>
                  ))
                ) : (
                  <option value="">Loading rooms...</option>
                )}
              </Select>
            )}

            {/* Clear Filters Button */}
            {filterView !== 'all' && user?.role !== 'student' && user?.role !== 'faculty' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterView('all');
                  setFilterId('');
                }}
                icon={<X className="w-3.5 h-3.5" />}
              >
                Clear Filter
              </Button>
            )}
          </div>

          {/* Session Types Legend */}
          <div className="flex items-center gap-x-4 gap-y-2 text-xs text-[#475569] flex-wrap border-t border-[#E2E8F0] pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#EEF5FA] border border-[#2C6A8A]" /> Lecture
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#EEF6F0] border border-[#2F7D4F]" /> Tutorial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#F4F0F9] border border-[#6B4E8C]" /> Lab (3h)
            </span>
            {isWeek7 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FCF2EC] border border-[#B0653E]" /> Fest Event
              </span>
            )}
          </div>
        </div>
      </Panel>

      {/* Class Summary Banner if Filtered by Group */}
      {classSummary && (
        <Panel variant="raised" className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#F5F7FB] border border-[#2563EB]/40 text-[#2563EB] font-sans font-bold text-sm flex items-center justify-center shrink-0">
              {filterId}
            </div>
            <div>
              <div className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
                <span>{classSummary.group?.name || filterId}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                  {classSummary.group?.department || 'Department Cohort'}
                </span>
                {classSummary.hasElectives && (
                  <StatusBadge status="brass" size="sm" label="Open Elective Basket" />
                )}
              </div>
              <div className="text-xs text-[#475569]">
                Cohort: {classSummary.group?.size || 60} Students · Academic Year {classSummary.group?.year || 2}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-[#F5F7FB] px-3 py-1.5 rounded-[6px] border border-[#E2E8F0]">
              <span className="text-[#64748B]">Sessions: </span>
              <strong className="text-[#172B4D]">{classSummary.sessionCount}/wk</strong>
            </div>
            <div className="bg-[#F5F7FB] px-3 py-1.5 rounded-[6px] border border-[#E2E8F0]">
              <span className="text-[#64748B]">Workload: </span>
              <strong className="text-[#2F7D4F]">{classSummary.totalHours} hrs/wk</strong>
            </div>
            <div className="bg-[#F5F7FB] px-3 py-1.5 rounded-[6px] border border-[#E2E8F0]">
              <span className="text-[#64748B]">Courses: </span>
              <strong className="text-[#172B4D]">{classSummary.coursesCount}</strong>
            </div>
          </div>
        </Panel>
      )}

      {/* Main Timetable Table Surface */}
      <Panel variant="default" padded={false} className="overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-xs text-[#475569] font-mono">
            Loading timetable schedule matrix...
          </div>
        ) : (
          <div className="campus-timetable-scroll overflow-x-auto max-h-[700px] overflow-y-auto" role="region" aria-label="Weekly timetable; scroll to view all periods" tabIndex={0}>
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] text-[#475569] text-xs font-mono">
                  <th className="p-3 font-semibold uppercase tracking-wider w-24 sticky left-0 bg-[#F1F5F9] z-30 border-r border-[#E2E8F0]">
                    Day
                  </th>
                  {periods.map((item, idx) => (
                    <th
                      key={idx}
                      className={`p-2.5 text-center font-semibold text-[11px] border-l border-[#E2E8F0] ${
                        item.p === 'LUNCH'
                          ? 'bg-[#FDF5E6] text-[#B7791F] w-20'
                          : typeof item.p === 'number' && item.p >= 10
                          ? 'bg-[#FCF2EC]/60 text-[#7D4323] w-28'
                          : 'text-[#172B4D] w-32'
                      }`}
                    >
                      <div>{item.label}</div>
                      <div className="text-[10px] font-normal text-[#64748B]">{item.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {days.map((day) => (
                  <tr key={day} className="hover:bg-[#F5F7FB]/60 transition-colors">
                    {/* Sticky Day Label */}
                    <td className="p-3 text-xs font-mono font-bold text-[#172B4D] sticky left-0 bg-[#FFFFFF] z-10 border-r border-[#E2E8F0]">
                      {day}
                    </td>

                    {/* Period Columns */}
                    {periods.map((item, pIdx) => {
                      if (item.p === 'LUNCH') {
                        return (
                          <td
                            key={pIdx}
                            className="bg-[#FDF5E6]/60 border-x border-[#E2E8F0] text-center text-[10px] text-[#B7791F] font-mono tracking-widest uppercase p-1 select-none"
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
                          className={`p-1.5 align-top border-l border-[#E2E8F0] min-h-[90px] ${
                            curP >= 10 ? 'bg-[#FCF2EC]/20' : ''
                          }`}
                        >
                          <div className="space-y-1.5">
                            {cellSessions.map((sess: any) => {
                              const isStart = sess.start_period === curP;
                              const isLab = sess.kind === 'lab';
                              const duration = sess.duration || 1;

                              return (
                                <div
                                  key={sess.session_id}
                                  onClick={() => handleSelectSession(sess)}
                                  className={`p-2 rounded-[6px] text-xs cursor-pointer transition-all hover:scale-[1.01] shadow-xs relative group ${getKindStyle(
                                    sess.kind,
                                    sess.is_event
                                  )} ${!isStart ? 'opacity-80 border-dashed' : ''}`}
                                >
                                  <div className="flex items-center justify-between font-bold text-[11px] truncate">
                                    <span className="truncate">{sess.course_id || sess.session_id}</span>
                                    <span className="font-mono text-[9px] px-1 rounded bg-black/10 shrink-0 ml-1">
                                      {sess.room_id}
                                    </span>
                                  </div>

                                  <div className="text-[10px] opacity-90 truncate mt-0.5">
                                    {sess.faculty_name || sess.faculty_id}
                                  </div>

                                  <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-black/10 opacity-75">
                                    <span className="capitalize">
                                      {isLab ? (isStart ? `Lab (${duration}h)` : 'Lab (Cont.)') : sess.kind}
                                    </span>
                                    {sess.groups && !isSingleClassView && (
                                      <span className="font-mono truncate max-w-[65px]">
                                        {sess.groups.join(',')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Displaced Notice for Spectra Week */}
                                  {sess.displaced_by && (
                                    <div className="text-[9px] font-semibold text-[#B3402F] bg-[#FBEFEF] border border-[#EFC5BF] px-1 py-0.5 rounded mt-1">
                                      Displaced by {sess.displaced_by}
                                    </div>
                                  )}

                                  {/* Authorized Move Button */}
                                  {canMove && isStart && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openMoveModal(sess);
                                      }}
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-[#FFFFFF] text-[#172B4D] hover:text-[#2563EB] border border-[#E2E8F0] transition-all shadow-xs cursor-pointer"
                                      title="Move this session"
                                      aria-label="Move this session"
                                    >
                                      <Move className="w-3 h-3" />
                                    </button>
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
      </Panel>

      {/* Drawer: Explain This Slot */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#FFFFFF] border-l border-[#E2E8F0] h-full p-6 overflow-y-auto space-y-5 shadow-[0_8px_30px_rgba(15,23,42,0.15)] animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-sans font-bold text-base text-[#172B4D]">
                  Slot Explanation & Why Here
                </h3>
                <span className="font-mono text-xs text-[#2563EB]">
                  {selectedSession.session_id} ({selectedSession.course_id})
                </span>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingExplain ? (
              <div className="text-center py-12 text-[#475569] text-xs font-mono">
                Evaluating deterministic constraint facts...
              </div>
            ) : explanation ? (
              <div className="space-y-4 text-xs">
                <Panel variant="sunken" className="p-3.5 leading-relaxed text-[#172B4D]">
                  {explanation.explanation_text}
                </Panel>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-xs text-[#172B4D] uppercase tracking-wider">
                    Placement Factors
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-[#475569]">
                    {explanation.reasons_for_placement.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-xs text-[#2F7D4F] uppercase tracking-wider">
                    Campus Conflicts Avoided
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-[#2F7D4F]">
                    {explanation.conflicts_avoided.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                {canMove && (
                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <Button
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={() => openMoveModal(selectedSession)}
                      icon={<Move className="w-4 h-4 text-[#2563EB]" />}
                    >
                      Move or Reassign Session
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal: Manual Move Session */}
      {moveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] max-w-lg w-full p-6 shadow-[0_8px_30px_rgba(15,23,42,0.15)] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-sans font-bold text-base text-[#172B4D]">Manual Placement Dialog</h3>
              <button
                onClick={() => setMoveModalOpen(false)}
                className="text-[#64748B] hover:text-[#172B4D] p-1 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <Label>Session ID</Label>
                <Input type="text" disabled value={targetSessionId} className="font-mono text-xs" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label>Target Day</Label>
                  <Select value={targetDay} onChange={(e) => setTargetDay(e.target.value)}>
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Start Period</Label>
                  <Select value={targetPeriod} onChange={(e) => setTargetPeriod(parseInt(e.target.value))}>
                    {[1, 2, 3, 4, 6, 7, 8, 9].map((p) => (
                      <option key={p} value={p}>P{p}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Target Room</Label>
                  {groupsData?.rooms ? (
                    <Select value={targetRoom} onChange={(e) => setTargetRoom(e.target.value)}>
                      {groupsData.rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.id}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={targetRoom}
                      onChange={(e) => setTargetRoom(e.target.value.toUpperCase())}
                    />
                  )}
                </div>
              </div>

              {moveResult && (
                <div
                  className={`p-3 rounded-[8px] border text-xs space-y-1 ${
                    moveResult.valid
                      ? 'bg-[#EBF5EE] border-[#C3E2CD] text-[#2F7D4F]'
                      : 'bg-[#FBEFEF] border-[#EFC5BF] text-[#B3402F]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {moveResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                    <span>{moveResult.valid ? 'Validated: 0 Hard Violations' : 'Placement Blocked'}</span>
                  </div>
                  <div>{moveResult.message}</div>
                  {moveResult.violations?.length > 0 && (
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {moveResult.violations.map((v: any, idx: number) => (
                        <li key={idx}>[{v.rule}] {v.detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
              <Button variant="secondary" size="md" onClick={() => setMoveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteMove}
                loading={isSubmittingMove}
              >
                Validate & Apply Move
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
