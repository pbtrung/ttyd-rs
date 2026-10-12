// The ghostty-web terminal instance, display preferences, copy support and
// touch scrolling.
import { FitAddon, Ghostty, Terminal } from 'ghostty-web';
import wasmUrl from 'ghostty-web/ghostty-vt.wasm?url';
import { CONFIG, Prefs } from './config';
import { createStore } from './store';
import { showToast } from './toast';

const { DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE } = CONFIG.ui;

// JetBrains Mono for text; 0xProto Nerd Font is only declared for the
// private-use ranges, so it supplies Nerd Font icons (prompts, ls icons)
// without being downloaded otherwise.
export const TERMINAL_FONT =
    '"JetBrains Mono Variable", "Nerd Symbols", ui-monospace, Menlo, Consolas, monospace';

export const termPrefs = createStore({
    fontSize: Prefs.getInt(
        CONFIG.storage.KEYS.FONT_SIZE,
        DEFAULT_FONT_SIZE,
        MIN_FONT_SIZE,
        MAX_FONT_SIZE,
    ),
    cursorBlink: Prefs.getBool(CONFIG.storage.KEYS.CURSOR_BLINK, true),
    hasSelection: false,
});

export let term!: Terminal;
export let fitAddon!: FitAddon;

/** Load the WASM core and the web font, then create the terminal. Must
 *  finish before React renders. The canvas renderer measures the cell size
 *  once, so the font has to be ready first. */
export async function createTerminal(): Promise<void> {
    const { fontSize, cursorBlink } = termPrefs.get();
    const [ghostty] = await Promise.all([
        Ghostty.load(wasmUrl),
        Promise.all([
            document.fonts.load(`${fontSize}px "JetBrains Mono Variable"`),
            document.fonts.load(`bold ${fontSize}px "JetBrains Mono Variable"`),
        ]).catch(() => undefined),
    ]);

    term = new Terminal({
        ghostty,
        cursorBlink,
        fontSize,
        fontFamily: TERMINAL_FONT,
        scrollback: 10000,
        theme: {
            background: '#18181b',
            foreground: '#e4e4e7',
            cursor: '#5eead4',
            cursorAccent: '#18181b',
            selectionBackground: 'rgba(45, 212, 191, 0.3)',
            black: '#27272a',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#facc15',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#d4d4d8',
            brightBlack: '#71717a',
            brightRed: '#fca5a5',
            brightGreen: '#86efac',
            brightYellow: '#fde047',
            brightBlue: '#93c5fd',
            brightMagenta: '#d8b4fe',
            brightCyan: '#67e8f9',
            brightWhite: '#fafafa',
        },
    });
    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.onSelectionChange(() => termPrefs.set({ hasSelection: term.hasSelection() }));

    // Warm the Nerd Font icon face in the background so icons appear
    // without waiting for a glyph to trigger the download.
    void document.fonts
        .load(`${fontSize}px "Nerd Symbols"`, '')
        .catch(() => undefined);
}

/** Attach the terminal to its container (called once by TerminalView). */
export function openTerminal(el: HTMLElement): void {
    term.open(el);
    fitAddon.fit();
    attachTouchScroll(el);
    attachDoubleClickCopy(el);
}

/** Fit to the container; the terminal's onResize then reports the size. */
export function fit(): void {
    fitAddon?.fit();
}

/** Columns/rows the container fits right now (falls back to the current size). */
export function currentDimensions(): { cols: number; rows: number } {
    return fitAddon.proposeDimensions() ?? { cols: term.cols, rows: term.rows };
}

// ------------------------------------------------------------------
// Preferences
// ------------------------------------------------------------------
export function setFontSize(size: number): void {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    if (next === termPrefs.get().fontSize) return;
    termPrefs.set({ fontSize: next });
    Prefs.set(CONFIG.storage.KEYS.FONT_SIZE, String(next));
    term.options.fontSize = next;
    fit();
}

export const zoomIn = () => setFontSize(termPrefs.get().fontSize + 1);
export const zoomOut = () => setFontSize(termPrefs.get().fontSize - 1);
export const resetZoom = () => setFontSize(DEFAULT_FONT_SIZE);

export function setCursorBlink(on: boolean): void {
    termPrefs.set({ cursorBlink: on });
    Prefs.set(CONFIG.storage.KEYS.CURSOR_BLINK, String(on));
    term.options.cursorBlink = on;
}

// ------------------------------------------------------------------
// Clipboard
// ------------------------------------------------------------------
export async function copySelection(): Promise<void> {
    const sel = term.getSelection();
    if (!sel) return;
    try {
        await navigator.clipboard.writeText(sel);
        showToast('Copied to clipboard', 'success');
    } catch {
        // Fallback for non-secure contexts (plain http on a LAN address).
        try {
            const ta = document.createElement('textarea');
            ta.value = sel;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showToast('Copied to clipboard', 'success');
        } catch {
            showToast('Copy failed', 'error');
        }
    }
}

/** Double-click a word to select and copy it in one go. */
function attachDoubleClickCopy(el: HTMLElement): void {
    let last = 0;
    el.addEventListener('mousedown', () => {
        const now = Date.now();
        if (now - last < 300) {
            setTimeout(() => {
                if (term.hasSelection()) void copySelection();
            }, 10);
        }
        last = now;
    });
}

// ------------------------------------------------------------------
// Touch: one-finger vertical swipe scrolls the scrollback (ghostty-web
// only handles wheel events). Taps still reach the terminal so the
// on-screen keyboard opens.
// ------------------------------------------------------------------
function attachTouchScroll(el: HTMLElement): void {
    let lastY: number | null = null;
    let carry = 0;
    el.addEventListener(
        'touchstart',
        (e) => {
            lastY = e.touches.length === 1 ? e.touches[0].clientY : null;
            carry = 0;
        },
        { passive: true },
    );
    el.addEventListener(
        'touchmove',
        (e) => {
            if (lastY === null || e.touches.length !== 1) return;
            const y = e.touches[0].clientY;
            const lineHeight = Math.max(1, term.renderer?.getMetrics().height ?? 16);
            carry += lastY - y;
            lastY = y;
            const lines = Math.trunc(carry / lineHeight);
            if (lines !== 0) {
                term.scrollLines(lines);
                carry -= lines * lineHeight;
            }
            e.preventDefault();
        },
        { passive: false },
    );
    el.addEventListener('touchend', () => {
        lastY = null;
    });
}

// ------------------------------------------------------------------
// System messages written into the terminal
// ------------------------------------------------------------------
export function writeSystemMessage(msg: string): void {
    term.write(`\r\n\x1b[90m[${msg}]\x1b[0m\r\n`);
}

export function writeErrorMessage(msg: string): void {
    term.write(`\r\n\x1b[91m[${msg}]\x1b[0m\r\n`);
}
