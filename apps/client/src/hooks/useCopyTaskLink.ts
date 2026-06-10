import { toast } from "sonner";
import { buildTaskLink, type BuildTaskLinkOptions, type TaskLinkSource } from "../lib/taskLink";

export function useCopyTaskLink() {
  async function copyTaskLink(task: TaskLinkSource, options?: BuildTaskLinkOptions) {
    try {
      await window.navigator.clipboard.writeText(buildTaskLink(task, options));
      toast.success("Link da tarefa copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return { copyTaskLink };
}
