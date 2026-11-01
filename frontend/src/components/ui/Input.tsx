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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full bg-[#FFFFFF] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]'
          } rounded-[8px] px-3.5 py-2 text-sm text-[#172B4D] placeholder-[#64748B]/60 transition-all focus:outline-none focus:ring-1 ${
            icon ? 'pl-9' : ''
          } disabled:bg-[#F1F5F9] disabled:text-[#64748B] disabled:cursor-not-allowed ${className}`}
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
          className={`w-full bg-[#FFFFFF] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]'
          } rounded-[8px] px-3.5 py-2 text-sm text-[#172B4D] transition-all focus:outline-none focus:ring-1 disabled:bg-[#F1F5F9] disabled:text-[#64748B] disabled:cursor-not-allowed cursor-pointer ${className}`}
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
          className={`w-full bg-[#FFFFFF] border ${
            error ? 'border-[#B3402F] focus:border-[#B3402F] focus:ring-[#B3402F]' : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]'
          } rounded-[8px] p-3 text-sm text-[#172B4D] placeholder-[#64748B]/60 transition-all focus:outline-none focus:ring-1 disabled:bg-[#F1F5F9] disabled:text-[#64748B] ${className}`}
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
      className={`block text-sm font-medium text-[#475569] mb-1.5 select-none ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-[#B3402F] ml-1">*</span>}
    </label>
  );
};

