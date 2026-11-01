import React from 'react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  trend?: {
    text: string;
    type?: 'positive' | 'negative' | 'neutral';
  };
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
  trend,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#FFFFFF] border ${
        highlight ? 'border-[#2563EB]/60 ring-1 ring-[#2563EB]/30' : 'border-[#E2E8F0]'
      } rounded-[10px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all ${
        onClick ? 'cursor-pointer hover:border-[#2563EB] hover:shadow-md' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-sans text-[#64748B] font-semibold">
          {title}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
            highlight ? 'bg-[#F5F7FB] text-[#2563EB] border border-[#2563EB]/20' : 'bg-[#F1F5F9] text-[#475569]'
          }`}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className={`text-2xl font-sans font-bold tracking-tight tabular-nums break-words ${
          highlight ? 'text-[#2563EB]' : 'text-[#172B4D]'
        }`}>
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 text-xs text-[#475569] flex-wrap">
            {trend && (
              <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
                trend.type === 'positive' ? 'bg-[#EBF5EE] text-[#2F7D4F]' :
                trend.type === 'negative' ? 'bg-[#FBEFEF] text-[#B3402F]' :
                'bg-[#F1F5F9] text-[#475569]'
              }`}>
                {trend.text}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

