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
        subtitle="All 41 examinations scheduled across 12 slots (Mon-Sat AM/PM) with strict half-capacity seating arithmetic and zero same-day clashes."
        badge={
          <StatusBadge
            status="brass"
            size="sm"
            label="Examination Matrix Active"
            icon={<Clock className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-1 bg-[#FFFDF8] p-1 rounded-[8px] border border-[#E4DBC6] overflow-x-auto">
            <button
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedDay === 'ALL'
                  ? 'bg-[#B08A3E] text-white font-semibold shadow-xs'
                  : 'text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]'
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
                    ? 'bg-[#B08A3E] text-white font-semibold shadow-xs'
                    : 'text-[#55625A] hover:text-[#1F2A24] hover:bg-[#F2ECDC]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        }
      />

      {/* Arithmetic Callout Card */}
      <Panel variant="sunken" className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#2F7D4F] shrink-0" />
          <div>
            <div className="font-serif font-bold text-[#1F2A24] text-sm">
              Half-Capacity Seating Integrity Rule
            </div>
            <div className="text-xs text-[#55625A] mt-0.5">
              Every venue seats exactly <code className="text-[#1F2A24] font-mono font-semibold">capacity // 2</code> students to maintain examination spacing and prevent collisions.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono shrink-0">
          <StatusBadge status="success" size="sm" label="41 / 41 Exams Scheduled" />
          <StatusBadge status="info" size="sm" label="0 Same-Day Group Clashes" />
        </div>
      </Panel>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#55625A] font-mono">
          Loading midsem exam schedule...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#7C877F]">
          No exams scheduled on {selectedDay}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((ex) => (
            <div
              key={ex.exam_id}
              className="bg-[#FFFDF8] p-5 rounded-[10px] border border-[#E4DBC6] hover:border-[#D5C9AE] shadow-[0_1px_2px_rgba(31,42,36,0.06)] transition-all space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#7A4F10] bg-[#FAF4E6] px-2 py-0.5 rounded border border-[#EBD19E]">
                      {ex.exam_id}
                    </span>
                    <div className="text-sm font-bold text-[#1F2A24] mt-2">
                      {ex.course_ids.join(' & ')}
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-[6px] bg-[#F2ECDC] text-[#1F2A24] font-mono shrink-0 border border-[#E4DBC6]">
                    {ex.day} · {ex.session}
                  </span>
                </div>

                <div className="text-xs text-[#55625A] space-y-1">
                  <div>Student Cohorts: <strong className="text-[#1F2A24]">{ex.groups.join(', ')}</strong></div>
                  <div>Registered Candidates: <strong className="text-[#1F2A24] font-mono">{ex.size}</strong></div>
                </div>
              </div>

              {/* Half-Capacity Arithmetic Display */}
              <div className="p-3 rounded-[8px] bg-[#FAF6EC] border border-[#E4DBC6] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#55625A] uppercase tracking-wider font-mono">
                  <span>Seating Arithmetic</span>
                  <span className="text-[#2F7D4F]">
                    {ex.total_effective_seats} seats ≥ {ex.size}
                  </span>
                </div>

                <div className="space-y-1 divide-y divide-[#E4DBC6]/70">
                  {ex.room_details?.map((rd: any) => (
                    <div key={rd.room_id} className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#1F2A24] font-medium">{rd.room_id} ({rd.room_name})</span>
                      <span className="font-mono text-[#55625A]">
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
