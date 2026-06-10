const DEBUG_STORAGE_KEY = "mika:debug-comment-images";

export function isCommentImageDebugEnabled(): boolean {
  return import.meta.env.DEV && localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

export function logCommentImageDebug(stage: string, payload?: unknown): void {
  if (!isCommentImageDebugEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.info(`[CommentImage] ${stage}`);
    return;
  }

  console.info(`[CommentImage] ${stage}`, payload);
}

export function commentImageDebugHint(): string {
  return "Ative logs no console: localStorage.setItem('mika:debug-comment-images', '1') e recarregue a página.";
}
