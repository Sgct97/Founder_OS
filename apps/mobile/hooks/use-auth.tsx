/**
 * Auth context — provides user state, login/signup/logout actions,
 * and the loading gate for the entire app.
 *
 * Wrap the root layout with <AuthProvider> and consume with useAuth().
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import type { UserProfile, WorkspaceInfo } from "@/types/auth";
import * as authService from "@/services/auth";
import { clearAccessToken, getAccessToken } from "@/services/api";

// ── State ────────────────────────────────────────────────────────

interface AuthState {
  /** True while checking for an existing session on app launch. */
  isLoading: boolean;
  /** The currently authenticated user, or null. */
  user: UserProfile | null;
  /** The user's workspace, or null. */
  workspace: WorkspaceInfo | null;
}

type AuthAction =
  | { type: "SET_LOADING" }
  | { type: "SET_AUTH"; user: UserProfile; workspace: WorkspaceInfo | null }
  | { type: "CLEAR_AUTH" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: true };
    case "SET_AUTH":
      return {
        isLoading: false,
        user: action.user,
        workspace: action.workspace,
      };
    case "CLEAR_AUTH":
      return { isLoading: false, user: null, workspace: null };
  }
}

// ── Context ──────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  signUp: (
    email: string,
    password: string,
    displayName: string,
    workspaceName: string
  ) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    user: null,
    workspace: null,
  });

  // On mount, check if there's an existing session.
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          dispatch({ type: "CLEAR_AUTH" });
          return;
        }
        const { user, workspace } = await authService.getMe();
        dispatch({ type: "SET_AUTH", user, workspace });
      } catch {
        await clearAccessToken();
        dispatch({ type: "CLEAR_AUTH" });
      }
    })();
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      workspaceName: string
    ) => {
      const { user, workspace } = await authService.signUp(
        email,
        password,
        displayName,
        workspaceName
      );
      dispatch({ type: "SET_AUTH", user, workspace });
    },
    []
  );

  const logIn = useCallback(async (email: string, password: string) => {
    const { user, workspace } = await authService.logIn(email, password);
    dispatch({ type: "SET_AUTH", user, workspace });
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    dispatch({ type: "CLEAR_AUTH" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signUp, logIn, signOut }),
    [state, signUp, logIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Access auth state and actions from any component.
 *
 * @example
 * const { user, logIn, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

