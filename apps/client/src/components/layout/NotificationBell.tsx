import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { Button } from "../ui/button";

export function NotificationBell() {
  const unreadCount = useUnreadNotificationCount();

  return (
    <Button variant="ghost" className="relative h-10 w-10 px-0" title="Notificacoes">
      <Bell size={18} />
      {unreadCount > 0 ? (
        <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-brand-white">
          {unreadCount}
        </span>
      ) : null}
    </Button>
  );
}
