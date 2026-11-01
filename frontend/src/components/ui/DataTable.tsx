import React from 'react';

export interface DataTableProps {
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  empty?: boolean;
  emptyText?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  headers,
  children,
  className = '',
  empty = false,
  emptyText = 'No records found.',
}) => {
  return (
    <div className={`w-full overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] text-[#475569] text-[11px] font-mono uppercase tracking-wider">
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4 font-semibold select-none">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]/70 text-[#172B4D]">
            {empty ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-10 text-xs text-[#64748B] italic">
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

