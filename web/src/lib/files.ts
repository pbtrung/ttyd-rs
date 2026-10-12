// File browser state (listing arrives over the WebSocket).
import { CONFIG, Prefs } from './config';
import { createStore } from './store';

export interface FileEntry {
    name: string;
    is_dir: boolean;
    size: number;
}

export const fileStore = createStore({
    open: false,
    path: '.',
    entries: [] as FileEntry[],
    /** Spinner shown (only after LOADING_DELAY, to avoid flicker on fast loads). */
    loading: false,
    error: null as string | null,
    showHidden: Prefs.getBool(CONFIG.storage.KEYS.SHOW_HIDDEN, false),
});

let requestList: (path: string, showHidden: boolean) => boolean = () => false;
let loadingTimer: number | null = null;

export function initFiles(send: (path: string, showHidden: boolean) => boolean): void {
    requestList = send;
}

function cancelLoading(): void {
    if (loadingTimer !== null) clearTimeout(loadingTimer);
    loadingTimer = null;
    fileStore.set({ loading: false });
}

export function navigate(path: string): void {
    const target = path || '.';
    fileStore.set({ path: target });
    if (loadingTimer === null) {
        loadingTimer = window.setTimeout(() => {
            loadingTimer = null;
            fileStore.set({ loading: true });
        }, CONFIG.ui.LOADING_DELAY);
    }
    if (!requestList(target, fileStore.get().showHidden)) {
        cancelLoading();
        fileStore.set({ entries: [], error: 'Not connected' });
    }
}

export const refresh = () => navigate(fileStore.get().path);

export function openFilePanel(): void {
    fileStore.set({ open: true, entries: [], error: null });
    navigate('.');
}

export const closeFilePanel = () => fileStore.set({ open: false });

export function setShowHidden(on: boolean): void {
    fileStore.set({ showHidden: on });
    Prefs.set(CONFIG.storage.KEYS.SHOW_HIDDEN, String(on));
    refresh();
}

export function renderFileList(data: { entries?: FileEntry[] }): void {
    cancelLoading();
    fileStore.set({ entries: data.entries ?? [], error: null });
}

export function renderFileListError(message: string): void {
    cancelLoading();
    fileStore.set({ entries: [], error: message });
}

export function joinPath(base: string, name: string): string {
    return base === '.' || base === '' ? name : `${base}/${name}`;
}

export function parentPath(path: string): string | null {
    if (path === '.' || path === '') return null;
    const idx = path.lastIndexOf('/');
    return idx > 0 ? path.substring(0, idx) : '.';
}
