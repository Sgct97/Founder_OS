/**
 * Shared HTTP client for all API calls.
 *
 * - Automatically attaches the Bearer token from Supabase session.
 * - Provides typed request helpers (get, post, patch, delete).
 * - All API calls in the app must go through this module.
 */

import { API_BASE_URL } from "@/constants/api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "supabase_access_token";

/** Store the access token securely (SecureStore on native, localStorage on web). */
export async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

/** Retrieve the stored access token. */
export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Clear the stored access token on logout. */
export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/** Structured API error thrown by request helpers. */
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Build common headers for every request. */
async function buildHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };

  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Parse the API response — throw ApiError on non-2xx. */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // Response body wasn't JSON — use default message.
    }
    throw new ApiError(response.status, detail);
  }

  // 204 No Content — return empty.
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json() as Promise<T>;
}

/** Typed GET request. */
export async function apiGet<T>(path: string): Promise<T> {
  const headers = await buildHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  return handleResponse<T>(response);
}

/** Typed POST request. */
export async function apiPost<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await buildHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

/** Typed PATCH request. */
export async function apiPatch<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await buildHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

/** Typed DELETE request. */
export async function apiDelete<T = void>(path: string): Promise<T> {
  const headers = await buildHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse<T>(response);
}

