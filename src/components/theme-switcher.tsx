"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { type Theme } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const options: Array<{
  theme: Theme;
  label: string;
  icon: typeof Sun;
}> = [
  { theme: "light", label: "Açık", icon: Sun },
  { theme: "dark", label: "Koyu", icon: Moon },
  { theme: "system", label: "Sistem", icon: Monitor },
];

const subscribe = () => () => {};

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div
      aria-label="Tema tercihi"
      className={`inline-flex rounded-lg border bg-muted p-1 ${compact ? "gap-0" : "gap-1"}`}
      role="group"
    >
      {options.map(({ theme: optionTheme, label, icon: Icon }) => {
        const selected = mounted && theme === optionTheme;
        return (
          <Button
            aria-label={`${label} tema`}
            aria-pressed={selected}
            className={compact ? "size-8 p-0" : "h-8 px-2.5"}
            key={optionTheme}
            onClick={() => setTheme(optionTheme)}
            size="sm"
            type="button"
            variant={selected ? "secondary" : "ghost"}
          >
            <Icon aria-hidden="true" />
            <span className={compact ? "sr-only" : ""}>{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
