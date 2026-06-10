import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NotificationType } from "shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount
} from "../../hooks/useNotifications";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <Button
        variant="ghost"
        className="relative h-10 w-10 px-0"
        title="Notificacoes"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-brand-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] rounded-md border border-border bg-surface-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-3">
            <div>
              <p className="text-sm font-bold text-text-primary">Notificacoes</p>
              <p className="text-xs text-text-secondary">{unreadCount} não lidas</p>
            </div>
            <Button
              variant="ghost"
              className="h-8 px-2"
              onClick={() => void markAllRead.mutateAsync()}
              disabled={unreadCount === 0 || markAllRead.isPending}
              title="Marcar todas como lidas"
            >
              <CheckCheck size={16} />
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">Nenhuma notificacao por enquanto.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.read) {
                      void markRead.mutateAsync(notification.id);
                    }

                    if (notification.type === NotificationType.WEEKLY_REPORT_DUE) {
                      setOpen(false);
                      navigate("/weekly-reports/mine");
                    }
                  }}
                  className="grid w-full gap-1 rounded-md p-3 text-left transition hover:bg-surface-hover"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 flex-none rounded-full",
                        notification.read ? "bg-text-muted" : "bg-brand-orange"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">{notification.message}</p>
                    </div>
                  </div>
                  <span className="pl-4 text-[11px] text-text-muted">
                    {format(new Date(notification.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
