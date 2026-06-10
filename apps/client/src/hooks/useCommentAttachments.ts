import { useMutation } from "@tanstack/react-query";
import type { AttachmentDto } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface InlineImageUploadResponse {
  id: string;
  url: string;
  filename: string;
  attachment: AttachmentDto;
}

interface AttachmentsUploadResponse {
  attachments: AttachmentDto[];
}

export function useUploadInlineImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post<InlineImageUploadResponse>("/attachments/image-upload", formData);

      return response.data;
    }
  });
}

export function useUploadCommentAttachments(taskId: string | undefined) {
  return useMutation({
    mutationFn: async ({ commentId, files }: { commentId: string; files: File[] }) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await api.post<AttachmentsUploadResponse>(`/comments/${commentId}/attachments`, formData);

      return response.data.attachments;
    },
    onSuccess: async () => {
      if (taskId) {
        await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
      }
    }
  });
}

export function useDeleteAttachment(taskId: string | undefined) {
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/attachments/${attachmentId}`);
      return attachmentId;
    },
    onSuccess: async () => {
      if (taskId) {
        await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
      }
    }
  });
}
