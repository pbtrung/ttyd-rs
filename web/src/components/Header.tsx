import {
    ArrowUpDown,
    Check,
    Download,
    Eraser,
    FolderOpen,
    Keyboard,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    RotateCcw,
    SlidersHorizontal,
    SquareTerminal,
    Upload,
    X,
    Command,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CONFIG } from '../lib/config';
import { openFilePanel } from '../lib/files';
import { setShortcutBarVisible, shortcutStore } from '../lib/shortcuts';
import { useStore } from '../lib/store';
import {
    resetZoom,
    setCursorBlink,
    term,
    termPrefs,
    zoomIn,
    zoomOut,
} from '../lib/terminal';
import { setToastDuration, toastStore } from '../lib/toast';
import {
    cancelAllTransfers,
    cancelTransfer,
    clearTransfers,
    overallProgress,
    transferStore,
} from '../lib/transfer';
import { closeMenus, openUploadPicker, toggleMenu, uiStore } from '../lib/ui';
import { cx, IconButton, Popover, Switch } from './primitives';

const STATUS_DOT: Record<string, string> = {
    connected: 'bg-accent shadow-[0_0_0_3px] shadow-accent/20',
    connecting: 'bg-warn animate-pulse',
    reconnecting: 'bg-warn animate-pulse',
    pending: 'bg-fg-faint',
    disconnected: 'bg-danger',
};

export function Header() {
    const status = useStore(uiStore, (s) => s.status);
    const statusText = useStore(uiStore, (s) => s.statusText);
    const sessionId = useStore(uiStore, (s) => s.sessionId);
    const readOnly = useStore(uiStore, (s) => s.readOnly);
    const fileTransfer = useStore(uiStore, (s) => s.fileTransfer);
    const online = useStore(uiStore, (s) => s.online);
    const menu = useStore(uiStore, (s) => s.menu);
    const barVisible = useStore(shortcutStore, (s) => s.barVisible);
    const fullscreen = useFullscreen();

    return (
        <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-surface pr-[max(0.375rem,env(safe-area-inset-right))] pl-[max(0.625rem,env(safe-area-inset-left))] sm:h-10">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <SquareTerminal
                    className="size-[18px] shrink-0 text-accent"
                    strokeWidth={1.75}
                    aria-hidden
                />
                <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">
                    ttyd<span className="text-accent">-rs</span>
                </span>
                <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
                <div
                    className="flex min-w-0 items-center gap-2 text-xs text-fg-muted"
                    title={statusText}
                >
                    <span
                        className={cx(
                            'size-2 shrink-0 rounded-full',
                            STATUS_DOT[status],
                        )}
                        aria-hidden
                    />
                    <span role="status" aria-live="polite" className="truncate">
                        {statusText}
                    </span>
                    {sessionId && (
                        <span
                            className="hidden truncate text-[11px] text-fg-faint md:inline"
                            title={`Session ${sessionId}`}
                        >
                            #{sessionId.slice(0, 8)}
                        </span>
                    )}
                    {readOnly && (
                        <span
                            className="shrink-0 rounded border border-warn/40 bg-warn/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-warn"
                            title="You cannot type in this session"
                        >
                            READ-ONLY
                        </span>
                    )}
                </div>
            </div>

            <nav className="flex shrink-0 items-center gap-0.5" data-menu-root>
                <TransferIndicator open={menu === 'transfers'} />
                {document.fullscreenEnabled && (
                    <IconButton
                        icon={fullscreen ? Minimize2 : Maximize2}
                        label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        onClick={toggleFullscreen}
                    />
                )}
                <IconButton
                    icon={Keyboard}
                    label={barVisible ? 'Hide key bar' : 'Show key bar'}
                    active={barVisible}
                    aria-expanded={barVisible}
                    onClick={() => setShortcutBarVisible(!barVisible)}
                />
                <div className="relative">
                    <IconButton
                        icon={SlidersHorizontal}
                        label="Settings"
                        active={menu === 'settings'}
                        aria-haspopup="dialog"
                        aria-expanded={menu === 'settings'}
                        onClick={() => toggleMenu('settings')}
                    />
                    {menu === 'settings' && <SettingsMenu />}
                </div>
                {fileTransfer && online && (
                    <div className="relative">
                        <IconButton
                            icon={FolderOpen}
                            label="Files"
                            active={menu === 'files'}
                            aria-haspopup="menu"
                            aria-expanded={menu === 'files'}
                            onClick={() => toggleMenu('files')}
                        />
                        {menu === 'files' && (
                            <Popover label="File operations" className="p-1 sm:w-52">
                                <MenuItem
                                    icon={Upload}
                                    hint="⌃⇧U"
                                    onClick={() => {
                                        closeMenus();
                                        openUploadPicker();
                                    }}
                                >
                                    Upload files
                                </MenuItem>
                                <MenuItem
                                    icon={FolderOpen}
                                    hint="⌃⇧F"
                                    onClick={() => {
                                        closeMenus();
                                        openFilePanel();
                                    }}
                                >
                                    Browse files
                                </MenuItem>
                            </Popover>
                        )}
                    </div>
                )}
            </nav>
        </header>
    );
}

