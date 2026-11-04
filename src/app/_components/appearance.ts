import { useSyncExternalStore } from "react";

// Tema e tamanho da letra: preferências do aparelho (security.md §9: só preferência, nunca nada
// que dê acesso). Tudo que vem do localStorage é conferido; valor estranho é descartado.

export const THEME_KEY = "vecka-theme";
export const FONT_KEY = "vecka-font-step";
export const FONT_STEPS = 4;
export const DEFAULT_FONT_STEP = 1;

export type Theme = "light" | "dark";

export const parseTheme = (value: string | null): Theme | null =>
    value === "light" || value === "dark" ? value : null;

export const parseFontStep = (value: string | null): number =>
    value !== null && /^[0-9]$/.test(value) && Number(value) < FONT_STEPS
        ? Number(value)
        : DEFAULT_FONT_STEP;

function write(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // sem localStorage: vale até recarregar
    }
}

// o <html> é a fonte da verdade (o script de antes da pintura já o ajustou); quem muda avisa
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const notify = () => listeners.forEach((listener) => listener());

function isDarkNow(): boolean {
    const root = document.documentElement.classList;
    if (root.contains("dark")) return true;
    if (root.contains("light")) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const useDark = () => useSyncExternalStore(subscribe, isDarkNow, () => false);
export const useFontStep = () =>
    useSyncExternalStore(
        subscribe,
        () => parseFontStep(document.documentElement.dataset.font ?? null),
        () => DEFAULT_FONT_STEP,
    );

/** Sem tema salvo, segue o sistema (como o legacy); o ícone fixa a escolha neste aparelho. */
export function applyTheme(theme: Theme, save: boolean) {
    const root = document.documentElement.classList;
    root.toggle("dark", theme === "dark");
    root.toggle("light", theme === "light");
    if (save) write(THEME_KEY, theme);
    notify();
}

export function applyFontStep(step: number, save: boolean) {
    document.documentElement.dataset.font = String(step);
    if (save) write(FONT_KEY, String(step));
    notify();
}
