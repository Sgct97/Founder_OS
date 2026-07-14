/**
 * Theme context — light / dark / system with persisted preference.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  DARK_COLORS,
  LIGHT_COLORS,
  type ColorPalette,
  type ThemeMode,
} from "@/constants/theme";

const STORAGE_KEY = "foundersforge_theme_mode";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  colors: ColorPalette;
  setMode: (mode: ThemeMode) => void;
  toggleLightDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredMode(): Promise<ThemeMode | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? localStorage.getItem(STORAGE_KEY)
        : await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignore
  }
  return null;
}

async function writeStoredMode(mode: ThemeMode): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEY, mode);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    }
  } catch {
    // ignore
  }
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStoredMode();
      if (!cancelled && stored) setModeState(stored);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writeStoredMode(next);
  }, []);

  const resolved: "light" | "dark" = useMemo(() => {
    if (mode === "system") {
      return systemScheme === "light" ? "light" : "dark";
    }
    return mode;
  }, [mode, systemScheme]);

  const colors = resolved === "light" ? LIGHT_COLORS : DARK_COLORS;

  const toggleLightDark = useCallback(() => {
    setMode(resolved === "light" ? "dark" : "light");
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, resolved, colors, setMode, toggleLightDark }),
    [mode, resolved, colors, setMode, toggleLightDark]
  );

  // Avoid flash of wrong theme on native after reading storage.
  if (!ready) {
    return (
      <ThemeContext.Provider
        value={{
          mode: "dark",
          resolved: "dark",
          colors: DARK_COLORS,
          setMode,
          toggleLightDark,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

export function getSystemScheme(): "light" | "dark" {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}
