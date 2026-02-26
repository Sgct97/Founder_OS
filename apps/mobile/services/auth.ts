/**
 * Auth service — wraps Supabase Auth + our backend /api/v1/auth endpoints.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { apiGet, apiPost, setAccessToken, clearAccessToken } from "@/services/api";
import type {
  AuthResponse,
  InviteResponse,
  JoinPayload,
} from "@/types/auth";

// ── Supabase client (lazy — safe even without env vars) ─────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
    );
  }
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

/** Re-export for components that need the client directly. */
export function getSupabaseClient(): SupabaseClient {
  return getSupabase();
}

// ── Auth operations ──────────────────────────────────────────────

/**
 * Sign up via Supabase Auth, then register the user + workspace on our backend.
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  workspaceName: string
): Promise<AuthResponse> {
  // 1. Create the Supabase Auth account.
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user) {
    throw new Error("Signup succeeded but no session was returned");
  }

  // 2. Store the JWT so our API client can attach it.
  await setAccessToken(data.session.access_token);

  // 3. Register user + workspace on our backend.
  const response = await apiPost<AuthResponse>("/api/v1/auth/signup", {
    email,
    display_name: displayName,
    workspace_name: workspaceName,
    supabase_uid: data.user.id,
  });

  return response;
}

/**
 * Log in via Supabase Auth, then fetch user profile from our backend.
 */
export async function logIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user) {
    throw new Error("Login succeeded but no session was returned");
  }

  await setAccessToken(data.session.access_token);

  const response = await apiPost<AuthResponse>("/api/v1/auth/login", {
    supabase_uid: data.user.id,
    email,
  });

  return response;
}

/**
 * Join an existing workspace via invite code.
 * Caller must already be signed up on Supabase Auth.
 */
export async function joinWorkspace(
  inviteCode: string,
  email: string,
  displayName: string,
  supabaseUid: string
): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>("/api/v1/auth/join", {
    invite_code: inviteCode,
    email,
    display_name: displayName,
    supabase_uid: supabaseUid,
  } satisfies JoinPayload);

  return response;
}

/** Get the current user's profile from the backend. */
export async function getMe(): Promise<AuthResponse> {
  return apiGet<AuthResponse>("/api/v1/auth/me");
}

/** Regenerate the workspace invite code. */
export async function regenerateInvite(): Promise<InviteResponse> {
  return apiPost<InviteResponse>("/api/v1/auth/invite");
}

/** Sign out — clear tokens and Supabase session. */
export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch {
    // If Supabase isn't configured, just clear local token.
  }
  await clearAccessToken();
}

