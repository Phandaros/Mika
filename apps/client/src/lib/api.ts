import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const isRefreshRoute = originalRequest?.url?.includes("/auth/refresh") ?? false;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshRoute) {
      originalRequest._retry = true;
      const refreshed = await useAuthStore.getState().refreshSession();

      if (refreshed) {
        const token = useAuthStore.getState().accessToken;
        const headers = AxiosHeaders.from(originalRequest.headers);

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        originalRequest.headers = headers;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
