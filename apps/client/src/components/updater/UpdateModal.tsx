import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
import type { UpdaterState } from "../../hooks/useUpdater";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface UpdateModalProps {
  updater: UpdaterState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function releaseDateLabel(releaseDate: string): string {
  try {
    return format(parseISO(releaseDate), "dd/MM/yyyy");
  } catch {
    return releaseDate;
  }
}

function releaseNoteBlocks(releaseNotes: string) {
  const lines = releaseNotes.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line.trim()));

  if (bulletLines.length === lines.length && bulletLines.length > 0) {
    return (
      <ul className="space-y-2 text-sm leading-6 text-text-secondary">
        {bulletLines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-orange" />
            <span>{line.replace(/^[-*]\s+/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <pre className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">{releaseNotes}</pre>;
}

export function UpdateModal({ updater, open, onOpenChange }: UpdateModalProps) {
  if (!updater.updateInfo) {
    return null;
  }

  const isBusy = updater.status === "checking" || updater.status === "downloading";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mika v{updater.updateInfo.version}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-md border border-border-subtle bg-bg-1 px-3 py-2 text-xs text-text-muted">
            Publicado em {releaseDateLabel(updater.updateInfo.releaseDate)}
          </div>
          <div className="max-h-[46vh] overflow-y-auto overflow-x-hidden pr-1">
            {releaseNoteBlocks(updater.updateInfo.releaseNotes)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Agora nao
            </Button>
            <Button onClick={updater.install} disabled={isBusy}>
              <Download size={16} />
              {updater.status === "downloading" ? "Baixando..." : "Baixar e Instalar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
