import axios from "axios";
import { create } from "zustand";
import type { AuthResponse, AuthUser } from "shared";
import {
  connectNotificationSocket,
  disconnectNotificationSocket
} from "../lib/socket";
import { getApiBaseUrl } from "../lib/runtimeConfig";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: false,
  setSession: (user, accessToken) => {
    set({ user, accessToken });
    connectNotificationSocket(user.id);
  },
  login: async (email, password) => {
    const response = await axios.post<AuthResponse>(
      `${getApiBaseUrl()}/auth/login`,
      { email, password },
      { withCredentials: true }
    );

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
    set({ user: null, accessToken: null });
  },
  refreshSession: async () => {
    set({ isBootstrapping: true });

    try {
      const response = await axios.post<AuthResponse>(
        `${getApiBaseUrl()}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      set({ user: response.data.user, accessToken: response.data.accessToken });
      connectNotificationSocket(response.data.user.id);
      return true;
    } catch {
      disconnectNotificationSocket();
      set({ user: null, accessToken: null });
      return false;
    } finally {
      set({ isBootstrapping: false });
    }
  }
}));
