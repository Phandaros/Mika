import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateUserRequest, User } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface UsersResponse {
  users: User[];
}

interface UserResponse {
  user: User;
}

interface ResetPasswordResponse {
  user: User;
  temporaryPassword: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get<UsersResponse>("/users");
      return response.data.users;
    }
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (payload: CreateUserRequest) => {
      const response = await api.post<UserResponse>("/users", payload);
      return response.data.user;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}

export function useDeactivateUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.patch<ResetPasswordResponse>(`/users/${userId}/reset-password`);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}
