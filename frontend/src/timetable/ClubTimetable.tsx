import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Building2, Calendar, Clock, Filter, ChevronLeft, ChevronRight, 
  Info, Sparkles, CheckCircle2, AlertTriangle, ShieldAlert,
  Search, Users, ExternalLink, HelpCircle, Layers, Check, X
} from 'lucide-react';

interface RoomCell {
  period: number | string;
  time: string;
  state: 'free' | 'class' | 'exam' | 'booked' | 'maintenance' | 'mine' | 'reserved_institute' | 'lunch';
  label: string;
  is_free: boolean;
  detail?: {
    title?: string;
    club_name?: string;
    status?: string;
    request_id?: string;
  } | null;
}

interface RoomMeta {
  id: string;
  name: string;
  building: string;
  type: string;
  capacity: number;
  features: string[];
  accessible: boolean;
  allowed_uses: string[];
  needs_coordinator_approval: boolean;
}

interface RoomData {
  room: RoomMeta;
  days: {
    [day: string]: RoomCell[];
  };
}

export const ClubTimetable: React.FC = () => {
  usePageMetadata(
    'Club Venue Availability & Timetable | CIT Schedule',
    'Explore campus venues, find free venue slots for Spectra week, and request space with transparent clash detection.'
  );

  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state: 'room_grid' (default) | 'all_rooms'
  const [activeTab, setActiveTab] = useState<'room_grid' | 'all_rooms'>('room_grid');

  // Availability dataset state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [availableClubs, setAvailableClubs] = useState<string[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [week, setWeek] = useState<number>(7);
  const [spectraBanner, setSpectraBanner] = useState<string | null>(
    "Spectra week: institute events have priority. Your request may be displaced."
  );

  // Room Grid (Tab 1) state
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number>(0);
  const [searchRoomQuery, setSearchRoomQuery] = useState<string>('');

  // Overview View (Tab 2) state
  const [overviewDay, setOverviewDay] = useState<string>('MON');
  const [showFindModal, setShowFindModal] = useState<boolean>(false);

  // Filters state
  const [filterDay, setFilterDay] = useState<string>('TUE');
  const [filterStartPeriod, setFilterStartPeriod] = useState<number>(10);
  const [filterDuration, setFilterDuration] = useState<number>(2);
  const [filterMinCapacity, setFilterMinCapacity] = useState<number>(0);
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterNeedsProjector, setFilterNeedsProjector] = useState<boolean>(false);
  const [filterNeedsAccessible, setFilterNeedsAccessible] = useState<boolean>(false);
  const [filterOnlyFullyFree, setFilterOnlyFullyFree] = useState<boolean>(true);

  // Room info slide-over modal state
  const [inspectedRoom, setInspectedRoom] = useState<RoomMeta | null>(null);

  // Cell multi-selection state for drag/multi-hour booking
  const [selectedCells, setSelectedCells] = useState<{ day: string; period: number; roomId: string }[]>([]);

  const [periodScope, setPeriodScope] = useState<'all' | 'evening'>('all');

  const daysList = week === 8 
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] 
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  const dayNames: { [key: string]: string } = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const ALL_PERIODS: { p: number | string; label: string; time: string; eventOnly?: boolean; isLunch?: boolean }[] = [
    { p: 1, label: 'P1', time: '08:00 - 09:00', eventOnly: false, isLunch: false },
    { p: 2, label: 'P2', time: '09:00 - 10:00', eventOnly: false, isLunch: false },
    { p: 3, label: 'P3', time: '10:00 - 11:00', eventOnly: false, isLunch: false },
    { p: 4, label: 'P4', time: '11:00 - 12:00', eventOnly: false, isLunch: false },
    { p: 5, label: 'P5', time: '12:00 - 13:00', eventOnly: false, isLunch: false },
    { p: 'LUNCH', label: 'Lunch', time: '13:00 - 14:00', eventOnly: false, isLunch: true },
    { p: 6, label: 'P6', time: '14:00 - 15:00', eventOnly: false, isLunch: false },
    { p: 7, label: 'P7', time: '15:00 - 16:00', eventOnly: false, isLunch: false },
    { p: 8, label: 'P8', time: '16:00 - 17:00', eventOnly: false, isLunch: false },
    { p: 9, label: 'P9', time: '17:00 - 18:00', eventOnly: false, isLunch: false },
    { p: 10, label: 'P10', time: '18:00 - 19:00', eventOnly: true, isLunch: false },
    { p: 11, label: 'P11', time: '19:00 - 20:00', eventOnly: true, isLunch: false },
    { p: 12, label: 'P12', time: '20:00 - 21:00', eventOnly: true, isLunch: false },
    { p: 13, label: 'P13', time: '21:00 - 22:00', eventOnly: true, isLunch: false },
  ];

  const EVENING_PERIODS: { p: number | string; label: string; time: string; eventOnly?: boolean; isLunch?: boolean }[] = [
    { p: 10, label: 'P10', time: '18:00 - 19:00', eventOnly: true, isLunch: false },
    { p: 11, label: 'P11', time: '19:00 - 20:00', eventOnly: true, isLunch: false },
    { p: 12, label: 'P12', time: '20:00 - 21:00', eventOnly: true, isLunch: false },
    { p: 13, label: 'P13', time: '21:00 - 22:00', eventOnly: true, isLunch: false },
  ];

  const periodsList = periodScope === 'all' ? ALL_PERIODS : EVENING_PERIODS;

  const fetchAvailability = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/rooms/availability?week=${week}&event_only=false`;
      if (selectedClub) {
        url += `&club=${encodeURIComponent(selectedClub)}`;
      }
      const res = await api.get(url);
      setRoomsData(res.data.rooms || []);
      setSpectraBanner(res.data.spectra_banner);
      if (res.data.available_clubs && res.data.available_clubs.length > 0) {
        setAvailableClubs(res.data.available_clubs);
        if (!selectedClub && user?.club_name && user.club_name !== 'Student Clubs') {
          setSelectedClub(user.club_name);
        }
      }
    } catch (err: any) {
      console.error('Failed to load room availability:', err);
      setError(err.response?.data?.detail || 'Failed to load room availability data. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [week, selectedClub]);

  const currentRoomData = roomsData[selectedRoomIndex] || null;

  // Handle previous / next room navigation
  const handlePrevRoom = () => {
    setSelectedRoomIndex((prev) => (prev > 0 ? prev - 1 : roomsData.length - 1));
    setSelectedCells([]);
  };

  const handleNextRoom = () => {
    setSelectedRoomIndex((prev) => (prev < roomsData.length - 1 ? prev + 1 : 0));
    setSelectedCells([]);
  };

  // Filtered rooms for the search dropdown
  const filteredRooms = roomsData.filter((r) => {
    if (!searchRoomQuery.trim()) return true;
    const q = searchRoomQuery.toLowerCase();
    return (
      r.room.id.toLowerCase().includes(q) ||
      r.room.name.toLowerCase().includes(q) ||
      r.room.type.toLowerCase().includes(q) ||
      r.room.building.toLowerCase().includes(q)
    );
  });

  // Cell Click -> Navigate into booking form with pre-filled parameters
  const handleCellClick = (room: RoomMeta, day: string, cell: RoomCell) => {
    if (!cell.is_free) return;
    const pNum = typeof cell.period === 'number' ? cell.period : 1;
    
    // Check if cell is part of multi-select
    if (selectedCells.length > 0 && selectedCells[0].day === day && selectedCells[0].roomId === room.id) {
      const periods = selectedCells.map((c) => c.period).sort((a, b) => a - b);
      const minP = periods[0];
      const maxP = periods[periods.length - 1];
      const duration = maxP - minP + 1;
      navigate(`/bookings?room=${room.id}&day=${day}&from_period=${minP}&duration=${duration}`);
    } else {
      navigate(`/bookings?room=${room.id}&day=${day}&from_period=${pNum}&duration=1`);
    }
  };

  // Toggle cell selection for multi-hour slot
  const handleCellSelect = (room: RoomMeta, day: string, period: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const existingIndex = selectedCells.findIndex(
      (c) => c.roomId === room.id && c.day === day && c.period === period
    );

    if (existingIndex >= 0) {
      setSelectedCells((prev) => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      if (selectedCells.length > 0 && (selectedCells[0].day !== day || selectedCells[0].roomId !== room.id)) {
        // Reset if switching column or room
        setSelectedCells([{ day, period, roomId: room.id }]);
      } else {
        setSelectedCells((prev) => [...prev, { day, period, roomId: room.id }]);
      }
    }
  };

  // Helper to determine styling for each cell state
  const getCellStateStyle = (
    state: RoomCell['state'],
    isSelected: boolean
  ): { bg: string; text: string; border: string; badge: string; pattern?: boolean } => {
    if (isSelected) {
      return {
        bg: 'bg-[#FAF6EC] ring-2 ring-[#B08A3E]',
        text: 'text-[#B08A3E] font-bold',
        border: 'border-[#B08A3E]',
        badge: 'bg-[#B08A3E] text-white font-bold',
      };
    }

    switch (state) {
      case 'free':
        return {
          bg: 'bg-[#EBF5EE] hover:bg-[#DDF0E2] hover:border-[#2F7D4F]/50 cursor-pointer transition-all',
          text: 'text-[#2F7D4F] font-semibold',
          border: 'border-[#C3E2CD]',
          badge: 'bg-[#EBF5EE] text-[#2F7D4F] border border-[#C3E2CD]',
        };
      case 'class':
        return {
          bg: 'bg-[#EEF5FA]',
          text: 'text-[#1D4D65]',
          border: 'border-[#C6DFEB]',
          badge: 'bg-[#EEF5FA] text-[#1D4D65] border border-[#C6DFEB]',
        };
      case 'exam':
        return {
          bg: 'bg-[#FAF4E6]',
          text: 'text-[#7A4F10] font-semibold',
          border: 'border-[#EBD19E]',
          badge: 'bg-[#FAF4E6] text-[#7A4F10] border border-[#EBD19E]',
        };
      case 'booked':
        return {
          bg: 'bg-[#FBEFEF]',
          text: 'text-[#B3402F] font-semibold',
          border: 'border-[#EFC5BF]',
          badge: 'bg-[#FBEFEF] text-[#B3402F] border border-[#EFC5BF]',
        };
      case 'maintenance':
        return {
          bg: 'bg-[#FBEFEF]',
          text: 'text-[#B3402F] font-medium italic',
          border: 'border-[#EFC5BF]',
          badge: 'bg-[#FBEFEF] text-[#B3402F] border border-[#EFC5BF]',
          pattern: true,
        };
      case 'mine':
        return {
          bg: 'bg-[#FAF6EC] border-[#B08A3E] ring-1 ring-[#B08A3E]/40',
          text: 'text-[#9A7633] font-bold',
          border: 'border-[#B08A3E]',
          badge: 'bg-[#B08A3E] text-white font-bold',
        };
      case 'reserved_institute':
        return {
          bg: 'bg-[#FDF5E6] border-[#EBD19E]',
          text: 'text-[#B7791F] font-semibold',
          border: 'border-[#EBD19E]',
          badge: 'bg-[#FDF5E6] text-[#B7791F] border border-[#EBD19E]',
        };
      case 'lunch':
        return {
          bg: 'bg-[#F2ECDC]',
          text: 'text-[#7C877F] text-xs italic',
          border: 'border-[#E4DBC6]',
          badge: 'bg-[#F2ECDC] text-[#7C877F]',
        };
      default:
        return {
          bg: 'bg-[#FFFDF8]',
          text: 'text-[#55625A]',
          border: 'border-[#E4DBC6]',
          badge: 'bg-[#F2ECDC] text-[#55625A]',
        };
    }
  };

  // Find Free Rooms calculation for Tab 2
  const matchingFreeRooms = roomsData.filter((r) => {
    const meta = r.room;
    if (filterMinCapacity > 0 && meta.capacity < filterMinCapacity) return false;
    if (filterRoomType !== 'all' && meta.type !== filterRoomType) return false;
    if (filterNeedsProjector && !meta.features.includes('projector')) return false;
    if (filterNeedsAccessible && !meta.accessible) return false;

    if (filterOnlyFullyFree) {
      const dayCells = r.days[filterDay] || [];
      const requiredPeriods = Array.from(
        { length: filterDuration },
        (_, i) => filterStartPeriod + i
      );
      for (const p of requiredPeriods) {
        const cell = dayCells.find((c) => c.period === p);
        if (!cell || !cell.is_free) return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Spectra Banner */}
      {spectraBanner && (
        <div className="p-4 rounded-xl border border-[#E9D9AE] bg-[#FCF7E8] text-[#1F2A24] flex items-start gap-3 shadow-sm">
          <Sparkles className="w-5 h-5 text-[#B08A3E] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF4E6] text-[#B08A3E] border border-[#E9D9AE]">
                Spectra Fest Week 7
              </span>
              <span className="text-xs text-[#55625A]">Master Allocation Active</span>
            </div>
            <p className="text-sm text-[#1F2A24] mt-1 font-medium">{spectraBanner}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-[#55625A] block">Cap Rule: B2</span>
            <span className="text-xs font-mono text-[#B08A3E] font-semibold">Max 2 approved events</span>
          </div>
        </div>
      )}

      {/* Header with Title & Active Club Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-5 rounded-2xl border border-[#E4DBC6]">
        <div>
          <div className="flex items-center gap-2 text-[#B08A3E] text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            Club Representative Venue Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A24] tracking-tight">
            Venue Availability & Schedule
          </h1>
          <p className="text-xs sm:text-sm text-[#55625A] mt-0.5">
            Bookable event periods (P10–P13 · 18:00–22:00). Click any <strong className="text-emerald-400">Free</strong> slot to launch Book Venue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Week Toggle */}
          <div className="flex items-center bg-[#FFFDF8] border border-[#E4DBC6] rounded-xl p-1 text-xs">
            <button
              onClick={() => setWeek(7)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                week === 7 ? 'bg-[#B08A3E] text-[#1F2A24] shadow-sm' : 'text-[#55625A] hover:text-[#1F2A24]'
              }`}
            >
              Week 7 (Fest)
            </button>
            <button
              onClick={() => setWeek(1)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                week === 1 ? 'bg-[#B08A3E] text-[#1F2A24] shadow-sm' : 'text-[#55625A] hover:text-[#1F2A24]'
              }`}
            >
              Week 1 (Academic)
            </button>
            <button
              onClick={() => setWeek(8)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                week === 8 ? 'bg-[#B08A3E] text-[#1F2A24] shadow-sm' : 'text-[#55625A] hover:text-[#1F2A24]'
              }`}
            >
              Week 8 (Exams)
            </button>
          </div>

          {/* Active Club Selector */}
          {availableClubs.length > 0 && (
            <div className="flex items-center gap-2 bg-[#FFFDF8] border border-[#E4DBC6] rounded-xl px-3 py-1.5 text-xs">
              <Users className="w-3.5 h-3.5 text-[#B08A3E]" />
              <span className="text-[#55625A]">My Club:</span>
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="bg-transparent text-[#1F2A24] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#FFFDF8] text-[#1F2A24]">
                  Select Club ({availableClubs.length} active)
                </option>
                {availableClubs.map((c) => (
                  <option key={c} value={c} className="bg-[#FFFDF8] text-[#1F2A24]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Direct Link to Bookings */}
          <button
            onClick={() => navigate('/bookings')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[#1F2A24] text-xs font-bold shadow-lg shadow-purple-600/25 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Book Venue
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-[#E4DBC6] text-sm font-semibold">
        <button
          onClick={() => setActiveTab('room_grid')}
          className={`flex items-center gap-2 pb-3 px-4 border-b-2 transition-all ${
            activeTab === 'room_grid'
              ? 'border-[#B08A3E]/40 text-[#B08A3E]'
              : 'border-transparent text-[#55625A] hover:text-[#1F2A24]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Weekly Room Grid
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECDC] text-[#1F2A24] font-mono">
            One Room
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all_rooms')}
          className={`flex items-center gap-2 pb-3 px-4 border-b-2 transition-all ${
            activeTab === 'all_rooms'
              ? 'border-[#B08A3E]/40 text-[#B08A3E]'
              : 'border-transparent text-[#55625A] hover:text-[#1F2A24]'
          }`}
        >
          <Layers className="w-4 h-4" />
          All Rooms at a Glance
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECDC] text-[#1F2A24] font-mono">
            Campus Day Matrix
          </span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-12 text-center rounded-2xl border border-[#E4DBC6]">
          <div className="w-10 h-10 border-4 border-[#B08A3E]/40 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-[#1F2A24] font-medium">Scanning campus room availability...</p>
          <p className="text-xs text-[#7C877F] mt-1">Applying privacy filters & fest displacements</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-6 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-[#1F2A24]">Failed to Load Availability</h3>
          <p className="text-xs text-rose-300 mt-1">{error}</p>
          <button
            onClick={fetchAvailability}
            className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-[#1F2A24] text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ROOM GRID (Main View: Weekly Grid for One Room at a Time)           */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'room_grid' && currentRoomData && (
        <div className="space-y-4">
          {/* Room Selector & Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-4 rounded-xl border border-[#E4DBC6]">
            {/* Prev / Next Room Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevRoom}
                className="p-2 rounded-lg bg-[#FFFDF8] border border-[#E4DBC6] hover:border-[#D5C9AE] hover:bg-[#F2ECDC] text-[#1F2A24] hover:text-[#1F2A24] transition-all"
                title="Previous Room"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextRoom}
                className="p-2 rounded-lg bg-[#FFFDF8] border border-[#E4DBC6] hover:border-[#D5C9AE] hover:bg-[#F2ECDC] text-[#1F2A24] hover:text-[#1F2A24] transition-all"
                title="Next Room"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Room Dropdown / Search */}
              <div className="relative">
                <select
                  value={currentRoomData.room.id}
                  onChange={(e) => {
                    const idx = roomsData.findIndex((r) => r.room.id === e.target.value);
                    if (idx >= 0) {
                      setSelectedRoomIndex(idx);
                      setSelectedCells([]);
                    }
                  }}
                  className="bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-[#B08A3E]/40 cursor-pointer pr-8"
                >
                  {roomsData.map((r, i) => (
                    <option key={r.room.id} value={r.room.id} className="bg-[#FFFDF8] text-[#1F2A24]">
                      {r.room.id} · {r.room.name} ({r.room.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Info Click Button */}
              <button
                onClick={() => setInspectedRoom(currentRoomData.room)}
                className="p-2 rounded-lg bg-[#B08A3E]/10 border border-[#B08A3E]/40/20 text-[#B08A3E] hover:bg-[#B08A3E]/20 transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="View Room Specifications"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Room Info</span>
              </button>
            </div>

            {/* Room Summary Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] text-[#1F2A24] border border-[#E4DBC6] font-medium">
                {currentRoomData.room.building}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] text-[#1F2A24] border border-[#E4DBC6] capitalize">
                {currentRoomData.room.type.replace('_', ' ')}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] text-sky-400 border border-[#E4DBC6] font-bold font-mono">
                {currentRoomData.room.capacity} Seats
              </span>
              {currentRoomData.room.accessible && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                  Wheelchair Accessible
                </span>
              )}
              {currentRoomData.room.needs_coordinator_approval && (
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                  Lab: Coord Approval Req
                </span>
              )}
            </div>
          </div>

          {/* Multi-Selection Action Bar (If user selected cells) */}
          {selectedCells.length > 0 && (
            <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
              <div className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Selected <strong>{selectedCells.length} hour(s)</strong> on{' '}
                  <strong>{dayNames[selectedCells[0].day]}</strong> ({currentRoomData.room.id})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCells([])}
                  className="px-2 py-1 rounded text-xs text-[#55625A] hover:text-[#1F2A24]"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    const sorted = [...selectedCells].sort((a, b) => a.period - b.period);
                    const startP = sorted[0].period;
                    const dur = sorted[sorted.length - 1].period - startP + 1;
                    navigate(
                      `/bookings?room=${currentRoomData.room.id}&day=${sorted[0].day}&from_period=${startP}&duration=${dur}`
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[#1F2A24] text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Book Selected Slot
                </button>
              </div>
            </div>
          )}

          {/* Weekly Timetable Grid */}
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] rounded-2xl border border-[#E4DBC6] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-[#FFFDF8] border-b border-[#E4DBC6] text-[#55625A] text-left">
                    <th className="p-3 w-36 font-semibold uppercase tracking-wider text-[11px] border-r border-[#E4DBC6]">
                      Period / Time
                    </th>
                    {daysList.map((d) => (
                      <th key={d} className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center border-r border-[#E4DBC6] last:border-r-0">
                        <div className="text-[#1F2A24] font-bold">{dayNames[d]}</div>
                        <div className="text-[10px] text-[#55625A] font-mono">{d}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC6]">
                  {periodsList.map((per) => {
                    return (
                      <tr key={`p-${per.p}`} className="hover:bg-[#FFFDF8]/30 transition-colors">
                        {/* Period & Time header */}
                        <td className="p-3 border-r border-[#E4DBC6] font-mono text-[#55625A] bg-[#FFFDF8]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1F2A24] text-xs">{per.label}</span>
                            {per.eventOnly && (
                              <span className="text-[9px] px-1 rounded bg-[#B08A3E]/20 text-[#B08A3E] font-semibold">
                                Fest
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#55625A] mt-0.5">{per.time}</div>
                        </td>

                        {/* Columns for Monday to Friday */}
                        {daysList.map((d) => {
                          const dayCells = currentRoomData.days[d] || [];
                          const cell = dayCells.find((c) => c.period === per.p) || {
                            period: per.p,
                            time: per.time,
                            state: 'free',
                            label: 'Free',
                            is_free: true,
                          };

                          const isSelected = selectedCells.some(
                            (sc) => sc.roomId === currentRoomData.room.id && sc.day === d && sc.period === per.p
                          );

                          const style = getCellStateStyle(cell.state, isSelected);

                          return (
                            <td
                              key={`${d}-${per.p}`}
                              onClick={() => handleCellClick(currentRoomData.room, d, cell)}
                              className={`p-2 border-r border-[#E4DBC6] last:border-r-0 text-center relative group ${style.bg}`}
                              title={
                                cell.is_free
                                  ? `Click to book ${currentRoomData.room.id} on ${dayNames[d]} at ${per.time}`
                                  : cell.label
                              }
                            >
                              <div className="flex flex-col items-center justify-center min-h-[46px] p-1">
                                <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${style.badge}`}>
                                  {cell.label}
                                </span>

                                {cell.state === 'mine' && cell.detail && (
                                  <div className="text-[10px] text-[#B08A3E] font-bold mt-1 max-w-[120px] truncate">
                                    {cell.detail.club_name}
                                    <span className="block text-[9px] text-[#B08A3E] capitalize">
                                      ({cell.detail.status})
                                    </span>
                                  </div>
                                )}

                                {cell.is_free && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    Book
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL ROOMS AT A GLANCE (Campus-wide Day Overview Matrix)            */}
      {/* ========================================================================= */}
      {!loading && !error && activeTab === 'all_rooms' && (
        <div className="space-y-4">
          {/* Day Selector & Find Free Rooms Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-4 rounded-xl border border-[#E4DBC6]">
            {/* Day Selector Buttons */}
            <div className="flex items-center gap-1 bg-[#FFFDF8] p-1 rounded-xl border border-[#E4DBC6]">
              {daysList.map((d) => (
                <button
                  key={d}
                  onClick={() => setOverviewDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    overviewDay === d
                      ? 'bg-[#B08A3E] text-[#1F2A24] shadow-sm'
                      : 'text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]'
                  }`}
                >
                  {dayNames[d]} ({d})
                </button>
              ))}
            </div>

            {/* Find Free Rooms Button */}
            <button
              onClick={() => setShowFindModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-[#1F2A24] text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Search className="w-4 h-4" />
              Find Free Rooms Filter
            </button>
          </div>

          {/* Campus Day Table (Rows: Rooms, Columns: P1 to P13) */}
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] rounded-2xl border border-[#E4DBC6] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px] text-xs">
                <thead>
                  <tr className="bg-[#FFFDF8] border-b border-[#E4DBC6] text-[#55625A] text-left">
                    <th className="p-3 w-40 font-semibold uppercase tracking-wider text-[11px] border-r border-[#E4DBC6] sticky left-0 bg-[#FFFDF8] z-10">
                      Room / Capacity
                    </th>
                    {periodsList.map((per) => (
                      <th
                        key={per.label}
                        className="p-2.5 font-semibold uppercase tracking-wider text-[10px] text-center border-r border-[#E4DBC6] last:border-r-0"
                      >
                        <div className="text-[#1F2A24] font-bold">{per.label}</div>
                        <div className="text-[9px] text-[#55625A]">{per.time.split(' - ')[0]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC6]">
                  {roomsData.map((r) => {
                    const dayCells = r.days[overviewDay] || [];

                    return (
                      <tr key={r.room.id} className="hover:bg-[#FFFDF8]/30 transition-colors">
                        {/* Sticky Room Info */}
                        <td className="p-2.5 border-r border-[#E4DBC6] bg-[#FAF6EC]/90 sticky left-0 z-10">
                          <button
                            onClick={() => setInspectedRoom(r.room)}
                            className="text-left group"
                          >
                            <div className="font-bold text-[#1F2A24] group-hover:text-[#B08A3E] transition-colors flex items-center gap-1">
                              {r.room.id}
                              <Info className="w-3 h-3 text-[#7C877F] group-hover:text-[#B08A3E]" />
                            </div>
                            <div className="text-[10px] text-[#55625A] truncate max-w-[130px]">
                              {r.room.name}
                            </div>
                            <div className="text-[10px] font-mono text-sky-400 font-semibold">
                              {r.room.capacity} seats · <span className="capitalize">{r.room.type}</span>
                            </div>
                          </button>
                        </td>

                        {/* Periods */}
                        {periodsList.map((per) => {
                          const cell = dayCells.find((c) => c.period === per.p) || {
                            period: per.p,
                            time: per.time,
                            state: 'free',
                            label: 'Free',
                            is_free: true,
                          };

                          const style = getCellStateStyle(cell.state, false);

                          return (
                            <td
                              key={`p-${per.p}`}
                              onClick={() => handleCellClick(r.room, overviewDay, cell)}
                              className={`p-1.5 border-r border-[#E4DBC6] last:border-r-0 text-center ${style.bg}`}
                              title={
                                cell.is_free
                                  ? `Click to book ${r.room.id} on ${dayNames[overviewDay]} at ${per.time}`
                                  : cell.label
                              }
                            >
                              <div className="flex flex-col items-center justify-center min-h-[38px]">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${style.badge}`}>
                                  {cell.label}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COLOUR LEGEND (Always visible under the grid as required by UI notes)      */}
      {/* ========================================================================= */}
      <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-4 rounded-xl border border-[#E4DBC6] text-xs">
        <div className="text-xs font-bold text-[#1F2A24] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-[#B08A3E]" />
          Availability Status Legend
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/60">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Free</div>
              <div className="text-[10px] text-emerald-400">Clickable to Book</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FFFDF8] border border-[#E4DBC6]">
            <span className="w-3 h-3 rounded-full bg-[#7C877F] shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Class</div>
              <div className="text-[10px] text-[#55625A]">Regular Academic</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF4E6] border border-[#E4DBC6]">
            <span className="w-3 h-3 rounded-full bg-[#B7791F] shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Exam</div>
              <div className="text-[10px] text-[#B7791F]">Midsem Window</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FCF2EC] border border-[#E4DBC6]">
            <span className="w-3 h-3 rounded-full bg-[#B08A3E] shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Booked</div>
              <div className="text-[10px] text-[#B08A3E]">Other Event</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FDF2F0] border border-[#F3C5BD]">
            <span className="w-3 h-3 rounded-full bg-[#B3402F] shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Unavailable</div>
              <div className="text-[10px] text-[#B3402F]">Maintenance/Repair</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#EEF5FA] border border-[#B08A3E]">
            <span className="w-3 h-3 rounded-full bg-[#2C6A8A] shrink-0 ring-2 ring-[#B08A3E]"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">My Booking</div>
              <div className="text-[10px] text-[#2C6A8A]">Own Club (Detail)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F2ECDC] border border-[#E4DBC6]">
            <span className="w-3 h-3 rounded-full bg-[#7C877F] shrink-0"></span>
            <div>
              <div className="text-[#1F2A24] font-bold">Lunch</div>
              <div className="text-[10px] text-[#55625A]">13:00 - 14:00 (Break)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROOM INFO SLIDE-OVER MODAL                                                */}
      {/* ========================================================================= */}
      {inspectedRoom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-6 rounded-2xl border border-[#E4DBC6] bg-[#FAF6EC] max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setInspectedRoom(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#FFFDF8] text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#B08A3E]/20 text-[#B08A3E] border border-[#B08A3E]/40/30">
                  {inspectedRoom.id}
                </span>
                <span className="text-xs text-[#55625A] font-medium">{inspectedRoom.building}</span>
              </div>
              <h2 className="text-xl font-extrabold text-[#1F2A24] mt-1">{inspectedRoom.name}</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#E4DBC6]">
                <span className="text-[#55625A]">Seating Capacity</span>
                <span className="text-[#1F2A24] font-bold font-mono">{inspectedRoom.capacity} Attendees</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E4DBC6]">
                <span className="text-[#55625A]">Venue Category</span>
                <span className="text-[#1F2A24] font-semibold capitalize">
                  {inspectedRoom.type.replace('_', ' ')}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E4DBC6]">
                <span className="text-[#55625A]">Accessibility</span>
                <span className={inspectedRoom.accessible ? 'text-emerald-400 font-semibold' : 'text-[#7C877F]'}>
                  {inspectedRoom.accessible ? '✓ Wheelchair Accessible' : 'Standard Access'}
                </span>
              </div>

              <div className="py-1.5 border-b border-[#E4DBC6]">
                <span className="text-[#55625A] block mb-1">Installed Equipment & Features</span>
                <div className="flex flex-wrap gap-1">
                  {inspectedRoom.features.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] capitalize text-[10px]"
                    >
                      {f.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Lab Approval Warning */}
              {inspectedRoom.needs_coordinator_approval && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Special Approval Required
                  </div>
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    This is a laboratory venue. Club booking requests for this room require departmental coordinator approval.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setInspectedRoom(null)}
                className="flex-1 py-2 rounded-xl bg-[#FFFDF8] hover:bg-[#F2ECDC] text-[#1F2A24] text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setInspectedRoom(null);
                  navigate(`/bookings?room=${inspectedRoom.id}`);
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[#1F2A24] text-xs font-bold"
              >
                Book This Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* "FIND FREE ROOMS" FILTER MODAL (Page 2 Requirement)                       */}
      {/* ========================================================================= */}
      {showFindModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)] p-6 rounded-2xl border border-[#E4DBC6] bg-[#FAF6EC] max-w-2xl w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowFindModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#FFFDF8] text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                Intelligent Venue Finder
              </div>
              <h2 className="text-xl font-extrabold text-[#1F2A24]">Find Free Rooms for My Event</h2>
              <p className="text-xs text-[#55625A] mt-0.5">
                Narrow down the campus to rooms that are guaranteed free for your target slot and capacity.
              </p>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Day */}
              <div>
                <label className="block text-[#1F2A24] font-semibold mb-1">Day of Event</label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                >
                  {daysList.map((d) => (
                    <option key={d} value={d}>
                      {dayNames[d]} ({d})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Slot Range */}
              <div>
                <label className="block text-[#1F2A24] font-semibold mb-1">
                  Start Period & Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterStartPeriod}
                    onChange={(e) => {
                      const newStart = parseInt(e.target.value);
                      setFilterStartPeriod(newStart);
                      if (newStart + filterDuration - 1 > 13) {
                        setFilterDuration(14 - newStart);
                      }
                    }}
                    className="bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] rounded-lg p-2 focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {[10, 11, 12, 13].map((p) => (
                      <option key={p} value={p}>
                        P{p} ({18 + (p - 10)}:00)
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterDuration}
                    onChange={(e) => setFilterDuration(parseInt(e.target.value))}
                    className="bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] rounded-lg p-2 focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {Array.from({ length: 14 - filterStartPeriod }, (_, i) => i + 1).map((dur) => (
                      <option key={dur} value={dur}>
                        {dur} {dur === 1 ? 'hour' : 'hours'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Min Capacity */}
              <div>
                <label className="block text-[#1F2A24] font-semibold mb-1">
                  Minimum Capacity (Expected Attendees)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={filterMinCapacity}
                  onChange={(e) => setFilterMinCapacity(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 80"
                  className="w-full bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] rounded-lg p-2 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Room Type */}
              <div>
                <label className="block text-[#1F2A24] font-semibold mb-1">Venue Type</label>
                <select
                  value={filterRoomType}
                  onChange={(e) => setFilterRoomType(e.target.value)}
                  className="w-full bg-[#FFFDF8] border border-[#E4DBC6] text-[#1F2A24] rounded-lg p-2 focus:outline-none focus:border-emerald-500 capitalize"
                >
                  <option value="all">All Room Types</option>
                  <option value="classroom">Classroom</option>
                  <option value="seminar_hall">Seminar Hall</option>
                  <option value="auditorium">Auditorium</option>
                  <option value="outdoor">Open-air Theatre (OAT)</option>
                  <option value="lab">Computer / Science Lab</option>
                </select>
              </div>

              {/* Features check */}
              <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[#1F2A24]">
                  <input
                    type="checkbox"
                    checked={filterNeedsProjector}
                    onChange={(e) => setFilterNeedsProjector(e.target.checked)}
                    className="rounded bg-[#FFFDF8] border-[#D5C9AE] text-emerald-500 focus:ring-0"
                  />
                  <span>Requires Projector</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#1F2A24]">
                  <input
                    type="checkbox"
                    checked={filterNeedsAccessible}
                    onChange={(e) => setFilterNeedsAccessible(e.target.checked)}
                    className="rounded bg-[#FFFDF8] border-[#D5C9AE] text-emerald-500 focus:ring-0"
                  />
                  <span>Wheelchair Accessible</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-emerald-300 font-bold">
                  <input
                    type="checkbox"
                    checked={filterOnlyFullyFree}
                    onChange={(e) => setFilterOnlyFullyFree(e.target.checked)}
                    className="rounded bg-[#FFFDF8] border-[#D5C9AE] text-emerald-500 focus:ring-0"
                  />
                  <span>Show only rooms free for my whole slot</span>
                </label>
              </div>
            </div>

            {/* Results Counter */}
            <div className="pt-2 border-t border-[#E4DBC6]">
              <div className="text-xs font-semibold text-[#1F2A24] mb-2">
                Matching Free Rooms: <span className="text-emerald-400 font-bold">{matchingFreeRooms.length}</span> found
              </div>

              {matchingFreeRooms.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#FFFDF8] text-center text-xs text-[#55625A]">
                  No rooms match your filter criteria for this slot. Try lowering capacity or shifting the time window.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {matchingFreeRooms.map((r) => (
                    <div
                      key={r.room.id}
                      className="p-2.5 rounded-xl bg-[#FFFDF8] border border-[#E4DBC6] hover:border-emerald-500/40 flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="font-bold text-[#1F2A24] flex items-center gap-2">
                          <span>{r.room.id}</span>
                          <span className="text-[10px] text-[#55625A] font-normal">· {r.room.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {r.room.capacity} seats
                          </span>
                        </div>
                        <div className="text-[10px] text-[#55625A] flex items-center gap-2 mt-0.5">
                          <span>{r.room.building}</span>
                          <span>·</span>
                          <span className="capitalize">{r.room.type}</span>
                          {r.room.accessible && <span>· Accessible</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setShowFindModal(false);
                          navigate(
                            `/bookings?room=${r.room.id}&day=${filterDay}&from_period=${filterStartPeriod}&duration=${filterDuration}`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[#1F2A24] text-xs font-bold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1"
                      >
                        Book
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFindModal(false)}
                className="px-4 py-2 rounded-xl bg-[#FFFDF8] hover:bg-[#F2ECDC] text-[#1F2A24] text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

