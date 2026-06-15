import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  TaskReview,
  TaskReviewDecisionRequest,
  TaskReviewsResponse,
  TaskReviewStatus,
  UpdateTaskReviewRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface ReviewResponse {
  review: TaskReview;
  adjustmentTaskId?: string;
}

interface UseReviewsParams {
  status?: TaskReviewStatus;
  assigneeId?: string;
  page?: number;
  limit?: number;
}

export interface ReviewDecisionPayload extends TaskReviewDecisionRequest {
  files?: File[];
}

export function useReviews(params: UseReviewsParams) {
  return useQuery({
    queryKey: ["reviews", params],
    queryFn: async () => {
      const response = await api.get<TaskReviewsResponse>("/reviews", { params });
      return response.data;
    }
  });
}

export function useReviewById(reviewId: string | null | undefined) {
  return useQuery({
    queryKey: ["reviews", reviewId],
    enabled: Boolean(reviewId),
    queryFn: async () => {
      const response = await api.get<ReviewResponse>(`/reviews/${reviewId}`);
      return response.data.review;
    }
  });
}

export function useUpdateReview() {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTaskReviewRequest }) => {
      const response = await api.patch<ReviewResponse>(`/reviews/${id}`, payload);
      return response.data.review;
    },
    onSuccess: (review) => {
      queryClient.setQueryData(["reviews", review.id], review);
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    }
  });
}

export function useApproveReview() {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReviewDecisionPayload }) => {
      const response = await api.post<ReviewResponse>(`/reviews/${id}/approve`, reviewDecisionRequestBody(payload));
      return response.data.review;
    },
    onSuccess: () => {
      void invalidateReviewWorkflowCaches();
    }
  });
}

export function useRejectReview() {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReviewDecisionPayload }) => {
      const response = await api.post<ReviewResponse>(`/reviews/${id}/reject`, reviewDecisionRequestBody(payload));
      return response.data;
    },
    onSuccess: () => {
      void invalidateReviewWorkflowCaches();
    }
  });
}

function reviewDecisionRequestBody(payload: ReviewDecisionPayload): TaskReviewDecisionRequest | FormData {
  if (!payload.files?.length) {
    return { message: payload.message };
  }

  const formData = new FormData();

  if (payload.message) {
    formData.append("message", payload.message);
  }

  for (const file of payload.files) {
    formData.append("files", file);
  }

  return formData;
}

async function invalidateReviewWorkflowCaches() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["reviews"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["task"] }),
    queryClient.invalidateQueries({ queryKey: ["sections"] }),
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey[0] === "sprintBoardTasks" ||
          query.queryKey[0] === "sprintBoardSummary" ||
          query.queryKey[0] === "projectWorkloadTasks" ||
          query.queryKey[0] === "globalWorkloadTasks")
    })
  ]);
}
