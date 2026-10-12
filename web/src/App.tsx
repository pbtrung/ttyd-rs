import { Upload } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import {
    ConfirmDialog,
    FileBrowser,
    LoginDialog,
    ShortcutManager,
} from './components/Dialogs';
import { Header } from './components/Header';
import { ShortcutBar } from './components/ShortcutBar';
import { TerminalView } from './components/TerminalView';
import { Toasts } from './components/Toasts';
import { inputBlocked, isOpen, sendFileList, sendInput, start } from './lib/connection';
import { closeFilePanel, fileStore, initFiles, openFilePanel } from './lib/files';
import { shortcutMatches, shortcutStore } from './lib/shortcuts';
import { useStore } from './lib/store';
import { copySelection, resetZoom, term, zoomIn, zoomOut } from './lib/terminal';
import { answerConfirm, confirmStore } from './lib/toast';
import { queueUploads } from './lib/transfer';
import { closeMenus, openUploadPicker, uiStore } from './lib/ui';

let started = false;

export default function App() {
    const dragging = useStore(uiStore, (s) => s.dragging);
    useVisualViewportHeight();

    useEffect(() => {
        if (started) return; // StrictMode runs effects twice in development
        started = true;
        initFiles(sendFileList);
        void start();
    }, []);

    useGlobalKeys();
    useOutsideClickClosesMenus();
    useDropUpload();

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <Header />
            <TerminalView />
            <ShortcutBar />

            <input
                id="upload-input"
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    if (e.target.files?.length) queueUploads(e.target.files);
                    e.target.value = '';
                }}
            />

            <Toasts />
            <FileBrowser />
            <ShortcutManager />
            <ConfirmDialog />
            <LoginDialog />

            {dragging && (
                <div className="pointer-events-none fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/70 bg-surface/90 px-10 py-8 text-sm text-fg">
                        <Upload className="size-8 text-accent" strokeWidth={1.5} />
                        Drop files to upload
                    </div>
                </div>
            )}
        </div>
    );
}

/** Size the app to the visual viewport so the on-screen keyboard pushes
 *  the terminal up instead of covering it (iOS ignores
 *  `interactive-widget=resizes-content`). */
function useVisualViewportHeight(): void {
    useLayoutEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const apply = () => {
            document.documentElement.style.setProperty(
                '--app-height',
                `${vv.height}px`,
            );
            // iOS scrolls the layout viewport when the keyboard opens; pin it.
            if (vv.offsetTop > 0) window.scrollTo(0, 0);
        };
        apply();
        vv.addEventListener('resize', apply);
        vv.addEventListener('scroll', apply);
        return () => {
            vv.removeEventListener('resize', apply);
            vv.removeEventListener('scroll', apply);
        };
    }, []);
}

function useGlobalKeys(): void {
    useEffect(() => {
        // Capture phase: configured combinations (e.g. Ctrl+T) are sent to
        // the terminal before the browser acts on them, where it allows.
        const captureShortcuts = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('[role="dialog"]')) return;
            if (target.matches('input, textarea') && !target.closest('#terminal'))
                return;
            const s = shortcutStore
                .get()
                .items.find(
                    (i) => i.label.includes('+') && shortcutMatches(e, i.label),
                );
            if (!s || inputBlocked() || !isOpen()) return;
            e.preventDefault();
            e.stopPropagation();
            sendInput(s.sequence);
        };

        const appKeys = (e: KeyboardEvent) => {
            const ui = uiStore.get();
            if (e.key === 'Escape') {
                // Close the topmost overlay; otherwise Esc goes to the terminal.
                if (ui.shortcutManagerOpen) uiStore.set({ shortcutManagerOpen: false });
                else if (ui.menu) closeMenus();
                else if (confirmStore.get().open) answerConfirm(false);
                else if (fileStore.get().open) closeFilePanel();
                return;
            }
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || ui.login) return;
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;

            if (e.shiftKey && e.key === 'C') {
                e.preventDefault();
                if (term.hasSelection()) void copySelection();
            } else if (e.shiftKey && e.key === 'F') {
                e.preventDefault();
                if (ui.fileTransfer && ui.online && !fileStore.get().open)
                    openFilePanel();
            } else if (e.shiftKey && e.key === 'U') {
                e.preventDefault();
                if (ui.fileTransfer && ui.online) openUploadPicker();
            } else if (!e.shiftKey && e.key === 'k') {
                e.preventDefault();
                term.clear();
            } else if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                resetZoom();
            }
        };

        // Both run in the capture phase: ghostty-web stops propagation of
        // keydown events inside the terminal, so bubble listeners never fire.
        document.addEventListener('keydown', captureShortcuts, true);
        window.addEventListener('keydown', appKeys, true);
        return () => {
            document.removeEventListener('keydown', captureShortcuts, true);
            window.removeEventListener('keydown', appKeys, true);
        };
    }, []);
}

function useOutsideClickClosesMenus(): void {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!uiStore.get().menu) return;
            if (!(e.target as HTMLElement).closest('[data-menu-root]')) closeMenus();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
}

function useDropUpload(): void {
    useEffect(() => {
        let depth = 0;
        const canUpload = () => uiStore.get().fileTransfer && uiStore.get().online;
        const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
        const enter = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (++depth === 1 && canUpload()) uiStore.set({ dragging: true });
        };
        const leave = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            if (--depth <= 0) {
                depth = 0;
                uiStore.set({ dragging: false });
            }
        };
        const over = (e: DragEvent) => {
            if (hasFiles(e)) e.preventDefault();
        };
        const drop = (e: DragEvent) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth = 0;
            uiStore.set({ dragging: false });
            if (canUpload() && e.dataTransfer?.files.length)
                queueUploads(e.dataTransfer.files);
        };
        document.addEventListener('dragenter', enter);
        document.addEventListener('dragleave', leave);
        document.addEventListener('dragover', over);
        document.addEventListener('drop', drop);
        return () => {
            document.removeEventListener('dragenter', enter);
            document.removeEventListener('dragleave', leave);
            document.removeEventListener('dragover', over);
            document.removeEventListener('drop', drop);
        };
    }, []);
}
