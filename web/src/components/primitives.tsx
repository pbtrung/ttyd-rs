import { X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}

interface IconButtonProps extends ComponentProps<'button'> {
    icon: LucideIcon;
    label: string;
    active?: boolean;
}

/** Square header/toolbar button: 36px touch target on phones, 30px on desktop. */
export function IconButton({
    icon: Icon,
    label,
    active,
    className,
    ...rest
}: IconButtonProps) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            className={cx(
                'inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors sm:size-[30px]',
                'hover:bg-elevated hover:text-fg active:bg-line',
                active && 'bg-elevated text-accent',
                className,
            )}
            {...rest}
        >
            <Icon className="size-[17px] sm:size-4" strokeWidth={1.75} />
        </button>
    );
}

export function Button({
    variant = 'ghost',
    className,
    ...rest
}: ComponentProps<'button'> & { variant?: 'primary' | 'ghost' | 'danger' }) {
    return (
        <button
            type="button"
            className={cx(
                'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50 sm:h-7',
                variant === 'primary' && 'bg-accent text-canvas hover:bg-accent-strong',
                variant === 'ghost' &&
                    'border border-line text-fg-muted hover:border-line-strong hover:bg-elevated hover:text-fg',
                variant === 'danger' &&
                    'border border-danger/40 text-danger hover:bg-danger/10',
                className,
            )}
            {...rest}
        />
    );
}

export function Switch({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            onClick={() => onChange(!checked)}
            className={cx(
                'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors',
                checked
                    ? 'border-accent bg-accent/80'
                    : 'border-line-strong bg-elevated',
            )}
        >
            <span
                className={cx(
                    'absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-fg shadow transition-[left]',
                    checked ? 'left-[15px]' : 'left-[2px]',
                )}
            />
        </button>
    );
}

export const inputClass =
    'h-8 w-full min-w-0 rounded-md border border-line bg-canvas px-2.5 text-[13px] text-fg placeholder:text-fg-faint ' +
    'focus:border-accent focus:outline-none sm:h-7 sm:text-xs';

/** Dropdown anchored under a header button; a full-width sheet on phones. */
export function Popover({
    children,
    className,
    label,
}: {
    children: ReactNode;
    className?: string;
    label: string;
}) {
    return (
        <div
            role="dialog"
            aria-label={label}
            className={cx(
                'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+2.75rem)] z-40 animate-pop-in rounded-lg border border-line bg-surface shadow-2xl shadow-black/50',
                'sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-1.5',
                className,
            )}
        >
            {children}
        </div>
    );
}

interface ModalProps {
    open: boolean;
    onClose?: () => void;
    title?: ReactNode;
    icon?: LucideIcon;
    children: ReactNode;
    className?: string;
    labelledBy?: string;
    /** Element to focus when the dialog opens. */
    initialFocus?: React.RefObject<HTMLElement | null>;
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({
    open,
    onClose,
    title,
    icon: Icon,
    children,
    className,
    initialFocus,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() =>
            (initialFocus?.current ?? panelRef.current)?.focus(),
        );
        return () => cancelAnimationFrame(id);
    }, [open, initialFocus]);
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cx(
                    'flex max-h-[85dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-2xl shadow-black/60 outline-none',
                    'pb-[env(safe-area-inset-bottom)] sm:max-h-[80dvh] sm:rounded-xl sm:pb-0',
                    className,
                )}
            >
                {title !== undefined && (
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3 sm:h-10">
                        {Icon && (
                            <Icon className="size-4 text-accent" strokeWidth={1.75} />
                        )}
                        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {title}
                        </h2>
                        {onClose && (
                            <IconButton icon={X} label="Close" onClick={onClose} />
                        )}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
