import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { getApiBaseUrl } from "./runtimeConfig";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  config.baseURL = getApiBaseUrl();

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
    const requestUrl = originalRequest?.url ?? "";
    const isRefreshRoute = requestUrl.includes("/auth/refresh");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshRoute) {
      originalRequest._retry = true;

      const refreshed = await useAuthStore.getState().refreshSession({ silent: true });

      if (refreshed) {
        const token = useAuthStore.getState().accessToken;
        const headers = AxiosHeaders.from(originalRequest.headers);

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        originalRequest.headers = headers;
        originalRequest.baseURL = getApiBaseUrl();
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
