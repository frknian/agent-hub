export const themes = ["light", "dark", "system"] as const;

export type Theme = (typeof themes)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_STORAGE_KEY = "agent-hub-theme";

export function parseTheme(value: string | null | undefined): Theme {
  return themes.includes(value as Theme) ? (value as Theme) : "system";
}

export function resolveTheme(
  theme: Theme,
  systemIsDark: boolean,
): ResolvedTheme {
  if (theme === "system") return systemIsDark ? "dark" : "light";
  return theme;
}
