import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`campus-page-heading mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4 pb-5 border-b border-[#E2E8F0] ${className}`}>
      <div className="space-y-2 min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#64748B] mb-1 font-mono">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-[#172B4D] transition-colors">{crumb.label}</a>
                ) : (
                  <span className="text-[#172B4D] font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-sans text-[#172B4D] font-semibold tracking-tight">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-sm text-[#475569] leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="campus-page-actions flex items-center gap-2.5 min-w-0 max-w-full flex-wrap xl:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};

