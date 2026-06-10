export interface AttachmentDto {
  id: string;
  commentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}