function MenuItem({
    icon: Icon,
    children,
    hint,
    onClick,
}: {
    icon: typeof Upload;
    children: React.ReactNode;
    hint?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-fg hover:bg-elevated sm:h-8 sm:text-xs"
        >
            <Icon className="size-4 text-fg-muted" strokeWidth={1.75} />
            <span className="flex-1">{children}</span>
            {hint && (
                <kbd className="hidden font-sans text-[10px] text-fg-faint sm:inline">
                    {hint}
                </kbd>
            )}
        </button>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex min-h-10 items-center justify-between gap-3 px-3 sm:min-h-9">
            <span className="text-xs text-fg-muted">{label}</span>
            <div className="flex items-center gap-1">{children}</div>
        </div>
    );
}

function Stepper({
    value,
    onDec,
    onInc,
    onReset,
    unit,
    decLabel,
    incLabel,
    input,
}: {
    value: number;
    onDec: () => void;
    onInc: () => void;
    onReset: () => void;
    unit?: string;
    decLabel: string;
    incLabel: string;
    input?: React.ReactNode;
}) {
    const btn =
        'inline-flex size-8 items-center justify-center rounded-md border border-line text-fg-muted hover:bg-elevated hover:text-fg sm:size-6';
    return (
        <>
            <button
                type="button"
                className={btn}
                onClick={onDec}
                aria-label={decLabel}
                title={decLabel}
            >
                <Minus className="size-3.5" />
            </button>
            {input ?? (
                <span className="w-9 text-center text-xs tabular-nums">
                    {value}
                    {unit}
                </span>
            )}
            <button
                type="button"
                className={btn}
                onClick={onInc}
                aria-label={incLabel}
                title={incLabel}
            >
                <Plus className="size-3.5" />
            </button>
            <button
                type="button"
                className={btn}
                onClick={onReset}
                aria-label="Reset"
                title="Reset"
            >
                <RotateCcw className="size-3.5" />
            </button>
        </>
    );
}

function SettingsMenu() {
    const fontSize = useStore(termPrefs, (s) => s.fontSize);
    const cursorBlink = useStore(termPrefs, (s) => s.cursorBlink);
    const duration = useStore(toastStore, (s) => s.duration);
    const [draft, setDraft] = useState(String(duration));
    useEffect(() => setDraft(String(duration)), [duration]);

    return (
        <Popover label="Terminal settings" className="py-1.5 sm:w-72">
            <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-fg-faint uppercase">
                Terminal
            </div>
            <Row label="Font size">
                <Stepper
                    value={fontSize}
                    onDec={zoomOut}
                    onInc={zoomIn}
                    onReset={resetZoom}
                    decLabel="Decrease font size"
                    incLabel="Increase font size"
                />
            </Row>
            <Row label="Cursor blink">
                <Switch
                    checked={cursorBlink}
                    onChange={setCursorBlink}
                    label="Cursor blink"
                />
            </Row>
            <div className="my-1.5 h-px bg-line" />
            <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-fg-faint uppercase">
                Notifications
            </div>
            <Row label="Toast seconds">
                <Stepper
                    value={duration}
                    onDec={() => setToastDuration(Math.max(0, duration - 1))}
                    onInc={() => setToastDuration(duration + 1)}
                    onReset={() => setToastDuration(CONFIG.ui.TOAST_DEFAULT_DURATION)}
                    decLabel="Shorter"
                    incLabel="Longer"
                    input={
                        <input
                            type="number"
                            min={0}
                            value={draft}
                            title="Seconds a notification stays visible; 0 = until dismissed"
                            aria-label="Toast duration in seconds"
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => {
                                const v = parseInt(draft, 10);
                                if (Number.isInteger(v) && v >= 0) setToastDuration(v);
                                else setDraft(String(duration));
                            }}
                            className="h-8 w-9 [appearance:textfield] rounded-md border border-line bg-canvas text-center text-xs tabular-nums focus:border-accent focus:outline-none sm:h-6 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    }
                />
            </Row>
            <div className="my-1.5 h-px bg-line" />
            <div className="px-1.5">
                <MenuItem
                    icon={Eraser}
                    hint="⌃K"
                    onClick={() => {
                        term.clear();
                        closeMenus();
                    }}
                >
                    Clear terminal
                </MenuItem>
                <MenuItem
                    icon={Command}
                    onClick={() =>
                        uiStore.set({ menu: null, shortcutManagerOpen: true })
                    }
                >
                    Manage shortcuts
                </MenuItem>
            </div>
        </Popover>
    );
}

