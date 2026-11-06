import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { Comment, CommentRevision, CreateCommentRequest, UpdateCommentRequest } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { invalidateTeamBoardQueries } from "./useTeamBoard";

interface CommentsResponse {
  comments: Comment[];
}

interface CommentResponse {
  comment: Comment;
}

interface CommentRevisionsResponse {
  revisions: CommentRevision[];
}

function invalidateCommentAudit(taskId: string | undefined) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comment-revisions"] }),
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "projects" && query.queryKey[2] === "log"
    })
  ]);
}

export function useCommentRevisions(taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["tasks", taskId, "comment-revisions"],
    enabled: Boolean(taskId) && enabled,
    queryFn: async () => {
      const response = await api.get<CommentRevisionsResponse>(`/tasks/${taskId}/comment-revisions`);
      return response.data.revisions;
    }
  });
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
      invalidateTeamBoardQueries();
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] }),
        invalidateCommentAudit(taskId)
      ]);
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
      }
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
      invalidateTeamBoardQueries();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "history"] }),
        invalidateCommentAudit(taskId)
      ]);
    }
  });
}
