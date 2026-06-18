import { File, FileText, Table2, X } from "lucide-react";
import type { AttachmentDto } from "shared";
import { Role } from "shared";
import { useDeleteAttachment } from "../../hooks/useCommentAttachments";
import { openAuthenticatedAsset } from "../../hooks/useAuthenticatedAsset";
import { attachmentFileUrl, formatFileSize } from "../../lib/attachmentUtils";
import { cn } from "../../lib/utils";

interface AttachmentPreviewProps {
  attachment: AttachmentDto;
  taskId?: string;
  currentUserId?: string;
  currentUserRole?: string;
  className?: string;
  canDeleteOverride?: boolean;
  onDeleted?: () => void | Promise<void>;
}

function attachmentIcon(mimeType: string) {
  if (mimeType === "application/pdf" || mimeType.includes("wordprocessingml")) {
    return <FileText size={16} className="shrink-0 text-[--color-text-secondary]" />;
  }

  if (mimeType.includes("spreadsheet") || mimeType === "application/vnd.ms-excel") {
    return <Table2 size={16} className="shrink-0 text-[--color-text-secondary]" />;
  }

  return <File size={16} className="shrink-0 text-[--color-text-secondary]" />;
}

export function AttachmentPreview({
  attachment,
  taskId,
  currentUserId,
  currentUserRole,
  className,
  canDeleteOverride,
  onDeleted
}: AttachmentPreviewProps) {
  const deleteAttachment = useDeleteAttachment(taskId);
  const canDelete =
    canDeleteOverride ??
    (attachment.uploadedById === currentUserId ||
      currentUserRole === Role.ADMIN ||
      currentUserRole === Role.COORDINATOR);

  async function handleOpen() {
    await openAuthenticatedAsset(attachmentFileUrl(attachment.id));
  }

  async function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();

    const confirmed = window.confirm(`Remover o anexo "${attachment.filename}"?`);

    if (!confirmed) {
      return;
    }

    await deleteAttachment.mutateAsync(attachment.id);
    await onDeleted?.();
  }

  return (
    <div
      className={cn(
        "group relative flex max-w-full items-center gap-2 rounded-md border border-[--color-border] bg-[--bg-3] px-2.5 py-1.5 transition-colors hover:bg-[--bg-4]",
        className
      )}
    >
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={attachment.filename}
      >
        {attachmentIcon(attachment.mimeType)}
        <div className="min-w-0">
          <p className="max-w-[160px] truncate text-[13px] text-[--color-text-primary]">{attachment.filename}</p>
          <p className="text-[11px] text-[--color-text-muted]">{formatFileSize(attachment.sizeBytes)}</p>
        </div>
      </button>

      {canDelete ? (
        <button
          type="button"
          aria-label="Remover anexo"
          title="Remover anexo"
          disabled={deleteAttachment.isPending}
          onClick={(event) => void handleDelete(event)}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[--color-border] bg-[--bg-2] text-[--color-text-muted] opacity-0 transition-opacity hover:text-[--status-late-text] group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}
