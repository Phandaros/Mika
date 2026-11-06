const DRAFT_KEY_PREFIX = "mk:comment-draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_IMAGE_PATTERN = /!\[[^\]]*\]\(blob:[^)]*\)\s*/g;

export interface CommentDraft {
  content: string;
  baseUpdatedAt: string;
  savedAt: number;
}

function draftKey(userId: string, commentId: string): string {
  return `${DRAFT_KEY_PREFIX}:${userId}:${commentId}`;
}

function isCommentDraft(value: unknown): value is CommentDraft {
  const draft = value as Partial<CommentDraft> | null;

  return (
    typeof draft === "object" &&
    draft !== null &&
    typeof draft.content === "string" &&
    typeof draft.baseUpdatedAt === "string" &&
    typeof draft.savedAt === "number"
  );
}

/** Imagens ainda sem URL definitiva só existem nesta aba e não sobrevivem ao rascunho. */
export function stripLocalImages(content: string): string {
  return content.replace(LOCAL_IMAGE_PATTERN, "").trim();
}

export function loadCommentDraft(userId: string, commentId: string, now = Date.now()): CommentDraft | null {
  const key = draftKey(userId, commentId);

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const draft: unknown = JSON.parse(raw);

    if (!isCommentDraft(draft) || now - draft.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

export function saveCommentDraft(userId: string, commentId: string, draft: CommentDraft): void {
  try {
    window.localStorage.setItem(draftKey(userId, commentId), JSON.stringify(draft));
  } catch {
    // Sem espaço ou sem acesso ao armazenamento: a edição continua, só não sobrevive à saída.
  }
}

export function clearCommentDraft(userId: string, commentId: string): void {
  try {
    window.localStorage.removeItem(draftKey(userId, commentId));
  } catch {
    // Nada a limpar se o armazenamento estiver indisponível.
  }
}

export function purgeExpiredCommentDrafts(now = Date.now()): void {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith(`${DRAFT_KEY_PREFIX}:`)) {
        continue;
      }

      const raw = window.localStorage.getItem(key);
      const draft: unknown = raw ? JSON.parse(raw) : null;

      if (!isCommentDraft(draft) || now - draft.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // A limpeza é oportunista; a expiração também é verificada ao carregar.
  }
}
