import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './ui/Button';

export interface ResetDatasetModalProps {
  open: boolean;
  onClose: () => void;
}

export const ResetDatasetModal: React.FC<ResetDatasetModalProps> = ({ open, onClose }) => {
  const [isResetting, setIsResetting] = useState(false);

  if (!open) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await api.post('/admin/reset-demo');
      window.location.reload();
    } catch (err: any) {
      alert('Reset failed: ' + (err?.response?.data?.detail || err.message));
      setIsResetting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] shadow-[0_8px_30px_rgba(15,23,42,0.15)] max-w-md w-full p-6 text-[#172B4D] relative animate-in zoom-in-95">
        <button
          type="button"
          onClick={onClose}
          disabled={isResetting}
          className="absolute right-4 top-4 text-[#64748B] hover:text-[#172B4D] p-1 rounded cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-[8px] bg-[#FBEFEF] text-[#B3402F] border border-[#EFC5BF] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="reset-modal-title" className="text-lg font-sans font-semibold text-[#172B4D]">
              Reset Demo Dataset
            </h3>
            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
              This action restores the original CIT campus timetable, clears user-created reschedule proposals, and resets booking allocations back to starter baseline.
            </p>
          </div>
        </div>

        <div className="p-3 bg-[#F1F5F9] rounded-[8px] text-xs font-mono text-[#475569] mb-5 border border-[#E2E8F0]">
          Status: Instant snapshot rollback • No permanent schema deletion
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isResetting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleReset}
            loading={isResetting}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Confirm & Reset Baseline
          </Button>
        </div>
      </div>
    </div>
  );
};

