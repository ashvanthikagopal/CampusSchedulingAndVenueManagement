import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, HelpCircle } from 'lucide-react';

export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brass';

export interface StatusBadgeProps {
  status: StatusType;
  label: React.ReactNode;
  icon?: React.ReactNode;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  icon,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const defaultIcons = {
    success: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    warning: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    danger: <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    info: <Info className="w-3.5 h-3.5" aria-hidden="true" />,
    neutral: <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    brass: <span className="w-2 h-2 rounded-full bg-[#2563EB]" aria-hidden="true" />,
  };

  const statusStyles = {
    success: 'bg-[#EBF5EE] text-[#2F7D4F] border-[#C3E2CD]',
    warning: 'bg-[#FDF5E6] text-[#B7791F] border-[#EBD19E]',
    danger: 'bg-[#FBEFEF] text-[#B3402F] border-[#EFC5BF]',
    info: 'bg-[#EDF4F8] text-[#2C6A8A] border-[#C6DFEB]',
    neutral: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
    brass: 'bg-[#F5F7FB] text-[#1D4ED8] border-[#E2E8F0]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const activeIcon = icon !== undefined ? icon : defaultIcons[status];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shrink-0 select-none ${statusStyles[status]} ${sizeStyles[size]} ${className}`}
    >
      {showIcon && activeIcon && <span className="shrink-0">{activeIcon}</span>}
      <span className="font-semibold">{label}</span>
    </span>
  );
};

