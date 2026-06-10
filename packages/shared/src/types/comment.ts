import type { AttachmentDto } from "./attachment.js";
import { User } from "./user.js";

export interface Comment {
  id: string;
  taskId: string;
  authorId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  asanaGid?: string | null;
  asanaCreatedAt?: string | null;
  author?: User | null;
  attachments?: AttachmentDto[];
}

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}
