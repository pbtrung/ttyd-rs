import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    CornerLeftUp,
    Download,
    File,
    Folder,
    FolderOpen,
    GripVertical,
    LoaderCircle,
    LogIn,
    Plus,
    RefreshCw,
    SquareTerminal,
    Trash2,
    TriangleAlert,
    Upload,
    Command,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { submitLogin } from '../lib/connection';
import {
    closeFilePanel,
    fileStore,
    joinPath,
    navigate,
    parentPath,
    refresh,
    setShowHidden,
} from '../lib/files';
import {
    decodeTerminalSequence,
    formatTerminalSequence,
    moveShortcut,
    moveShortcutTo,
    resetShortcuts,
    setShortcuts,
    shortcutStore,
    type Shortcut,
} from '../lib/shortcuts';
import { useStore } from '../lib/store';
import { answerConfirm, confirmStore, showToast } from '../lib/toast';
import { download, formatSize } from '../lib/transfer';
import { uiStore } from '../lib/ui';
import { Button, cx, IconButton, inputClass, Modal, Switch } from './primitives';

// ------------------------------------------------------------------
// Login
// ------------------------------------------------------------------
export function LoginDialog() {
    const login = useStore(uiStore, (s) => s.login);
    const firstField = useRef<HTMLInputElement>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    if (!login) return null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        submitLogin({ username, password, token });
    };

    return (
        <Modal open className="sm:max-w-sm" initialFocus={firstField}>
            <form onSubmit={submit} className="flex flex-col gap-3 p-5">
                <div className="mb-1 flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <SquareTerminal className="size-6" strokeWidth={1.75} />
                    </span>
                    <h2 id="login-title" className="text-sm font-semibold">
                        ttyd<span className="text-accent">-rs</span>
                    </h2>
                    <p className="text-xs text-fg-muted">Authentication required</p>
                </div>
                {login.error && (
                    <p
                        role="alert"
                        className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger"
                    >
                        {login.error}
                    </p>
                )}
                {login.method === 'basic' ? (
                    <>
                        <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                            Username
                            <input
                                ref={firstField}
                                className={inputClass}
                                autoComplete="username"
                                autoCapitalize="none"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                            Password
                            <input
                                className={inputClass}
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </label>
                    </>
                ) : (
                    <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                        Token
                        <input
                            ref={firstField}
                            className={inputClass}
                            type="password"
                            autoComplete="off"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                    </label>
                )}
                <Button
                    type="submit"
                    variant="primary"
                    disabled={login.busy}
                    className="mt-1 h-9 sm:h-8"
                >
                    {login.busy ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <LogIn className="size-4" />
                    )}
                    {login.busy ? 'Connecting…' : 'Login'}
                </Button>
            </form>
        </Modal>
    );
}

