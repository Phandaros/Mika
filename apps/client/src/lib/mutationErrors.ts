import { isAxiosError } from "axios";

export function resolveMutationErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const apiError = (error.response?.data as { error?: string } | undefined)?.error?.trim();
    if (apiError) {
      return apiError;
    }

    if (error.code === "ERR_NETWORK") {
      return "Não foi possível conectar ao servidor. Em desenvolvimento, confirme se o backend está em http://localhost:3101.";
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
