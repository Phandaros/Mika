import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Notification } from "shared";
import { prependRealtimeNotification } from "../../hooks/useNotifications";
import { getNotificationSocket } from "../../lib/socket";
import {
  normalizeLegacyNotificationText,
  notificationActorName,
  openNotificationDestination
} from "../../lib/notifications";

export function NotificationRealtimeBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getNotificationSocket();

    function handleNotification(notification: Notification) {
      prependRealtimeNotification(notification);
      toast(notificationActorName(notification), {
        description: normalizeLegacyNotificationText(notification.message),
        action: {
          label: "Abrir",
          onClick: () => {
            void openNotificationDestination(notification, navigate).then((opened) => {
              if (!opened) {
                toast.error("O conteúdo relacionado não está mais disponível.");
              }
            });
          }
        }
      });
    }

    socket.on("notification:new", handleNotification);
    return () => {
      socket.off("notification:new", handleNotification);
    };
  }, [navigate]);

  return null;
}