// ------------------------------------------------------------------
// Confirm
// ------------------------------------------------------------------
export function ConfirmDialog() {
    const { open, message, okLabel } = useStore(confirmStore, (s) => s);
    const okRef = useRef<HTMLButtonElement>(null);
    return (
        <Modal
            open={open}
            onClose={() => answerConfirm(false)}
            className="sm:max-w-sm"
            initialFocus={okRef}
        >
            <div className="flex gap-3 p-4">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
                <p className="text-[13px] break-words">{message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
                <Button onClick={() => answerConfirm(false)}>Cancel</Button>
                <Button
                    ref={okRef}
                    variant="danger"
                    onClick={() => answerConfirm(true)}
                >
                    {okLabel}
                </Button>
            </div>
        </Modal>
    );
}

// ------------------------------------------------------------------
// File browser
// ------------------------------------------------------------------
export function FileBrowser() {
    const { open, path, entries, loading, error, showHidden } = useStore(
        fileStore,
        (s) => s,
    );
    if (!open) return null;
    const parent = parentPath(path);
    const parts = path === '.' ? [] : path.split('/').filter(Boolean);

    return (
        <Modal
            open
            onClose={closeFilePanel}
            title="Files"
            icon={FolderOpen}
            className="sm:h-[min(560px,80dvh)] sm:max-w-xl"
        >
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
                <nav
                    aria-label="Path"
                    className="flex min-w-0 flex-1 [scrollbar-width:none] items-center overflow-x-auto text-xs whitespace-nowrap"
                >
                    <button
                        type="button"
                        className="rounded px-1 py-0.5 text-accent hover:bg-elevated"
                        onClick={() => navigate('.')}
                    >
                        ~
                    </button>
                    {parts.map((part, i) => (
                        <span key={i} className="flex items-center">
                            <ChevronRight className="size-3 text-fg-faint" />
                            <button
                                type="button"
                                className={cx(
                                    'rounded px-1 py-0.5 hover:bg-elevated',
                                    i === parts.length - 1
                                        ? 'text-fg'
                                        : 'text-fg-muted',
                                )}
                                onClick={() =>
                                    navigate(parts.slice(0, i + 1).join('/'))
                                }
                            >
                                {part}
                            </button>
                        </span>
                    ))}
                </nav>
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-fg-muted">
                    <span className="hidden sm:inline">Hidden</span>
                    <Switch
                        checked={showHidden}
                        onChange={setShowHidden}
                        label="Show hidden files"
                    />
                </label>
                <IconButton icon={RefreshCw} label="Refresh" onClick={refresh} />
            </div>
            <div className="min-h-40 flex-1 overflow-y-auto py-1">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-xs text-fg-muted">
                        <LoaderCircle className="size-4 animate-spin" /> Loading…
                    </div>
                ) : (
                    <>
                        {parent !== null && (
                            <FileRow
                                icon={CornerLeftUp}
                                name=".."
                                onOpen={() => navigate(parent)}
                                muted
                            />
                        )}
                        {error ? (
                            <p className="py-10 text-center text-xs text-fg-muted">
                                {error}
                            </p>
                        ) : entries.length === 0 && parent === null ? (
                            <p className="py-10 text-center text-xs text-fg-muted">
                                No files in this directory
                            </p>
                        ) : (
                            entries.map((f) =>
                                f.is_dir ? (
                                    <FileRow
                                        key={f.name}
                                        icon={Folder}
                                        name={f.name}
                                        meta="dir"
                                        onOpen={() => navigate(joinPath(path, f.name))}
                                        dir
                                    />
                                ) : (
                                    <FileRow
                                        key={f.name}
                                        icon={File}
                                        name={f.name}
                                        meta={formatSize(f.size)}
                                        onOpen={() => download(joinPath(path, f.name))}
                                        action
                                    />
                                ),
                            )
                        )}
                    </>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2 text-[11px] text-fg-faint">
                <Upload className="size-3.5" />
                <span className="flex-1">
                    Drop files anywhere to upload into the session's directory
                </span>
            </div>
        </Modal>
    );
}

function FileRow({
    icon: Icon,
    name,
    meta,
    onOpen,
    dir,
    muted,
    action,
}: {
    icon: typeof File;
    name: string;
    meta?: string;
    onOpen: () => void;
    dir?: boolean;
    muted?: boolean;
    action?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            title={action ? `Download ${name}` : name}
            className="group flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] hover:bg-elevated sm:h-8 sm:text-xs"
        >
            <Icon
                className={cx('size-4 shrink-0', dir ? 'text-accent' : 'text-fg-faint')}
                strokeWidth={1.75}
            />
            <span className={cx('min-w-0 flex-1 truncate', muted && 'text-fg-muted')}>
                {name}
            </span>
            {meta && (
                <span className="shrink-0 text-[11px] text-fg-faint tabular-nums">
                    {meta}
                </span>
            )}
            {action && (
                <Download className="size-3.5 shrink-0 text-fg-faint group-hover:text-accent sm:opacity-0 sm:group-hover:opacity-100" />
            )}
        </button>
    );
}

// ------------------------------------------------------------------
// Shortcut manager
// ------------------------------------------------------------------
export function ShortcutManager() {
    const open = useStore(uiStore, (s) => s.shortcutManagerOpen);
    const items = useStore(shortcutStore, (s) => s.items);
    const [label, setLabel] = useState('');
    const [sequence, setSequence] = useState('');
    const [dragId, setDragId] = useState<string | null>(null);
    const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
    const labelRef = useRef<HTMLInputElement>(null);
    const close = () => uiStore.set({ shortcutManagerOpen: false });

    const update = (id: string, patch: Partial<Shortcut>) =>
        setShortcuts(items.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    const add = () => {
        const l = label.trim();
        const seq = decodeTerminalSequence(sequence.trim());
        if (!l || !seq || !l.includes('+')) {
            showToast('Enter a label such as Ctrl+T and a terminal sequence', 'error');
            return;
        }
        if (items.some((s) => s.label.toLowerCase() === l.toLowerCase())) {
            showToast('That shortcut already exists', 'error');
            return;
        }
        setShortcuts([
            ...items,
            { id: `custom-${Date.now()}`, label: l, sequence: seq, visible: true },
        ]);
        setLabel('');
        setSequence('');
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title="Shortcuts"
            icon={Command}
            className="sm:max-w-2xl"
            initialFocus={labelRef}
        >
            <p className="shrink-0 px-3 pt-2.5 pb-1 text-[11px] leading-relaxed text-fg-muted">
                Toggle keys shown in the key bar. Edit a label or sequence in place
                (sequences accept <code className="text-fg">\x1b</code>-style escapes).
                Labels with a<code className="text-fg"> +</code>, such as{' '}
                <code className="text-fg">Ctrl+T</code>, are also captured from the
                keyboard before the browser handles them, where the browser allows it.
            </p>
            <ul
                className="flex-1 overflow-y-auto px-1.5 py-1"
                onDragLeave={(e) =>
                    !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)
                }
            >
                {items.map((s, i) => (
                    <li
                        key={s.id}
                        className={cx(
                            'relative flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-elevated/60',
                            dragId === s.id && 'opacity-40',
                            drop?.id === s.id &&
                                (drop.after
                                    ? 'shadow-[inset_0_-2px] shadow-accent'
                                    : 'shadow-[inset_0_2px] shadow-accent'),
                        )}
                        onDragOver={(e) => {
                            if (!dragId || dragId === s.id) return;
                            e.preventDefault();
                            const r = e.currentTarget.getBoundingClientRect();
                            setDrop({
                                id: s.id,
                                after: e.clientY > r.top + r.height / 2,
                            });
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragId && drop)
                                moveShortcutTo(dragId, drop.id, drop.after);
                            setDragId(null);
                            setDrop(null);
                        }}
                    >
                        <span
                            draggable
                            title="Drag to reorder"
                            className="hidden cursor-grab text-fg-faint hover:text-fg sm:block"
                            onDragStart={(e) => {
                                setDragId(s.id);
                                e.dataTransfer.effectAllowed = 'move';
                                const row = e.currentTarget.parentElement;
                                if (row) e.dataTransfer.setDragImage(row, 16, 16);
                            }}
                            onDragEnd={() => {
                                setDragId(null);
                                setDrop(null);
                            }}
                        >
                            <GripVertical className="size-4" />
                        </span>
                        <span className="flex flex-col">
                            <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moveShortcut(s.id, -1)}
                                aria-label={`Move ${s.label} up`}
                                className="text-fg-faint hover:text-fg disabled:opacity-25"
                            >
                                <ChevronUp className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                disabled={i === items.length - 1}
                                onClick={() => moveShortcut(s.id, 1)}
                                aria-label={`Move ${s.label} down`}
                                className="text-fg-faint hover:text-fg disabled:opacity-25"
                            >
                                <ChevronDown className="size-3.5" />
                            </button>
                        </span>
                        <EditableField
                            value={s.label}
                            maxLength={32}
                            ariaLabel={`Label for ${s.label}`}
                            className="w-24 sm:w-32"
                            onCommit={(v) => {
                                if (!v)
                                    return (
                                        showToast('Label cannot be empty', 'error'),
                                        false
                                    );
                                if (
                                    items.some(
                                        (o) =>
                                            o.id !== s.id &&
                                            o.label.toLowerCase() === v.toLowerCase(),
                                    )
                                ) {
                                    return (
                                        showToast(
                                            'That shortcut already exists',
                                            'error',
                                        ),
                                        false
                                    );
                                }
                                update(s.id, { label: v });
                                return true;
                            }}
                        />
                        <EditableField
                            value={formatTerminalSequence(s.sequence)}
                            maxLength={128}
                            ariaLabel={`Sequence for ${s.label}`}
                            className="flex-1 text-fg-muted"
                            onCommit={(v) => {
                                const seq = decodeTerminalSequence(v);
                                if (!seq)
                                    return (
                                        showToast('Sequence cannot be empty', 'error'),
                                        false
                                    );
                                update(s.id, { sequence: seq });
                                return true;
                            }}
                        />
                        <Switch
                            checked={s.visible}
                            onChange={(v) => update(s.id, { visible: v })}
                            label={`Show ${s.label}`}
                        />
                        <IconButton
                            icon={Trash2}
                            label={`Remove ${s.label}`}
                            className="hover:text-danger"
                            onClick={() =>
                                setShortcuts(items.filter((o) => o.id !== s.id))
                            }
                        />
                    </li>
                ))}
            </ul>
            <form
                className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line px-3 py-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    add();
                }}
            >
                <input
                    ref={labelRef}
                    className={cx(inputClass, 'w-28 flex-1 sm:w-36 sm:flex-none')}
                    placeholder="Label, e.g. Ctrl+T"
                    aria-label="Shortcut label"
                    maxLength={32}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
                <input
                    className={cx(inputClass, 'w-28 flex-1')}
                    placeholder="Sequence, e.g. \x14"
                    aria-label="Terminal sequence"
                    maxLength={64}
                    spellCheck={false}
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                />
                <Button type="submit" variant="primary">
                    <Plus className="size-3.5" /> Add
                </Button>
            </form>
            <div className="flex shrink-0 justify-between gap-2 border-t border-line px-3 py-2">
                <Button onClick={resetShortcuts}>Restore defaults</Button>
                <Button variant="primary" onClick={close}>
                    Done
                </Button>
            </div>
        </Modal>
    );
}

/** Text input that commits on blur/Enter and reverts when rejected. */
function EditableField({
    value,
    onCommit,
    maxLength,
    ariaLabel,
    className,
}: {
    value: string;
    onCommit: (v: string) => boolean;
    maxLength: number;
    ariaLabel: string;
    className?: string;
}) {
    const [draft, setDraft] = useState(value);
    const [prev, setPrev] = useState(value);
    if (prev !== value) {
        setPrev(value);
        setDraft(value);
    }
    const commit = () => {
        const v = draft.trim();
        if (v === value) return;
        if (!onCommit(v)) setDraft(value);
    };
    return (
        <input
            className={cx(
                'h-8 min-w-0 rounded border border-transparent bg-transparent px-1.5 text-xs hover:border-line focus:border-accent focus:bg-canvas focus:outline-none sm:h-7',
                className,
            )}
            value={draft}
            maxLength={maxLength}
            spellCheck={false}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
            }}
        />
    );
}
