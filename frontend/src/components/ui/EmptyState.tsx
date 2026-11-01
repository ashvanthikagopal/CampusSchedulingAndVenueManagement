import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-8 sm:p-12 text-center flex flex-col items-center justify-center rounded-[10px] bg-[#FFFFFF] border border-[#E2E8F0] ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#475569] flex items-center justify-center mb-3.5 border border-[#E2E8F0]/80">
          {icon}
        </div>
      )}
      <h3 className="text-base font-sans font-semibold text-[#172B4D] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#475569] max-w-md leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

