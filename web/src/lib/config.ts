// Single source of truth for frontend constants and the localStorage
// preference wrapper.

export const CONFIG = {
    // Reconnect backoff. Exponential: BASE_DELAY * 2^(attempt-1), capped.
    reconnect: {
        MAX_RETRIES: 10,
        BASE_DELAY: 1000,
        MAX_DELAY: 30000,
    },

    // Heartbeat / liveness. NOTE: these are an implicit contract with the
    // server, which sends protocol-level WS pings every 30s and drops the
    // connection after 90s without a pong (see CLAUDE.md "Idle-connection
    // liveness"). Keep them in sync if the server changes.
    heartbeat: {
        INTERVAL: 30000,
        PONG_TIMEOUT: 90000,
        PONG_CHECK_INTERVAL: 10000,
        FOREGROUND_PROBE_TIMEOUT: 5000,
    },

    ui: {
        DEFAULT_FONT_SIZE: 14,
        MIN_FONT_SIZE: 8,
        MAX_FONT_SIZE: 32,
        TOAST_DEFAULT_DURATION: 4, // seconds; 0 = sticky
        UPLOAD_HIDE_DELAY: 4000, // ms before finished transfers settle into the idle icon
        RESIZE_DEBOUNCE: 100, // ms
        LOADING_DELAY: 250, // ms before file-panel spinner shows
        FADE_OUT_MS: 200, // toast fade-out duration
    },

    storage: {
        PREFIX: 'ttyd.',
        KEYS: {
            FONT_SIZE: 'fontSize',
            CURSOR_BLINK: 'cursorBlink',
            TOAST_DURATION: 'toastDuration',
            SHOW_HIDDEN: 'showHidden',
            SHORTCUTS: 'shortcuts',
            SHORTCUT_BAR_VISIBLE: 'shortcutBarVisible',
        },
    },
} as const;

/** Namespaced localStorage wrapper. Storage can be unavailable (private
 *  mode, blocked site data), so every access is best effort. */
export const Prefs = {
    key(name: string): string {
        return CONFIG.storage.PREFIX + name;
    },

    get(name: string): string | null {
        try {
            return localStorage.getItem(Prefs.key(name));
        } catch {
            return null;
        }
    },

    set(name: string, value: string): void {
        try {
            localStorage.setItem(Prefs.key(name), value);
        } catch {
            /* quota / privacy errors are non-fatal */
        }
    },

    getInt(name: string, fallback: number, min = -Infinity, max = Infinity): number {
        const raw = parseInt(Prefs.get(name) ?? '', 10);
        if (!Number.isInteger(raw)) return fallback;
        return Math.min(max, Math.max(min, raw));
    },

    getBool(name: string, fallback: boolean): boolean {
        const v = Prefs.get(name);
        return v === null ? fallback : v === 'true';
    },
};
