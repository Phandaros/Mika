import { useMutation, useQuery } from "@tanstack/react-query";
import type { Comment, CreateCommentRequest, UpdateCommentRequest } from "shared";
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "history"] })
      ]);
    }
  });
}

export function useUpdateComment(taskId: string | undefined) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCommentRequest }) => {
      const response = await api.patch<CommentResponse>(`/comments/${id}`, payload);
      return response.data.comment;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
    }
  });
}

export function useDeleteComment(taskId: string | undefined) {
  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`);
      return commentId;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "history"] })
      ]);
    }
  });
}
