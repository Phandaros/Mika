import axios from "axios";
import { create } from "zustand";
import type { AuthResponse, AuthUser } from "shared";
import {
  connectNotificationSocket,
  disconnectNotificationSocket
} from "../lib/socket";
import { getApiBaseUrl } from "../lib/runtimeConfig";

const AUTH_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const AUTH_CACHE_EXPIRES_AT_KEY = "mkProjetos.authCacheExpiresAt";
const LAST_LOGIN_EMAIL_KEY = "mkProjetos.lastLoginEmail";

let refreshSessionPromise: Promise<boolean> | null = null;

interface RefreshSessionOptions {
  silent?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: (options?: RefreshSessionOptions) => Promise<boolean>;
}

function readLocalStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Login must keep working even if localStorage is unavailable.
  }
}

function removeLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Session cleanup should not fail because localStorage is unavailable.
  }
}

function normalizeEmail(email: string): string {
  return email.trim();
}

function renewAuthCache(): void {
  writeLocalStorage(AUTH_CACHE_EXPIRES_AT_KEY, String(Date.now() + AUTH_CACHE_DURATION_MS));
}

function clearAuthCache(): void {
  removeLocalStorage(AUTH_CACHE_EXPIRES_AT_KEY);
}

function isConfirmedAuthFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

export function getLastLoginEmail(): string {
  return readLocalStorage(LAST_LOGIN_EMAIL_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: false,
  setSession: (user, accessToken) => {
    set({ user, accessToken });
    renewAuthCache();
    connectNotificationSocket(user.id);
  },
  login: async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    const response = await axios.post<AuthResponse>(
      `${getApiBaseUrl()}/auth/login`,
      { email: normalizedEmail, password },
      { withCredentials: true }
    );

    writeLocalStorage(LAST_LOGIN_EMAIL_KEY, normalizedEmail);
    renewAuthCache();
    set({ user: response.data.user, accessToken: response.data.accessToken });
    connectNotificationSocket(response.data.user.id);
  },
  logout: async () => {
    try {
      await axios.post(`${getApiBaseUrl()}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // The local session must still be cleared if the server is unreachable.
    }

    disconnectNotificationSocket();
    clearAuthCache();
    set({ user: null, accessToken: null });
  },
  refreshSession: (options = {}) => {
    if (!options.silent) {
      set({ isBootstrapping: true });
    }

    if (!refreshSessionPromise) {
      refreshSessionPromise = (async () => {
        try {
          const response = await axios.post<AuthResponse>(
            `${getApiBaseUrl()}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          renewAuthCache();
          set({ user: response.data.user, accessToken: response.data.accessToken });
          connectNotificationSocket(response.data.user.id);
          return true;
        } catch (error) {
          if (isConfirmedAuthFailure(error)) {
            disconnectNotificationSocket();
            clearAuthCache();
            set({ user: null, accessToken: null });
          }

          return false;
        } finally {
          refreshSessionPromise = null;
        }
      })();
    }

    return refreshSessionPromise.finally(() => {
      if (!options.silent) {
        set({ isBootstrapping: false });
      }
    });
  }
}));