function TransferIndicator({ open }: { open: boolean }) {
    const items = useStore(transferStore, (s) => s.items);
    const batch = useStore(transferStore, (s) => s.batch);
    if (items.length === 0) return null;

    const active = items.filter((i) => i.state === 'active' || i.state === 'queued');
    const batchItems = items.filter((i) => i.batch === batch);
    const pct = overallProgress(items, batch);
    const busy = active.length > 0;
    const verb = batchItems.some((i) => i.kind === 'download')
        ? 'Transferring'
        : 'Uploading';
    let title: string;
    if (busy) {
        const done = batchItems.filter((i) => i.state === 'done').length;
        title =
            batchItems.length > 1
                ? `${verb} ${done + 1}/${batchItems.length} · ${Math.round(pct)}%`
                : `${verb} · ${Math.round(pct)}%`;
    } else {
        const ok = items.filter((i) => i.state === 'done').length;
        const bad = items.filter(
            (i) => i.state === 'failed' || i.state === 'cancelled',
        ).length;
        title =
            bad > 0
                ? `Finished · ${ok} ok, ${bad} cancelled/failed`
                : `Finished · ${ok} transferred`;
    }

    return (
        <div className="relative">
            <button
                type="button"
                title={busy ? 'Transfer progress' : 'Transfer history'}
                aria-label={busy ? 'Transfer progress' : 'Transfer history'}
                aria-expanded={open}
                onClick={() => toggleMenu('transfers')}
                className={cx(
                    'relative inline-flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-fg sm:size-[30px]',
                    open && 'bg-elevated text-accent',
                )}
            >
                {busy ? (
                    <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
                        <circle
                            cx="10"
                            cy="10"
                            r="8"
                            fill="none"
                            strokeWidth="2"
                            className="stroke-line-strong"
                        />
                        <circle
                            cx="10"
                            cy="10"
                            r="8"
                            fill="none"
                            strokeWidth="2"
                            pathLength={100}
                            strokeDasharray="100"
                            strokeDashoffset={100 - pct}
                            strokeLinecap="round"
                            className="stroke-accent transition-[stroke-dashoffset]"
                        />
                        <text
                            x="10"
                            y="10"
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="rotate-90 fill-fg text-[8px] font-semibold"
                            style={{ transformOrigin: '10px 10px' }}
                        >
                            {batchItems.length}
                        </text>
                    </svg>
                ) : (
                    <ArrowUpDown className="size-4" strokeWidth={1.75} />
                )}
            </button>
            {open && (
                <Popover label="Transfers" className="sm:w-80">
                    <div className="flex h-10 items-center gap-2 border-b border-line px-3">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {title}
                        </span>
                        {busy ? (
                            <button
                                type="button"
                                className="text-[11px] text-danger hover:underline"
                                onClick={cancelAllTransfers}
                            >
                                Cancel all
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="text-[11px] text-fg-muted hover:text-fg hover:underline"
                                onClick={clearTransfers}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <ul className="max-h-72 overflow-y-auto py-1">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="flex h-9 items-center gap-2 px-3 text-xs sm:h-8"
                            >
                                {item.kind === 'upload' ? (
                                    <Upload
                                        className="size-3.5 shrink-0 text-fg-faint"
                                        aria-label="Upload"
                                    />
                                ) : (
                                    <Download
                                        className="size-3.5 shrink-0 text-fg-faint"
                                        aria-label="Download"
                                    />
                                )}
                                <span
                                    className={cx(
                                        'min-w-0 flex-1 truncate',
                                        item.batch !== batch && 'text-fg-muted',
                                    )}
                                    title={item.name}
                                >
                                    {item.name}
                                </span>
                                <span
                                    className={cx(
                                        'shrink-0 text-[11px] tabular-nums',
                                        item.state === 'done' && 'text-accent',
                                        item.state === 'failed' && 'text-danger',
                                        (item.state === 'cancelled' ||
                                            item.state === 'queued') &&
                                            'text-fg-faint',
                                    )}
                                >
                                    {item.state === 'active' ? (
                                        `${item.pct}%`
                                    ) : item.state === 'done' ? (
                                        <Check className="size-3.5" />
                                    ) : (
                                        item.state
                                    )}
                                </span>
                                {(item.state === 'active' ||
                                    item.state === 'queued') && (
                                    <button
                                        type="button"
                                        className="inline-flex size-6 items-center justify-center rounded text-fg-faint hover:bg-elevated hover:text-danger"
                                        aria-label={`Cancel ${item.kind} of ${item.name}`}
                                        title={`Cancel ${item.kind}`}
                                        onClick={() => cancelTransfer(item.id)}
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </Popover>
            )}
        </div>
    );
}

function useFullscreen(): boolean {
    const [on, setOn] = useState(!!document.fullscreenElement);
    useEffect(() => {
        const handler = () => setOn(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);
    return on;
}

function toggleFullscreen(): void {
    const p = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
    p?.catch(() => undefined);
}
