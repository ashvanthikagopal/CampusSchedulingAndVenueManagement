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
        className="relative min-w-[38px] min-h-[38px] flex items-center justify-center rounded-[8px] bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#172B4D] border border-[#E2E8F0] transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B3402F] text-[#FFFFFF] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-[68px] left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-96 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[10px] shadow-[0_4px_16px_rgba(15,23,42,0.12)] z-50 overflow-hidden animate-in fade-in">
          {/* Popover Header */}
          <div className="p-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F1F5F9]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans font-bold text-[#172B4D] uppercase tracking-wider">
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
                className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 font-semibold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Popover List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E8F0]/70">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                No notifications at this time.
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3.5 text-xs transition-colors hover:bg-[#F5F7FB] flex items-start gap-2.5 ${
                    !n.read ? 'bg-[#F5F7FB]/80 border-l-[3px] border-l-[#2563EB]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.read ? (
                      <div className="w-2 h-2 rounded-full bg-[#2563EB] mt-1" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-[#64748B]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="font-semibold text-[#172B4D] truncate">{n.title}</div>
                    <p className="text-[#475569] leading-relaxed text-[11px]">{n.message}</p>
                    <div className="text-[10px] text-[#64748B] font-mono pt-0.5">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="text-[11px] text-[#64748B] hover:text-[#172B4D] p-1 cursor-pointer shrink-0"
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

