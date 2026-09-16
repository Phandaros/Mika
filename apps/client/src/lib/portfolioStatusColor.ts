const PORTFOLIO_STATUS_COLORS: Record<string, string> = {
  aprovado: "var(--status-done-text)",
  completo: "var(--status-done-text)",
  concluido: "var(--status-done-text)",
  finalizado: "var(--status-done-text)",
  "em analise": "var(--status-analysis-text)",
  parcial: "var(--status-review-text)",
  indeferido: "var(--status-late-text)",
  rejeitado: "var(--status-late-text)",
  "to do": "var(--status-todo-text)",
  "a fazer": "var(--status-todo-text)",
  "n/a": "var(--status-backlog-text)",
  "sem status": "var(--status-backlog-text)",
  indefinido: "var(--status-backlog-text)"
};

export function portfolioStatusColor(label: string): string {
  return PORTFOLIO_STATUS_COLORS[normalizeStatusLabel(label)] ?? "var(--status-backlog-text)";
}

function normalizeStatusLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
