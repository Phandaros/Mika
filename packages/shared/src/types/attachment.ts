export interface AttachmentDto {
  id: string;
  commentId: string | null;
  projectNoteId?: string | null;
  meetingMinuteId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}
