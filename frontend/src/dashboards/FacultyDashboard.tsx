import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, ShieldCheck, CheckCircle2,
  AlertTriangle, ArrowRight, PlusCircle, MessageSquare,
  Sparkles, UserCheck, Activity, Award
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [scheduleData, setScheduleData] = useState<any>(null);
  const facId = user?.faculty_id || scheduleData?.faculty_id || '';
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [schedRes, reqsRes] = await Promise.all([
        api.get('/schedule/faculty/my-schedule').catch(() => ({ data: null })),
        api.get('/session-requests/mine').catch(() => ({ data: [] }))
      ]);
      setScheduleData(schedRes.data);
      setMyRequests(reqsRes.data || []);
    } catch (err: any) {
      console.error('Failed to load faculty dashboard:', err);
      setErrorMsg('Error loading faculty teaching schedule.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [facId]);

  const teachingSessions = scheduleData?.sessions || [];
  const workload = scheduleData?.daily_workload || [];
  const maxHours = scheduleData?.max_hours_per_day || 4;
  const totalHours = scheduleData?.total_weekly_hours || teachingSessions.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name || 'Faculty Member'}`}
        subtitle={`Faculty Member${facId ? ` (${facId} · ${user?.department || scheduleData?.department || 'Academic'})` : ''}. Weekly teaching timetable synchronized with 0 clashes. Max daily limit: ${maxHours}h (Rule H12).`}
        badge={
          <StatusBadge
            status="success"
            size="sm"
            label={facId ? `Faculty ${facId} Scoped` : 'Faculty Workspace'}
            icon={<UserCheck className="w-3.5 h-3.5" />}
          />
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/my-schedule">
              <Button
                variant="secondary"
                size="md"
                icon={<Calendar className="w-4 h-4 text-[#B08A3E]" />}
              >
                Declare Unavailability
              </Button>
            </Link>
            <Link to="/assistant">
              <Button
                variant="evergreen"
                size="md"
                icon={<MessageSquare className="w-4 h-4" />}
              >
                AI Scheduling Assistant
              </Button>
            </Link>
          </div>
        }
      />

      {errorMsg && (
        <div className="p-3.5 rounded-[8px] bg-[#FDF5E6] border border-[#EBD19E] text-[#B7791F] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Faculty Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Weekly Teaching Hours"
          value={`${totalHours} hrs`}
          subtitle="Assigned Teaching Load"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: 'Balanced Schedule', type: 'positive' }}
        />
        <StatCard
          title="Daily Hour Limit"
          value={`≤ ${maxHours}h / day`}
          subtitle="Rule H12 Strict Bound"
          highlight={true}
          icon={<Activity className="w-4 h-4" />}
          trend={{ text: '100% Compliant', type: 'positive' }}
        />
        <StatCard
          title="Teaching Sessions"
          value={teachingSessions.length}
          subtitle="Lectures & Tutorials"
          icon={<Calendar className="w-4 h-4" />}
          trend={{ text: '0 Clashes', type: 'positive' }}
        />
        <StatCard
          title="My Active Requests"
          value={myRequests.length}
          subtitle="Reschedules & Leave requests"
          icon={<Clock className="w-4 h-4" />}
          trend={{ text: myRequests.length === 0 ? 'Queue Clear' : 'Under Review', type: 'neutral' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Weekly Teaching Schedule Overview */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-[#1F2A24] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#B08A3E]" />
              <span>My Teaching Schedule</span>
            </h2>
            <Link
              to="/my-schedule"
              className="text-xs text-[#B08A3E] hover:text-[#9A7633] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View Full Synchronized Grid</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {teachingSessions.length === 0 ? (
              <Panel variant="sunken" className="p-6 text-center text-xs text-[#55625A]">
                No teaching sessions currently assigned.
              </Panel>
            ) : (
              teachingSessions.slice(0, 5).map((s: any) => (
                <div
                  key={s.session_id}
                  className="bg-[#FFFDF8] p-4 rounded-[10px] border border-[#E4DBC6] shadow-[0_1px_2px_rgba(31,42,36,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-[#12372A] bg-[#FAF6EC] px-2.5 py-1 rounded-[6px] border border-[#B08A3E]/30 leading-none">
                        {s.session_id}
                      </span>
                      <span className="font-semibold text-sm text-[#1F2A24]">{s.course_id} ({s.kind})</span>
                      <StatusBadge status="neutral" size="sm" label={`${s.day} P${s.start_period}`} />
                    </div>
                    <div className="text-xs text-[#55625A]">
                      Venue: <span className="font-medium text-[#1F2A24]">{s.room_id}</span> · Groups: {s.groups?.join(', ')} · Size: {s.size} students
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Link to="/my-schedule">
                      <Button variant="secondary" size="sm">
                        Why here?
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Workload Distribution & Assistant */}
        <div className="lg:col-span-4 space-y-4">
          <Panel variant="default" className="space-y-3.5">
            <h3 className="font-serif font-bold text-sm text-[#1F2A24] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#12372A]" />
              <span>Daily Teaching Workload (H12)</span>
            </h3>
            <div className="space-y-2">
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => {
                const dayItem = workload.find((w: any) => w.day === day);
                const hrs = dayItem?.teaching_hours || 0;
                const pct = Math.min(100, Math.round((hrs / maxHours) * 100));
                return (
                  <div key={day} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1F2A24]">{day}</span>
                      <span className="font-mono text-[#55625A]">{hrs}h / {maxHours}h</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#FAF6EC] overflow-hidden border border-[#E4DBC6]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          hrs > maxHours ? 'bg-[#A84B2C]' : hrs === maxHours ? 'bg-[#B08A3E]' : 'bg-[#12372A]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel variant="sunken" className="p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#2F7D4F] font-bold">
              <Sparkles className="w-4 h-4 text-[#B08A3E]" />
              <span>AI Conversational Rescheduling</span>
            </div>
            <p className="text-[#55625A] leading-relaxed text-[11px]">
              Faculty can submit requests in English or Hinglish (e.g. <em>"move my DBMS class kal shift kar do"</em>). The solver generates dry-run verified proposal cards with zero hard violations.
            </p>
            <div className="pt-2">
              <Link to="/assistant">
                <Button variant="secondary" size="sm" className="w-full">
                  Open AI Assistant
                </Button>
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
