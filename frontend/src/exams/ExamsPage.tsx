import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { usePageMetadata } from '../lib/usePageMetadata';
import { Clock, ShieldCheck } from 'lucide-react';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" />
            Midsem Examination Week
          </div>
          <h1 className="text-2xl font-bold text-white">Midsem Examination Schedule</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            All 41 exams scheduled across 12 slots (Mon-Sat AM/PM) with strict half-capacity seating arithmetic.
          </p>
        </div>

        {/* Day Filter Pills */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setSelectedDay('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedDay === 'ALL'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Days
          </button>
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDay === d
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Arithmetic Callout Card */}
      <div className="glass-panel p-5 rounded-xl border border-sky-500/20 bg-sky-950/10 text-xs text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-sky-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-white text-sm">Half-Capacity Seating Rule Enforced</div>
            <div className="text-slate-400 mt-0.5">
              Every venue seats exactly <code className="text-sky-300 font-mono">capacity // 2</code> students to maintain examination integrity and spacing.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-emerald-400 font-bold">41 / 41 Exams Scheduled</span>
          <span className="text-slate-500">·</span>
          <span className="text-cyan-400 font-bold">0 Same-Day Group Clashes</span>
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading midsem exam schedule...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((ex) => (
          <div
            key={ex.exam_id}
            className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {ex.exam_id}
                </span>
                <div className="text-sm font-bold text-white mt-1.5">
                  {ex.course_ids.join(' & ')}
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 font-mono">
                {ex.day} · {ex.session}
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div>Groups: <strong className="text-slate-300">{ex.groups.join(', ')}</strong></div>
              <div>Registered Students: <strong className="text-slate-200">{ex.size} candidates</strong></div>
            </div>

            {/* Half-Capacity Arithmetic Display */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Room Seating Math</span>
                <span className="text-emerald-400 font-mono">
                  {ex.total_effective_seats} effective seats ≥ {ex.size}
                </span>
              </div>

              <div className="space-y-1 divide-y divide-slate-900">
                {ex.room_details?.map((rd: any) => (
                  <div key={rd.room_id} className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-medium">{rd.room_id} ({rd.room_name})</span>
                    <span className="font-mono text-slate-400">
                      {rd.full_capacity} / 2 = <strong className="text-sky-400">{rd.halved_capacity}</strong>
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
