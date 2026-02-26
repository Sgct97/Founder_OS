/**
 * API configuration constants.
 * The base URL is read from environment variables set in .env.
 */

import Constants from "expo-constants";

const expoConfig = Constants.expoConfig;

export const API_BASE_URL: string =
  (expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:8000";

export const API_V1 = `${API_BASE_URL}/api/v1`;

