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
  editedAt?: string | null;
  editedBy?: Pick<User, "id" | "name"> | null;
}

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
  /** Quando informado, o servidor responde 409 se o comentário mudou depois dessa data. */
  expectedUpdatedAt?: string;
}

export type CommentRevisionType = "EDITED" | "DELETED" | "ATTACHMENT_REMOVED";

export interface CommentRevision {
  id: string;
  taskId: string;
  commentId: string;
  type: CommentRevisionType;
  content: string;
  commentCreatedAt: string;
  createdAt: string;
  author: Pick<User, "id" | "name"> | null;
  actor: Pick<User, "id" | "name"> | null;
  attachments: AttachmentDto[];
}
