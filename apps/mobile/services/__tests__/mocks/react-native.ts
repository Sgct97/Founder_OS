export const Platform = { OS: "web" as const };

export const Appearance = {
  getColorScheme: () => "dark" as const,
};

export function useColorScheme(): "light" | "dark" | null {
  return "dark";
}
