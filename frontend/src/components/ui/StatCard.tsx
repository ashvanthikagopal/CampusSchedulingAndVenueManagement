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
      className={`bg-[#FFFDF8] border ${
        highlight ? 'border-[#B08A3E]/60 ring-1 ring-[#B08A3E]/30' : 'border-[#E4DBC6]'
      } rounded-[10px] p-5 shadow-[0_1px_2px_rgba(31,42,36,0.06)] flex flex-col justify-between transition-all ${
        onClick ? 'cursor-pointer hover:border-[#B08A3E] hover:shadow-md' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#7C877F] font-semibold">
          {title}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
            highlight ? 'bg-[#FAF6EC] text-[#B08A3E] border border-[#B08A3E]/20' : 'bg-[#F2ECDC] text-[#55625A]'
          }`}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className={`text-2xl sm:text-3xl font-mono font-bold tracking-tight tabular-nums ${
          highlight ? 'text-[#B08A3E]' : 'text-[#1F2A24]'
        }`}>
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 text-xs text-[#55625A] flex-wrap">
            {trend && (
              <span className={`inline-flex items-center justify-center font-medium px-2 py-0.5 rounded-[4px] text-[10px] leading-none ${
                trend.type === 'positive' ? 'bg-[#EBF5EE] text-[#2F7D4F]' :
                trend.type === 'negative' ? 'bg-[#FBEFEF] text-[#B3402F]' :
                'bg-[#F2ECDC] text-[#55625A]'
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

