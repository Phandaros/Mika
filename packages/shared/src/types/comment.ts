import { User } from "./user.js";

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: User;
}

export interface CreateCommentRequest {
  content: string;
}
