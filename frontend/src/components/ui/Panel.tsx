import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'sunken';
  padded?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  variant = 'default',
  padded = true,
  className = '',
  ...props
}) => {
  const variantClasses = {
    default: 'ledger-panel bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
    raised: 'ledger-panel-raised bg-[#FFFFFF] border border-[#CBD5E1] rounded-[10px] shadow-[0_4px_12px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]',
    sunken: 'ledger-panel-sunken bg-[#F1F5F9] border border-[#E2E8F0] rounded-[8px]',
  };

  const paddingClass = padded ? 'p-5 sm:p-6' : '';

  return (
    <div
      className={`${variantClasses[variant]} ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

