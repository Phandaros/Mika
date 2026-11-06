import { isAxiosError } from "axios";

const MARKDOWN_TABLE_PATTERN = /^\s*\|.*\|\s*\r?\n\s*\|[\s:|-]+\|\s*$/m;
const RAW_HTML_PATTERN = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i;

export interface UnsupportedMarkdown {
  table: boolean;
  html: boolean;
}

/** Conteúdo importado que o editor não representa e reescreveria ao salvar. */
export function findUnsupportedMarkdown(content: string): UnsupportedMarkdown | null {
  const table = MARKDOWN_TABLE_PATTERN.test(content);
  const html = RAW_HTML_PATTERN.test(content.replace(/`[^`]*`/g, ""));

  return table || html ? { table, html } : null;
}

export function unsupportedMarkdownWarning(unsupported: UnsupportedMarkdown): string {
  if (unsupported.table) {
    return "Este comentário tem uma tabela que o editor não exibe. Ao salvar alterações, ela será removida.";
  }

  return "Este comentário tem formatação HTML. Ao salvar alterações, ela pode ser convertida ou perdida.";
}

export function commentErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    return `Sem conexão com o servidor. ${fallback}`;
  }

  if (error.response.status === 404) {
    return "Este comentário não existe mais.";
  }

  const apiError = (error.response.data as { error?: string } | undefined)?.error?.trim();

  return apiError || fallback;
}
