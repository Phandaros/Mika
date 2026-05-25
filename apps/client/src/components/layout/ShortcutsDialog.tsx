import { useUiStore } from "../../store/uiStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

const rows: Array<{ keys: string; desc: string }> = [
  { keys: "Ctrl K / ⌘ K", desc: "Paleta de comandos" },
  { keys: "Shift ?", desc: "Lista de atalhos" },
  { keys: "G P", desc: "Ir para Projetos" },
  { keys: "G T", desc: "Ir para Minhas tarefas" },
  { keys: "G D", desc: "Ir para Início" },
  { keys: "G U", desc: "Ir para Usuários (coord./admin)" },
  { keys: "C", desc: "Ir para Minhas tarefas (criar rapido)" },
  { keys: "Esc", desc: "Fechar paleta ou esta janela" }
];

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsDialogOpen);
  const setOpen = useUiStore((s) => s.setShortcutsDialogOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <ul className="grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.desc} className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
              <span className="text-text-secondary">{row.desc}</span>
              <kbd className="shrink-0 whitespace-nowrap rounded border border-border bg-surface-hover px-2 py-0.5 font-mono text-xs text-text-primary">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
