import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { usePageMetadata } from '../lib/usePageMetadata';
import { Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';

export const ExamsPage: React.FC = () => {
  usePageMetadata(
    'Midsem Examination Calendar & Seating | CIT Schedule',
    'Chilika Institute of Technology midsem examination schedule with strict half-capacity seating arithmetic across 12 AM/PM slots with zero clashes.'
  );

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<string>('ALL');

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      try {
        const res = await api.get('/exams/schedule');
        setExams(res.data);
      } catch (err) {
        console.error('Failed to load exams:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const filteredExams = selectedDay === 'ALL'
    ? exams
    : exams.filter((e) => e.day === selectedDay);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Midsem Examination Schedule"
        subtitle={`${exams.length} examinations scheduled across 12 slots (Mon-Sat AM/PM) with strict half-capacity seating arithmetic and zero same-day clashes.`}
        badge={
          <StatusBadge
            status="brass"
            size="sm"
            label="Examination Matrix Active"
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-1 max-w-full bg-[#FFFFFF] p-1 rounded-[8px] border border-[#E2E8F0] overflow-x-auto">
            <button
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedDay === 'ALL'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                  : 'text-[#475569] hover:text-[#172B4D] hover:bg-[#F1F5F9]'
              }`}
            >
              All Days
            </button>
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedDay === d
                    ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                    : 'text-[#475569] hover:text-[#172B4D] hover:bg-[#F1F5F9]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        }
      />

      {/* Arithmetic Callout Card */}
      <Panel variant="sunken" padded={false} className="p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#2F7D4F] shrink-0" />
          <div>
            <div className="font-sans font-bold text-[#172B4D] text-sm">
              Half-Capacity Seating Integrity Rule
            </div>
            <div className="text-xs text-[#475569] mt-0.5">
              Every venue seats exactly <code className="text-[#172B4D] font-mono font-semibold">capacity // 2</code> students to maintain examination spacing and prevent collisions.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <StatusBadge status="success" size="sm" label={`${exams.length} Exams Scheduled`} />
          <StatusBadge status="info" size="sm" label="0 Same-Day Group Clashes" />
        </div>
      </Panel>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#475569] font-mono">
          Loading midsem exam schedule...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#64748B]">
          No exams scheduled on {selectedDay}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
          {filteredExams.map((ex) => (
            <div
              key={ex.exam_id}
              className="bg-[#FFFFFF] p-5 rounded-[10px] border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all gap-5 flex flex-col justify-between min-w-0"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#7A4F10] bg-[#FAF4E6] px-2 py-0.5 rounded border border-[#EBD19E]">
                      {ex.exam_id}
                    </span>
                    <div className="text-sm font-bold text-[#172B4D] mt-2 break-words">
                      {ex.course_ids.join(' & ')}
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-[6px] bg-[#F1F5F9] text-[#172B4D] font-mono shrink-0 border border-[#E2E8F0]">
                    {ex.day} · {ex.session}
                  </span>
                </div>

                <div className="text-xs text-[#475569] space-y-1">
                  <div>Student Cohorts: <strong className="text-[#172B4D]">{ex.groups.join(', ')}</strong></div>
                  <div>Registered Candidates: <strong className="text-[#172B4D] font-mono">{ex.size}</strong></div>
                </div>
              </div>

              {/* Half-Capacity Arithmetic Display */}
              <div className="p-3 rounded-[8px] bg-[#F5F7FB] border border-[#E2E8F0] space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-semibold text-[#475569] uppercase tracking-wider font-mono">
                  <span>Seating Arithmetic</span>
                  <span className="text-[#2F7D4F]">
                    {ex.total_effective_seats} seats ≥ {ex.size}
                  </span>
                </div>

                <div className="space-y-1 divide-y divide-[#E2E8F0]/70">
                  {ex.room_details?.map((rd: any) => (
                    <div key={rd.room_id} className="pt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-[#172B4D] font-medium">{rd.room_id} ({rd.room_name})</span>
                      <span className="font-mono text-[#475569]">
                        {rd.full_capacity} / 2 = <strong className="text-[#2C6A8A]">{rd.halved_capacity}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
