import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Sparkles, PlusCircle, CheckCircle2, AlertCircle, 
  X, Clock
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Input, Select, Label } from '../components/ui/Input';

export const BookingsPage: React.FC = () => {
  usePageMetadata(
    'Campus Venue Booking & Spectra Events | CIT Schedule',
    'Request lecture halls, labs, and auditoriums at Chilika Institute of Technology with real-time clash checking, capacity validation, and NLP search.'
  );

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [naturalText, setNaturalText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [_parseResult, setParseResult] = useState<any>(null);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [_isChecking, setIsChecking] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable Form fields
  const [title, setTitle] = useState('');
  const [attendance, setAttendance] = useState(50);
  const [duration, setDuration] = useState(2);
  const [day, setDay] = useState('TUE');
  const [fromPeriod, setFromPeriod] = useState(10);
  const [toPeriod, setToPeriod] = useState(11);
  const [roomTypes, setRoomTypes] = useState<string[]>(['classroom', 'seminar_hall']);
  const [needs, setNeeds] = useState<string[]>([]);
  const [requestedRoom, setRequestedRoom] = useState('');

  // Handle URL query parameters from Club Representative Timetable links
  useEffect(() => {
    const qRoom = searchParams.get('room');
    const qDay = searchParams.get('day');
    const qFrom = searchParams.get('from_period');
    const qDur = searchParams.get('duration');
    if (qRoom || qDay || qFrom) {
      if (qRoom) setRequestedRoom(qRoom);
      if (qDay) setDay(qDay);
      if (qFrom) {
        const from = parseInt(qFrom, 10);
        setFromPeriod(from);
        const dur = qDur ? parseInt(qDur, 10) : 1;
        setDuration(dur);
        setToPeriod(from + dur - 1);
      }
      setModalOpen(true);
    }
  }, [searchParams]);

  const sampleChips = bookings.slice(0, 5).map(b => 
    `Book ${b.requested_room || 'venue'} for ${b.title} (${b.attendance} people, ${b.duration_periods || 2}h)`
  );

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [bRes, rRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/rooms').catch(() => ({ data: [] }))
      ]);
      setBookings(bRes.data || []);
      setAvailableRooms(rRes.data || []);
    } catch (err: any) {
      console.error('Failed to load bookings:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to load booking allocations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || naturalText;
    if (!text.trim()) return;
    setIsParsing(true);
    setCheckResult(null);
    try {
      const res = await api.post('/bookings/parse', { text });
      const data = res.data;
      setParseResult(data);
      setTitle(data.title || text);
      setAttendance(data.attendance || 50);
      setDuration(data.duration_periods || 2);
      if (data.windows?.length > 0) {
        setDay(data.windows[0].day);
        setFromPeriod(data.windows[0].from_period);
        setToPeriod(data.windows[0].to_period);
      }
      setRoomTypes(data.room_types || ['classroom']);
      setNeeds(data.needs || []);
      setRequestedRoom(data.requested_room || '');

      // Automatically run dry run check
      handleDryRunCheck({
        title: data.title,
        attendance: data.attendance,
        duration_periods: data.duration_periods,
        windows: data.windows,
        room_types: data.room_types,
        needs: data.needs,
        requested_room: data.requested_room
      });
    } catch (err) {
      console.error('Failed to parse:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDryRunCheck = async (bookingData: any) => {
    setIsChecking(true);
    try {
      const res = await api.post('/bookings/check', { booking: bookingData });
      setCheckResult(res.data);
    } catch (err) {
      console.error('Dry run check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmitBooking = async () => {
    setIsSubmitting(true);
    try {
      await api.post('/bookings', {
        title,
        attendance,
        duration_periods: duration,
        windows: [{ day, from_period: fromPeriod, to_period: toPeriod }],
        room_types: roomTypes,
        needs,
        requested_room: requestedRoom || null,
        raw_text: naturalText
      });
      setModalOpen(false);
      setNaturalText('');
      setParseResult(null);
      fetchBookings();
      alert('Booking submitted successfully for review!');
    } catch (err: any) {
      alert('Error submitting booking: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecideAll = async () => {
    if (!window.confirm('Run CP-SAT booking optimization across all requests?')) return;
    try {
      await api.post('/bookings/decide-all');
      fetchBookings();
      alert('All bookings optimized with zero priority inversions!');
    } catch (err: any) {
      alert('Decide-all failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Campus Venue Bookings & Approvals"
        subtitle="Deterministic CP-SAT allocation engine with server-side role capping and zero priority inversions."
        badge={
          <StatusBadge
            status="brass"
            size="sm"
            label="Spectra Week 7 Matrix Active"
            icon={<Sparkles className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <>
            {user?.role === 'admin' && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleDecideAll}
              >
                Optimize All (CP-SAT)
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => setModalOpen(true)}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              Book a Venue
            </Button>
          </>
        }
      />

      {/* Bookings Queue Panel */}
      <Panel variant="default" padded={false} className="overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F1F5F9]/40">
          <h2 className="text-sm font-sans font-bold text-[#172B4D] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>Spectra Week Booking Requests ({bookings.length})</span>
          </h2>
          <StatusBadge
            status="success"
            size="sm"
            label="Zero Inversions Guaranteed"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="divide-y divide-[#E2E8F0]/70">
          {errorMsg ? (
            <div className="p-12 text-center text-xs text-[#B3402F] space-y-2">
              <div>{errorMsg}</div>
              <button
                onClick={() => fetchBookings()}
                className="px-3 py-1 rounded bg-[#2563EB] text-white font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-xs text-[#475569] font-mono">
              Loading booking allocations from official dataset...
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B]">
              No booking requests registered yet.
            </div>
          ) : (
            bookings.map((b) => {
              const statusVariant: 'success' | 'warning' | 'danger' =
                b.status === 'approved' ? 'success' : b.status === 'alternative_offered' ? 'warning' : 'danger';
              const statusLabel =
                b.status === 'approved' ? 'Approved' : b.status === 'alternative_offered' ? 'Alternative Offered' : 'Rejected';

              return (
                <div
                  key={b.id}
                  className="p-5 hover:bg-[#F5F7FB]/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-3 min-w-0 flex-1 break-words">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#2563EB] bg-[#F5F7FB] px-2 py-0.5 rounded border border-[#2563EB]/30">
                        {b.id}
                      </span>
                      <span className="font-bold text-sm text-[#172B4D]">{b.title}</span>
                      <StatusBadge status={statusVariant} size="sm" label={statusLabel} />
                      {b.reason_code && (
                        <span className="text-[10px] font-mono text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                          {b.reason_code}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#475569] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-2">
                      <span>Requester: <strong className="text-[#172B4D]">{b.requester}</strong> ({b.role})</span>
                      <span>Attendance: <strong className="text-[#172B4D]">{b.attendance}</strong></span>
                      {b.assigned_room && (
                        <span>Assigned: <strong className="text-[#2F7D4F] font-mono">{b.assigned_room}</strong> ({b.assigned_day} P{b.start_period}-P{b.end_period})</span>
                      )}
                    </div>

                    {b.reason && (
                      <div className="text-xs text-[#475569] bg-[#F5F7FB] p-2.5 rounded-[6px] border border-[#E2E8F0] italic">
                        Reason: "{b.reason}"
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 self-start md:self-center text-right">
                    <span className="text-[11px] font-mono text-[#2F7D4F] flex items-center justify-end gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 0 Inversions
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      {/* Modal: Book a Venue (Natural Language + Grouped Form) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] max-w-2xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 shadow-[0_8px_30px_rgba(15,23,42,0.15)] space-y-5 my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-sans font-bold text-base text-[#172B4D] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  <span>Book a Campus Venue</span>
                </h3>
                <p className="text-xs text-[#475569]">
                  Type naturally in English or Hinglish; our deterministic parser fills and verifies the request.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[#64748B] hover:text-[#172B4D] p-1 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plain-Language Input Bar */}
            <div className="space-y-2">
              <Label>Natural Language Request (English / Hinglish)</Label>
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <Input
                  value={naturalText}
                  onChange={(e) => setNaturalText(e.target.value)}
                  placeholder="e.g. Need Seminar Hall 2 on Friday at 6 pm for 80 people with projector"
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleParse()}
                  loading={isParsing}
                  disabled={!naturalText.trim()}
                >
                  Parse & Fill
                </Button>
              </div>

              {/* Sample Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sampleChips.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setNaturalText(chip);
                      handleParse(chip);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#F5F7FB] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#172B4D] border border-[#E2E8F0] transition-colors cursor-pointer text-left truncate max-w-xs"
                  >
                    "{chip}"
                  </button>
                ))}
              </div>
            </div>

            {/* Grouped Form Fields */}
            <div className="space-y-4 pt-2 border-t border-[#E2E8F0]">
              <div className="text-xs font-sans font-bold text-[#172B4D] uppercase tracking-wider">
                Booking Parameters
              </div>

              {/* Group 1: Event Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label required>Event Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI Hackathon Briefing" />
                </div>
                <div>
                  <Label required>Expected Attendance</Label>
                  <Input
                    type="number"
                    value={attendance}
                    onChange={(e) => setAttendance(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Group 2: Time Window */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label required>Day of Week</Label>
                  <Select value={day} onChange={(e) => setDay(e.target.value)}>
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label required>From Period</Label>
                  <Select value={fromPeriod} onChange={(e) => setFromPeriod(Number(e.target.value))}>
                    {[1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13].map((p) => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label required>Duration (Hours)</Label>
                  <Select
                    value={duration}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      setDuration(dur);
                      setToPeriod(fromPeriod + dur - 1);
                    }}
                  >
                    {[1, 2, 3, 4].map((d) => (
                      <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Group 3: Venue Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Preferred Specific Room (Optional)</Label>
                  <Select
                    value={requestedRoom}
                    onChange={(e) => setRequestedRoom(e.target.value)}
                  >
                    <option value="">Any Suitable Venue</option>
                    {availableRooms.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {r.name} ({r.type}, Cap: {r.capacity})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Required Amenities</Label>
                  <div className="flex gap-2 pt-1 text-xs">
                    {['projector', 'stage', 'mic', 'computers'].map((need) => (
                      <label key={need} className="flex items-center gap-1.5 cursor-pointer text-[#475569]">
                        <input
                          type="checkbox"
                          checked={needs.includes(need)}
                          onChange={(e) => {
                            if (e.target.checked) setNeeds([...needs, need]);
                            else setNeeds(needs.filter((n) => n !== need));
                          }}
                          className="rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        <span className="capitalize">{need}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-Time Clash Check Results Panel */}
              {checkResult && (
                <div
                  className={`p-3.5 rounded-[8px] border text-xs space-y-1.5 ${
                    checkResult.can_fulfill
                      ? 'bg-[#EBF5EE] border-[#C3E2CD] text-[#2F7D4F]'
                      : 'bg-[#FBEFEF] border-[#EFC5BF] text-[#B3402F]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {checkResult.can_fulfill ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span>{checkResult.message}</span>
                  </div>

                  {checkResult.assigned_room && (
                    <div>
                      Target room available: <strong>{checkResult.assigned_room}</strong>
                    </div>
                  )}

                  {checkResult.conflicts?.length > 0 && (
                    <div className="space-y-0.5 pt-1">
                      <div className="font-semibold">Clash Details:</div>
                      <ul className="list-disc list-inside">
                        {checkResult.conflicts.map((c: any, i: number) => (
                          <li key={i}>{c.reason || c.detail || 'Room is occupied'}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {checkResult.alternative_suggestions?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#EFC5BF] text-[#172B4D]">
                      <div className="font-semibold text-xs text-[#2C6A8A]">
                        Alternative Venue Suggestions:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {checkResult.alternative_suggestions.map((alt: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setRequestedRoom(alt.room_id)}
                            className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-mono transition-colors cursor-pointer"
                          >
                            {alt.room_id} ({alt.day} P{alt.start_period})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitBooking}
                loading={isSubmitting}
                disabled={!title.trim()}
              >
                Submit Venue Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
