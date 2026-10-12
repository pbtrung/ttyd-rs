import { Copy, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { reconnectNow } from '../lib/connection';
import { useStore } from '../lib/store';
import { copySelection, fit, openTerminal, termPrefs } from '../lib/terminal';
import { uiStore } from '../lib/ui';
import { cx } from './primitives';

export function TerminalView() {
    const ref = useRef<HTMLDivElement>(null);
    const banner = useStore(uiStore, (s) => s.banner);
    const hasSelection = useStore(termPrefs, (s) => s.hasSelection);

    useEffect(() => {
        const el = ref.current;
        if (!el || el.dataset.opened) return; // StrictMode runs effects twice
        el.dataset.opened = '1';
        openTerminal(el);
        // Refit on any layout change: window resize, key bar toggle,
        // on-screen keyboard, fullscreen, font loading.
        const observer = new ResizeObserver(() => fit());
        observer.observe(el.parentElement ?? el);
    }, []);

    return (
        <main className="relative min-h-0 flex-1 bg-canvas pt-1.5 pr-[max(0.25rem,env(safe-area-inset-right))] pb-1 pl-[max(0.5rem,env(safe-area-inset-left))] sm:pt-2 sm:pl-2.5">
            <div
                id="terminal"
                ref={ref}
                className={cx('size-full transition-opacity', banner && 'opacity-40')}
            />

            {banner && (
                <div
                    role="alert"
                    className="absolute inset-x-2 top-2 z-20 mx-auto flex max-w-xl animate-pop-in items-center gap-2.5 rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur"
                >
                    {banner.kind === 'reconnecting' ? (
                        <LoaderCircle className="size-4 shrink-0 animate-spin text-warn" />
                    ) : (
                        <WifiOff className="size-4 shrink-0 text-danger" />
                    )}
                    <span className="min-w-0 flex-1">{banner.text}</span>
                    {banner.kind === 'lost' && (
                        <button
                            type="button"
                            onClick={reconnectNow}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-canvas hover:bg-accent-strong sm:h-7"
                        >
                            <RefreshCw className="size-3.5" />
                            Reconnect
                        </button>
                    )}
                </div>
            )}

            {hasSelection && (
                <button
                    type="button"
                    onClick={() => void copySelection()}
                    title="Copy selection (Ctrl+Shift+C)"
                    className="absolute right-4 bottom-3 z-10 inline-flex h-8 animate-pop-in items-center gap-1.5 rounded-md border border-line bg-elevated px-3 text-xs text-fg shadow-lg shadow-black/40 hover:border-accent hover:text-accent"
                >
                    <Copy className="size-3.5" />
                    Copy
                </button>
            )}
        </main>
    );
}
