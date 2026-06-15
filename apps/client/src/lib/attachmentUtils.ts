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

export function toAbsoluteApiUrl(relativePath: string): string {
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }

  const origin = getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
  return relativePath.startsWith("/") ? `${origin}${relativePath}` : `${origin}/${relativePath}`;
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
