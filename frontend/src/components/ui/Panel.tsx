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
    default: 'ledger-panel bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_1px_2px_rgba(31,42,36,0.06)]',
    raised: 'ledger-panel-raised bg-[#FFFDF8] border border-[#D5C9AE] rounded-[10px] shadow-[0_4px_12px_rgba(31,42,36,0.04),0_1px_3px_rgba(31,42,36,0.06)]',
    sunken: 'ledger-panel-sunken bg-[#F2ECDC] border border-[#E4DBC6] rounded-[8px]',
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

