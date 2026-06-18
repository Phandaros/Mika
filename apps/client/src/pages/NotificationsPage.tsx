import { isToday, isYesterday } from "date-fns";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NotificationType, type Notification } from "shared";
import { NotificationItem } from "../components/notification/NotificationItem";
import { EmptyState } from "../components/shared/EmptyState";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications
} from "../hooks/useNotifications";
import { openNotificationDestination } from "../lib/notifications";

type ReadFilter = "all" | "unread";

const ALL_TYPES = "ALL";
const notificationTypeOptions = [
  { value: ALL_TYPES, label: "Todos os tipos" },
  { value: NotificationType.COMMENT_ADDED, label: "Comentários" },
  { value: NotificationType.MENTIONED, label: "Menções" },
  { value: NotificationType.TASK_ASSIGNED, label: "Atribuições" },
  { value: NotificationType.TASK_UPDATED, label: "Alterações de tarefa" },
  { value: NotificationType.TASK_REVIEW_REQUESTED, label: "Revisões" },
  { value: NotificationType.DUE_SOON, label: "Prazos" },
  { value: NotificationType.WEEKLY_REPORT_DUE, label: "Relatórios semanais" }
];

function notificationGroup(createdAt: string): "Hoje" | "Ontem" | "Anteriores" {
  const date = new Date(createdAt);
  if (isToday(date)) {
    return "Hoje";
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  return "Anteriores";
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useNotifications({
    page,
    limit: 25,
    read: readFilter === "unread" ? false : undefined,
    type: typeFilter === ALL_TYPES ? undefined : typeFilter
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const totalPages = Math.max(data?.totalPages ?? 1, 1);
  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, Notification[]>();

    for (const notification of notifications) {
      const group = notificationGroup(notification.createdAt);
      groups.set(group, [...(groups.get(group) ?? []), notification]);
    }

    return [...groups.entries()];
  }, [notifications]);

  async function handleOpenNotification(notification: Notification) {
    if (!notification.read) {
      markRead.mutate({ notificationId: notification.id, read: true });
    }

    const opened = await openNotificationDestination(notification, navigate);
    if (!opened) {
      toast.error("O conteúdo relacionado não está mais disponível.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 border-b border-[--color-border] pb-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-[--color-brand-orange]" aria-hidden="true" />
            <h1 className="text-[20px] font-semibold text-[--color-text-primary]">Notificações</h1>
          </div>
          <p className="mt-1 text-[13px] text-[--color-text-secondary]">
            Acompanhe comentários, atribuições, revisões e prazos em um só lugar.
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-9 self-start px-3 text-[12px] sm:self-auto"
          onClick={() => markAllRead.mutate()}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          <CheckCheck aria-hidden="true" />
          Marcar todas como lidas
        </Button>
      </header>

      <section className="overflow-hidden rounded-lg border border-[--color-border] bg-[--bg-2]">
        <div className="flex flex-col justify-between gap-3 border-b border-[--color-border] px-4 pt-2 sm:flex-row sm:items-end">
          <Tabs
            value={readFilter}
            onValueChange={(value) => {
              setReadFilter(value as ReadFilter);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="unread">
                Não lidas
                {unreadCount > 0 ? (
                  <span className="rounded bg-[--color-brand-orange-muted] px-1.5 py-0.5 text-[10px] text-[--color-brand-orange]">
                    {unreadCount}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="mb-2 h-8 w-full min-w-0 text-[12px] sm:w-52" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {notificationTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-[13px] font-semibold text-[--color-text-primary]">
              Não foi possível carregar as notificações
            </p>
            <p className="text-[12px] text-[--color-text-secondary]">Verifique a conexão e tente novamente.</p>
            <Button variant="secondary" className="h-8 px-3" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-10 flex-none rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={readFilter === "unread" ? <CheckCheck className="size-9" /> : <Inbox className="size-9" />}
              title={readFilter === "unread" ? "Nenhuma notificação não lida" : "Nenhuma notificação encontrada"}
            >
              {readFilter === "unread"
                ? "Você está em dia com as novidades."
                : "Ajuste os filtros ou aguarde novas atividades."}
            </EmptyState>
          </div>
        ) : (
          <div>
            {groupedNotifications.map(([group, items]) => (
              <section key={group}>
                <div className="border-b border-[--color-border-subtle] bg-[--bg-1] px-4 py-2">
                  <h2 className="text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">{group}</h2>
                </div>
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onOpen={(item) => void handleOpenNotification(item)}
                    onToggleRead={(item) => markRead.mutate({ notificationId: item.id, read: !item.read })}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {!isLoading && !isError && data && data.total > 0 ? (
          <footer className="flex items-center justify-between gap-3 border-t border-[--color-border] px-4 py-3">
            <span className="text-[12px] text-[--color-text-secondary]">
              Página {data.page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="h-8 px-3 text-[12px]"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-3 text-[12px]"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
