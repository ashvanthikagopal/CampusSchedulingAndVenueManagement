import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C877F] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full bg-[#FFFDF8] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E4DBC6] focus:border-[#B08A3E] focus:ring-[#B08A3E]'
          } rounded-[8px] px-3.5 py-2 text-sm text-[#1F2A24] placeholder-[#7C877F]/60 transition-all focus:outline-none focus:ring-1 ${
            icon ? 'pl-9' : ''
          } disabled:bg-[#F2ECDC] disabled:text-[#7C877F] disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[#B3402F] flex items-center gap-1 font-medium" role="alert">
            <span>•</span> {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={`w-full bg-[#FFFDF8] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E4DBC6] focus:border-[#B08A3E] focus:ring-[#B08A3E]'
          } rounded-[8px] px-3.5 py-2 text-sm text-[#1F2A24] transition-all focus:outline-none focus:ring-1 disabled:bg-[#F2ECDC] disabled:text-[#7C877F] disabled:cursor-not-allowed cursor-pointer ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 text-xs text-[#B3402F] flex items-center gap-1 font-medium" role="alert">
            <span>•</span> {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          className={`w-full bg-[#FFFDF8] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E4DBC6] focus:border-[#B08A3E] focus:ring-[#B08A3E]'
          } rounded-[8px] p-3 text-sm text-[#1F2A24] placeholder-[#7C877F]/60 transition-all focus:outline-none focus:ring-1 disabled:bg-[#F2ECDC] disabled:text-[#7C877F] ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[#B3402F] flex items-center gap-1 font-medium" role="alert">
            <span>•</span> {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }> = ({
  children,
  className = '',
  required = false,
  ...props
}) => {
  return (
    <label
      className={`block text-xs font-semibold text-[#55625A] uppercase tracking-wider mb-1.5 select-none ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-[#B3402F] ml-1">*</span>}
    </label>
  );
};

