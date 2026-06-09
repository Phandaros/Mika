import { format } from "date-fns";
import { MessageSquare, History } from "lucide-react";
import type { Comment, TaskActivity } from "shared";
import { Avatar } from "../shared/Avatar";
import { EmptyState } from "../shared/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { MarkdownComment } from "./MarkdownComment";
import { TaskHistoryList } from "./TaskHistoryList";

export type TaskActivityTab = "comments" | "history";

interface TaskActivityTabsProps {
  comments: Comment[];
  history: TaskActivity[];
  historyLoading?: boolean;
  value: TaskActivityTab;
  onValueChange: (value: TaskActivityTab) => void;
}

export function TaskActivityTabs({ comments, history, historyLoading, value, onValueChange }: TaskActivityTabsProps) {
  const visibleHistoryCount = history.filter((activity) => activity.type !== "COMMENTED").length;

  return (
    <section className="mt-8">
      <Tabs value={value} onValueChange={(nextValue) => onValueChange(nextValue as TaskActivityTab)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquare size={16} />
              Comentários
              <span className="rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] text-[--color-text-secondary]">{comments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              <History size={16} />
              Histórico
              <span className="rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] text-[--color-text-secondary]">{visibleHistoryCount}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comments" className="mt-4">
          <CommentList comments={comments} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <TaskHistoryList activities={history} isLoading={historyLoading} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <EmptyState title="Nenhum comentário ainda" icon={<MessageSquare size={40} />}>
        Use o editor abaixo para registrar decisões, dúvidas e alinhamentos desta tarefa.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      {comments.map((item) => (
        <article key={item.id} className="grid grid-cols-[32px_1fr] gap-3">
          <Avatar
            name={item.author?.name ?? "Usuário"}
            imageUrl={item.author?.avatarUrl}
            className="mt-0.5 h-8 w-8 shrink-0"
          />
          <div className="min-w-0 border-b border-[--color-border-subtle] pb-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13px] font-semibold leading-5 text-[--color-text-primary]">{item.author?.name ?? "Usuário"}</span>
              <time className="text-[12px] tabular-nums text-[--color-text-muted]">
                {format(new Date(item.asanaCreatedAt ?? item.createdAt), "dd/MM/yyyy HH:mm")}
              </time>
            </div>
            <MarkdownComment content={item.content} className="mt-2" />
          </div>
        </article>
      ))}
    </div>
  );
}
