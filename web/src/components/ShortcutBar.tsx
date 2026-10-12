import { inputBlocked, sendInput } from '../lib/connection';
import { shortcutStore } from '../lib/shortcuts';
import { useStore } from '../lib/store';
import { term } from '../lib/terminal';

/** Special keys phones lack (Esc, Tab, arrows, Ctrl combos). */
export function ShortcutBar() {
    const items = useStore(shortcutStore, (s) => s.items);
    const visible = useStore(shortcutStore, (s) => s.barVisible);
    if (!visible) return null;
    return (
        <div
            role="toolbar"
            aria-label="Special keys"
            className="flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-t border-line bg-surface px-[max(0.375rem,env(safe-area-inset-left))] pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
        >
            {items
                .filter((s) => s.visible)
                .map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        aria-label={s.label}
                        // Keep focus (and the on-screen keyboard) on the terminal.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            if (!inputBlocked()) sendInput(s.sequence);
                            term.focus();
                        }}
                        className="h-9 min-w-11 shrink-0 rounded-md border border-line bg-elevated px-2.5 text-xs text-fg-muted hover:border-line-strong hover:text-fg active:scale-95 active:bg-line sm:h-7 sm:min-w-9"
                    >
                        {s.label}
                    </button>
                ))}
        </div>
    );
}
