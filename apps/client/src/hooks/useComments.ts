import { useMutation, useQuery } from "@tanstack/react-query";
import type { Comment, CreateCommentRequest } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface CommentsResponse {
  comments: Comment[];
}

interface CommentResponse {
  comment: Comment;
}

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", taskId, "comments"],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const response = await api.get<CommentsResponse>(`/tasks/${taskId}/comments`);
      return response.data.comments;
    }
  });
}

export function useCreateComment(taskId: string | undefined) {
  return useMutation({
    mutationFn: async (payload: CreateCommentRequest) => {
      const response = await api.post<CommentResponse>(`/tasks/${taskId}/comments`, payload);
      return response.data.comment;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
    }
  });
}
