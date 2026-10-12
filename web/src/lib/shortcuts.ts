// The special-key bar and user-configurable keyboard shortcuts.
import { CONFIG, Prefs } from './config';
import { createStore } from './store';

export interface Shortcut {
    id: string;
    label: string;
    sequence: string;
    visible: boolean;
}

export const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
    { id: 'escape', label: 'Esc', sequence: '\x1b', visible: true },
    { id: 'tab', label: 'Tab', sequence: '\t', visible: true },
    { id: 'up', label: '↑', sequence: '\x1b[A', visible: true },
    { id: 'down', label: '↓', sequence: '\x1b[B', visible: true },
    { id: 'left', label: '←', sequence: '\x1b[D', visible: true },
    { id: 'right', label: '→', sequence: '\x1b[C', visible: true },
    { id: 'ctrl-c', label: 'Ctrl+C', sequence: '\x03', visible: true },
    { id: 'ctrl-d', label: 'Ctrl+D', sequence: '\x04', visible: true },
    { id: 'ctrl-l', label: 'Ctrl+L', sequence: '\x0c', visible: true },
    { id: 'page-up', label: 'PgUp', sequence: '\x1b[5~', visible: true },
    { id: 'page-down', label: 'PgDn', sequence: '\x1b[6~', visible: true },
];

const cloneDefaults = (): Shortcut[] => DEFAULT_SHORTCUTS.map((s) => ({ ...s }));

/** `\x1b`, `\n`, `\r`, `\t` escapes → raw characters. */
export function decodeTerminalSequence(value: string): string {
    return value
        .replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
        )
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
}

/** Raw control characters → `\xNN` for editing. */
export function formatTerminalSequence(sequence: string): string {
    return Array.from(sequence, (ch) => {
        const code = ch.charCodeAt(0);
        return code < 32 ? `\\x${code.toString(16).padStart(2, '0')}` : ch;
    }).join('');
}

function loadShortcuts(): Shortcut[] {
    const raw = Prefs.get(CONFIG.storage.KEYS.SHORTCUTS);
    if (!raw) return cloneDefaults();
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return cloneDefaults();
        const valid = parsed
            .filter(
                (s): s is Shortcut =>
                    !!s &&
                    typeof s.id === 'string' &&
                    typeof s.label === 'string' &&
                    typeof s.sequence === 'string',
            )
            .map((s) => ({
                id: s.id,
                label: s.label.slice(0, 32),
                sequence: s.sequence.slice(0, 128),
                visible: s.visible !== false,
            }));
        return valid.length ? valid : cloneDefaults();
    } catch {
        return cloneDefaults();
    }
}

export const shortcutStore = createStore({
    items: loadShortcuts(),
    barVisible: Prefs.getBool(
        CONFIG.storage.KEYS.SHORTCUT_BAR_VISIBLE,
        isTouchDevice(),
    ),
});

function isTouchDevice(): boolean {
    try {
        return window.matchMedia('(pointer: coarse)').matches;
    } catch {
        return false;
    }
}

export function setShortcuts(next: Shortcut[]): void {
    const items = next.map((s) => ({ ...s }));
    shortcutStore.set({ items });
    Prefs.set(CONFIG.storage.KEYS.SHORTCUTS, JSON.stringify(items));
}

export const resetShortcuts = () => setShortcuts(cloneDefaults());

export function setShortcutBarVisible(visible: boolean): void {
    shortcutStore.set({ barVisible: visible });
    Prefs.set(CONFIG.storage.KEYS.SHORTCUT_BAR_VISIBLE, String(visible));
}

export function moveShortcut(id: string, offset: number): void {
    const items = shortcutStore.get().items;
    const index = items.findIndex((s) => s.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setShortcuts(next);
}

export function moveShortcutTo(id: string, targetId: string, after: boolean): void {
    if (id === targetId) return;
    const items = shortcutStore.get().items;
    const moved = items.find((s) => s.id === id);
    if (!moved) return;
    const next = items.filter((s) => s.id !== id);
    let target = next.findIndex((s) => s.id === targetId);
    if (target < 0) return;
    if (after) target += 1;
    next.splice(target, 0, moved);
    setShortcuts(next);
}

function normalizeKey(key: string): string {
    if (key === ' ') return 'Space';
    return key.length === 1 ? key.toUpperCase() : key;
}

/** Whether a keydown matches a combination label such as "Ctrl+T". */
export function shortcutMatches(event: KeyboardEvent, label: string): boolean {
    const parts = label.split('+').map((p) => p.trim());
    const key = parts[parts.length - 1];
    const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()));
    const wantsCtrl = mods.has('ctrl') || mods.has('control');
    const wantsMeta = mods.has('cmd') || mods.has('meta') || mods.has('command');
    const wantsShift = mods.has('shift');
    const wantsAlt = mods.has('alt') || mods.has('option');
    return (
        normalizeKey(event.key) === normalizeKey(key) &&
        event.ctrlKey === wantsCtrl &&
        event.metaKey === wantsMeta &&
        event.shiftKey === wantsShift &&
        event.altKey === wantsAlt
    );
}
