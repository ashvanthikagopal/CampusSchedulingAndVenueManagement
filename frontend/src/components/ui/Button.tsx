import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'evergreen';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-[8px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 focus-visible:ring-offset-[#F5F7FB]';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-3.5 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[44px]',
  };

  const variantStyles = {
    primary: 'bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-[#FFFFFF] shadow-sm font-semibold border border-[#1D4ED8]/30',
    secondary: 'bg-[#FFFFFF] hover:bg-[#F1F5F9] active:bg-[#DBEAFE] text-[#172B4D] border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-xs',
    ghost: 'bg-transparent hover:bg-[#F1F5F9] active:bg-[#DBEAFE] text-[#475569] hover:text-[#172B4D]',
    danger: 'bg-[#FBEFEF] hover:bg-[#F7DDDD] active:bg-[#F2CCCC] text-[#B3402F] border border-[#EFC5BF] hover:border-[#E5A8A0] font-medium',
    evergreen: 'bg-[#142D50] hover:bg-[#1E3A5F] active:bg-[#244B78] text-[#F1F5F9] border border-[#10223F] shadow-sm',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};

