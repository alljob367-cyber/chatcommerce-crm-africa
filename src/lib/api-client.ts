import { useAppStore } from "@/store/app";

/**
 * Centralized API client with:
 * - Automatic auth header injection
 * - 401/403 interception → auto-logout
 * - Consistent error handling
 */

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...restOptions } = options;
  const { token, logout } = useAppStore.getState();

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    if (!token) {
      logout();
      throw new Error("Non authentifie");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!headers["Content-Type"] && !(restOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...restOptions, headers });

  // Handle 401/403 → auto logout
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error(res.status === 401 ? "Session expiree" : "Acces refuse");
  }

  // Handle other HTTP errors
  if (!res.ok) {
    let errorMsg = "Erreur serveur";
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMsg);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Convenience methods
export const api = {
  get: <T = unknown>(url: string, options?: FetchOptions) =>
    apiClient<T>(url, { ...options, method: "GET" }),

  post: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  del: <T = unknown>(url: string, options?: FetchOptions) =>
    apiClient<T>(url, { ...options, method: "DELETE" }),
};
