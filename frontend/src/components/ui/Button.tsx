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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-[8px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B08A3E] focus-visible:ring-offset-1 focus-visible:ring-offset-[#FAF6EC]';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-3.5 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[44px]',
  };

  const variantStyles = {
    primary: 'bg-[#B08A3E] hover:bg-[#9A7633] active:bg-[#856326] text-[#FFFDF8] shadow-sm font-semibold border border-[#9A7633]/30',
    secondary: 'bg-[#FFFDF8] hover:bg-[#F2ECDC] active:bg-[#EBE3CF] text-[#1F2A24] border border-[#E4DBC6] hover:border-[#D5C9AE] shadow-xs',
    ghost: 'bg-transparent hover:bg-[#F2ECDC] active:bg-[#EBE3CF] text-[#55625A] hover:text-[#1F2A24]',
    danger: 'bg-[#FBEFEF] hover:bg-[#F7DDDD] active:bg-[#F2CCCC] text-[#B3402F] border border-[#EFC5BF] hover:border-[#E5A8A0] font-medium',
    evergreen: 'bg-[#12372A] hover:bg-[#1B4A39] active:bg-[#225A46] text-[#E8EFE6] border border-[#0C261C] shadow-sm',
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

