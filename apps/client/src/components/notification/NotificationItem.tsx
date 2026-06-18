import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Mail } from "lucide-react";
import type { MouseEvent } from "react";
import type { Notification } from "shared";
import {
  normalizeLegacyNotificationText,
  notificationActorName,
  notificationPresentation,
  notificationToneStyles
} from "../../lib/notifications";
import { cn } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import { Button } from "../ui/button";

interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onOpen: (notification: Notification) => void;
  onToggleRead?: (notification: Notification) => void;
}

export function NotificationItem({ notification, compact = false, onOpen, onToggleRead }: NotificationItemProps) {
  const presentation = notificationPresentation(notification.type);
  const Icon = presentation.icon;
  const createdAt = new Date(notification.createdAt);
  const fullDate = format(createdAt, "dd/MM/yyyy 'às' HH:mm");
  const relativeDate = formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR });
  const message = normalizeLegacyNotificationText(notification.message);
  const actorName = notificationActorName(notification);

  function handleToggleRead(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onToggleRead?.(notification);
  }

  return (
    <div
      className={cn(
        "group relative flex w-full min-w-0 cursor-pointer gap-3 border-b border-[--color-border-subtle] text-left outline-none transition-colors duration-100 last:border-b-0 hover:bg-[--bg-3] focus-within:bg-[--bg-3] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-brand-orange]",
        compact ? "px-3 py-3" : "px-4 py-4",
        !notification.read && "bg-[--color-brand-orange-muted]/30"
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(notification);
        }
      }}
    >
      <div className="relative flex-none">
        {notification.actor ? (
          <Avatar
            name={notification.actor.name}
            imageUrl={notification.actor.avatarUrl}
            className={compact ? "size-9" : "size-10"}
          />
        ) : (
          <div
            className={cn("flex items-center justify-center rounded-full", compact ? "size-9" : "size-10")}
            style={notificationToneStyles[presentation.tone]}
          >
            <Icon className="size-4" aria-hidden="true" />
          </div>
        )}
        {notification.actor ? (
          <span
            className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-[--bg-2]"
            style={notificationToneStyles[presentation.tone]}
          >
            <Icon className="size-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[--color-text-primary]">{actorName}</p>
            <p className="text-[11px] text-[--color-text-muted]">{presentation.action}</p>
          </div>
          {!notification.read ? (
            <span className="mt-1.5 size-1.5 flex-none rounded-full bg-[--color-brand-orange]" aria-label="Não lida" />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[--color-text-secondary]">{message}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <time className="text-[11px] text-[--color-text-muted]" dateTime={notification.createdAt} title={fullDate}>
            {relativeDate}
          </time>
          {onToggleRead ? (
            <Button
              variant="ghost"
              className={cn(
                "h-7 px-2 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                !compact && "sm:opacity-0"
              )}
              aria-label={notification.read ? "Marcar como não lida" : "Marcar como lida"}
              title={notification.read ? "Marcar como não lida" : "Marcar como lida"}
              onClick={handleToggleRead}
            >
              {notification.read ? <Mail aria-hidden="true" /> : <Check aria-hidden="true" />}
              {!compact ? (notification.read ? "Não lida" : "Lida") : null}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
