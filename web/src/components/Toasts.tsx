import { Check, CircleAlert, Info, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { dismissToast, toastStore, type ToastKind } from '../lib/toast';
import { cx } from './primitives';

const ICON: Record<ToastKind, typeof Check> = {
    success: Check,
    error: CircleAlert,
    info: Info,
};
const TONE: Record<ToastKind, string> = {
    success: 'text-accent',
    error: 'text-danger',
    info: 'text-sky-400',
};

export function Toasts() {
    const items = useStore(toastStore, (s) => s.items);
    return (
        <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-[60] flex flex-col items-center gap-1.5 sm:inset-x-auto sm:right-3 sm:bottom-3 sm:items-end"
        >
            {items.map((t) => {
                const Icon = ICON[t.kind];
                return (
                    <div
                        key={`${t.id}-${t.pulse}`}
                        className={cx(
                            'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border border-line bg-elevated/95 py-2 pr-1.5 pl-2.5 text-xs shadow-xl shadow-black/40 backdrop-blur transition-opacity duration-200',
                            t.pulse ? 'animate-pulse-once' : 'animate-pop-in',
                            t.leaving && 'opacity-0',
                        )}
                    >
                        <Icon
                            className={cx('mt-px size-4 shrink-0', TONE[t.kind])}
                            strokeWidth={2}
                        />
                        <button
                            type="button"
                            title="Click to copy"
                            className="min-w-0 flex-1 cursor-copy text-left break-words text-fg"
                            onClick={() =>
                                void navigator.clipboard
                                    ?.writeText(t.message)
                                    .catch(() => undefined)
                            }
                        >
                            {t.message}
                        </button>
                        <button
                            type="button"
                            aria-label="Dismiss notification"
                            title="Dismiss"
                            onClick={() => dismissToast(t.id)}
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-fg-faint hover:bg-line hover:text-fg"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
