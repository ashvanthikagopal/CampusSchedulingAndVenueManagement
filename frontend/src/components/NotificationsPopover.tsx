import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';

export const NotificationsPopover: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Notifications query
  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const unreadCount = notifData?.unread_count || 0;
  const notifications = notifData?.notifications || [];

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/read`);
      refetchNotifs();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      refetchNotifs();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative min-w-[38px] min-h-[38px] flex items-center justify-center rounded-[8px] bg-[#FFFDF8] hover:bg-[#F2ECDC] text-[#55625A] hover:text-[#1F2A24] border border-[#E4DBC6] transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B3402F] text-[#FFFDF8] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#FFFDF8] border border-[#E4DBC6] rounded-[10px] shadow-[0_4px_16px_rgba(31,42,36,0.12)] z-50 overflow-hidden animate-in fade-in">
          {/* Popover Header */}
          <div className="p-3.5 border-b border-[#E4DBC6] flex items-center justify-between bg-[#F2ECDC]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-[#1F2A24] uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#FBEFEF] text-[#B3402F] border border-[#EFC5BF] text-[10px] font-bold font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#B08A3E] hover:text-[#9A7633] flex items-center gap-1 font-semibold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Popover List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#E4DBC6]/70">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7C877F]">
                No notifications at this time.
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3.5 text-xs transition-colors hover:bg-[#FAF6EC] flex items-start gap-2.5 ${
                    !n.read ? 'bg-[#FAF6EC]/80 border-l-[3px] border-l-[#B08A3E]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.read ? (
                      <div className="w-2 h-2 rounded-full bg-[#B08A3E] mt-1" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-[#7C877F]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="font-semibold text-[#1F2A24] truncate">{n.title}</div>
                    <p className="text-[#55625A] leading-relaxed text-[11px]">{n.message}</p>
                    <div className="text-[10px] text-[#7C877F] font-mono pt-0.5">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="text-[11px] text-[#7C877F] hover:text-[#1F2A24] p-1 cursor-pointer shrink-0"
                      title="Mark read"
                      aria-label="Mark notification as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

