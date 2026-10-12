// Toast notifications and the styled confirm dialog.
import { CONFIG, Prefs } from './config';
import { createStore } from './store';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
    id: number;
    message: string;
    kind: ToastKind;
    leaving: boolean;
    /** Bumped when a duplicate is shown, to replay the "pulse" animation. */
    pulse: number;
}

const MAX_TOASTS = 3;
let nextId = 0;
const timers = new Map<number, number>();

export const toastStore = createStore({
    items: [] as Toast[],
    /** Seconds a toast stays visible; 0 = until dismissed. */
    duration: Prefs.getInt(
        CONFIG.storage.KEYS.TOAST_DURATION,
        CONFIG.ui.TOAST_DEFAULT_DURATION,
        0,
    ),
});

export function setToastDuration(value: number): void {
    if (!Number.isInteger(value) || value < 0) return;
    toastStore.set({ duration: value });
    Prefs.set(CONFIG.storage.KEYS.TOAST_DURATION, String(value));
}

export function dismissToast(id: number): void {
    const t = timers.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.delete(id);
    toastStore.set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, leaving: true } : i)),
    }));
    setTimeout(() => {
        toastStore.set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    }, CONFIG.ui.FADE_OUT_MS);
}

export function showToast(
    message: string,
    kind: ToastKind = 'success',
    duration = toastStore.get().duration,
): void {
    const { items } = toastStore.get();
    const existing = items.find((i) => i.message === message && !i.leaving);
    if (existing) {
        toastStore.set({
            items: items.map((i) =>
                i === existing ? { ...i, pulse: i.pulse + 1 } : i,
            ),
        });
        return;
    }
    const visible = items.filter((i) => !i.leaving);
    if (visible.length >= MAX_TOASTS) dismissToast(visible[0].id);

    const id = ++nextId;
    toastStore.set((s) => ({
        items: [...s.items, { id, message, kind, leaving: false, pulse: 0 }],
    }));
    if (duration > 0)
        timers.set(
            id,
            window.setTimeout(() => dismissToast(id), duration * 1000),
        );
}

// ------------------------------------------------------------------
// Confirm dialog
// ------------------------------------------------------------------
export const confirmStore = createStore({
    open: false,
    message: '',
    okLabel: 'OK',
});

let resolveConfirm: ((ok: boolean) => void) | null = null;

export function showConfirm(message: string, okLabel = 'Overwrite'): Promise<boolean> {
    resolveConfirm?.(false);
    confirmStore.set({ open: true, message, okLabel });
    return new Promise((resolve) => {
        resolveConfirm = resolve;
    });
}

export function answerConfirm(ok: boolean): void {
    confirmStore.set({ open: false });
    const r = resolveConfirm;
    resolveConfirm = null;
    r?.(ok);
}
