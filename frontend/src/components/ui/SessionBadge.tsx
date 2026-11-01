import React from 'react';

export type SessionType = 'lecture' | 'tutorial' | 'lab' | 'event' | 'exam';

export interface SessionBadgeProps {
  type: SessionType | string;
  label?: string;
  className?: string;
}

const SESSION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  lecture: {
    bg: 'bg-[#EEF5FA]',
    border: 'border-l-[3px] border-l-[#2C6A8A] border-y border-r border-[#C6DFEB]',
    text: 'text-[#1D4D65]',
    label: 'Lecture',
  },
  tutorial: {
    bg: 'bg-[#EEF6F0]',
    border: 'border-l-[3px] border-l-[#2F7D4F] border-y border-r border-[#C3E2CD]',
    text: 'text-[#205737]',
    label: 'Tutorial',
  },
  lab: {
    bg: 'bg-[#F4F0F9]',
    border: 'border-l-[3px] border-l-[#6B4E8C] border-y border-r border-[#D9CEE8]',
    text: 'text-[#4F3569]',
    label: 'Lab',
  },
  event: {
    bg: 'bg-[#FCF2EC]',
    border: 'border-l-[3px] border-l-[#B0653E] border-y border-r border-[#F3D3C2]',
    text: 'text-[#7D4323]',
    label: 'Event',
  },
  exam: {
    bg: 'bg-[#FAF4E6]',
    border: 'border-l-[3px] border-l-[#B7791F] border-y border-r border-[#EBD19E]',
    text: 'text-[#7A4F10]',
    label: 'Exam',
  },
};

export const SessionBadge: React.FC<SessionBadgeProps> = ({
  type,
  label,
  className = '',
}) => {
  const normType = type?.toLowerCase() || 'lecture';
  const config = SESSION_STYLES[normType] || SESSION_STYLES.lecture;
  const displayLabel = label || config.label;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      {displayLabel}
    </span>
  );
};
