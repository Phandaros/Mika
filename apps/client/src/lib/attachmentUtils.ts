import { getApiBaseUrl } from "./runtimeConfig";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed"
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".txt": "text/plain",
  ".msg": "text/plain",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar"
};

export const ALLOWED_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_MIME));

export type FileClassification = "image" | "document" | "rejected";

export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return "";
  }

  return filename.slice(dotIndex).toLowerCase();
}

export function inferMimeType(file: File): string {
  const trimmedType = file.type.trim();

  if (trimmedType && trimmedType !== "application/octet-stream") {
    return trimmedType;
  }

  const extension = getFileExtension(file.name);
  return EXTENSION_TO_MIME[extension] ?? "";
}

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export function classifyFile(file: File): FileClassification {
  const mimeType = inferMimeType(file);

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }

  if (ALLOWED_MIME_TYPES.has(mimeType) && !IMAGE_MIME_TYPES.has(mimeType)) {
    return "document";
  }

  const extension = getFileExtension(file.name);

  if (ALLOWED_EXTENSIONS.has(extension)) {
    const inferred = EXTENSION_TO_MIME[extension];

    if (inferred && IMAGE_MIME_TYPES.has(inferred)) {
      return "image";
    }

    if (inferred && ALLOWED_MIME_TYPES.has(inferred)) {
      return "document";
    }
  }

  return "rejected";
}

export function getFileRejectionMessage(file: File): string {
  const extension = getFileExtension(file.name);
  const label = extension || file.type || file.name;
  return `Tipo de arquivo não permitido: ${label}`;
}

export function attachmentFileUrl(attachmentId: string): string {
  return `${getApiBaseUrl()}/attachments/${attachmentId}/file`;
}

export function attachmentDownloadUrl(attachmentId: string): string {
  return `${getApiBaseUrl()}/attachments/${attachmentId}/download`;
}

const AUTHENTICATED_ASSET_PATH_PATTERN = /^\/api\/v1\/attachments\/[^/?#]+\/(?:file|download)\/?$/;

export function normalizeAuthenticatedAssetUrl(src: string): string | null {
  let pathname: string;

  if (src.startsWith("/")) {
    pathname = src;
  } else {
    try {
      const parsedUrl = new URL(src);

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return null;
      }

      pathname = parsedUrl.pathname;
    } catch {
      return null;
    }
  }

  return AUTHENTICATED_ASSET_PATH_PATTERN.test(pathname) ? pathname : null;
}

export function authenticatedAssetRequestPath(src: string): string | null {
  const normalizedUrl = normalizeAuthenticatedAssetUrl(src);
  return normalizedUrl ? normalizedUrl.slice("/api/v1".length) : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DOCUMENT_ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls,text/plain,.txt,application/zip,.zip,application/vnd.rar,application/x-rar-compressed,.rar";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const LEGACY_PLACEHOLDER_URL_PATTERN = /!\[[^\]]*\]\(https:\/\/mika\.local\/[^)]+\)/g;
const COMMENT_IMAGE_WIDTH_PATTERN = /(?:#|&)mika-width=(\d{1,4})$/;
const MIN_COMMENT_IMAGE_WIDTH = 80;
const MAX_COMMENT_IMAGE_WIDTH = 4096;

export type ParsedCommentImageSource = {
  src: string;
  width: number | null;
};

export function parseCommentImageSource(src: string): ParsedCommentImageSource {
  const match = COMMENT_IMAGE_WIDTH_PATTERN.exec(src);

  if (!match) {
    return { src, width: null };
  }

  const parsedWidth = Number.parseInt(match[1] ?? String(MIN_COMMENT_IMAGE_WIDTH), 10);
  const width = Math.min(MAX_COMMENT_IMAGE_WIDTH, Math.max(MIN_COMMENT_IMAGE_WIDTH, parsedWidth));

  return {
    src: src.slice(0, match.index),
    width
  };
}

export function withCommentImageWidth(src: string, width: unknown): string {
  const cleanSource = parseCommentImageSource(src).src;

  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
    return cleanSource;
  }

  const normalizedWidth = Math.min(
    MAX_COMMENT_IMAGE_WIDTH,
    Math.max(MIN_COMMENT_IMAGE_WIDTH, Math.round(width))
  );
  const separator = cleanSource.includes("#") ? "&" : "#";

  return `${cleanSource}${separator}mika-width=${normalizedWidth}`;
}

export function resolveCommentMarkdownForSubmit(
  markdown: string,
  blobToApiUrl: ReadonlyMap<string, string>
): string {
  let result = markdown;

  for (const [blobUrl, apiUrl] of blobToApiUrl) {
    if (apiUrl) {
      result = result.split(blobUrl).join(apiUrl);
    }
  }

  result = result.replace(LEGACY_PLACEHOLDER_URL_PATTERN, "");
  return result.trim();
}

export function extractImageFromClipboard(clipboardData: DataTransfer): File | null {
  for (const item of Array.from(clipboardData.items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();

      if (file) {
        return file;
      }
    }
  }

  for (const file of Array.from(clipboardData.files)) {
    if (classifyFile(file) === "image") {
      return file;
    }
  }

  return null;
}

function clipboardFileKey(file: File): string {
  return [file.name, file.type, file.size, file.lastModified].join(":");
}

export function extractDocumentsFromClipboard(clipboardData: DataTransfer): File[] {
  const files: File[] = [];
  const seen = new Set<string>();

  function addFile(file: File) {
    const key = clipboardFileKey(file);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    files.push(file);
  }

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== "file" || item.type.startsWith("image/")) {
      continue;
    }

    const file = item.getAsFile();

    if (file) {
      addFile(file);
    }
  }

  for (const file of Array.from(clipboardData.files)) {
    if (classifyFile(file) !== "image") {
      addFile(file);
    }
  }

  return files;
}
