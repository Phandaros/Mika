import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Notification } from "shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications
} from "../../hooks/useNotifications";
import { openNotificationDestination } from "../../lib/notifications";
import { NotificationItem } from "../notification/NotificationItem";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications({ page: 1, limit: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  async function handleOpenNotification(notification: Notification) {
    if (!notification.read) {
      markRead.mutate({ notificationId: notification.id, read: true });
    }

    const opened = await openNotificationDestination(notification, navigate);
    if (opened) {
      setOpen(false);
      return;
    }

    toast.error("O conteúdo relacionado não está mais disponível.");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-10 px-0"
          aria-label="Abrir notificações"
          title="Notificações"
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-[--color-brand-orange] px-1.5 py-0.5 text-[10px] font-bold leading-4 text-[--color-brand-white]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(400px,calc(100vw-24px))] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[--color-border] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[--color-text-primary]">Notificações</h2>
            <p className="text-[11px] text-[--color-text-muted]">
              {unreadCount === 0 ? "Tudo em dia" : `${unreadCount} ${unreadCount === 1 ? "não lida" : "não lidas"}`}
            </p>
          </div>
          <Button
            variant="ghost"
            className="size-8 px-0"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            aria-label="Marcar todas como lidas"
            title="Marcar todas como lidas"
          >
            <CheckCheck aria-hidden="true" />
          </Button>
        </div>

        <ScrollArea className="h-[min(430px,calc(100vh-180px))]">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="size-9 flex-none rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
              <Bell className="size-8 text-[--color-text-muted]" aria-hidden="true" />
              <p className="text-[13px] font-medium text-[--color-text-primary]">Nenhuma notificação</p>
              <p className="text-[12px] text-[--color-text-muted]">Novidades sobre suas tarefas aparecerão aqui.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
                onOpen={(item) => void handleOpenNotification(item)}
                onToggleRead={(item) => markRead.mutate({ notificationId: item.id, read: !item.read })}
              />
            ))
          )}
        </ScrollArea>

        <div className="border-t border-[--color-border] p-2">
          <Button
            variant="ghost"
            className="h-9 w-full text-[12px]"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            Ver todas as notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
