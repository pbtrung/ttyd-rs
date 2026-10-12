// Upload/download queue and the transfer progress panel state.
import { Auth } from './auth';
import { CONFIG } from './config';
import { createStore } from './store';
import { showConfirm, showToast } from './toast';
import { uiStore } from './ui';

export type TransferState = 'queued' | 'active' | 'done' | 'failed' | 'cancelled';

export interface TransferItem {
    id: number;
    kind: 'upload' | 'download';
    name: string;
    state: TransferState;
    pct: number;
    /** Items from older batches stay listed as history but don't drive the
     *  progress ring or the header counts. */
    batch: number;
}

export const transferStore = createStore({ items: [] as TransferItem[], batch: 0 });

let nextId = 0;
const files = new Map<number, File>();
const controllers = new Map<number, AbortController>();
let activeUploadXhr: XMLHttpRequest | null = null;
let activeUploadId: number | null = null;
let hideTimer: number | null = null;
/** Server listing used for pre-flight "already exists" checks. */
let serverFileCache: Set<string> | null = null;

const sessionQuery = () => encodeURIComponent(uiStore.get().sessionId ?? '');

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const isRunning = (i: TransferItem) => i.state === 'active' || i.state === 'queued';

function update(id: number, patch: Partial<TransferItem>): void {
    transferStore.set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    afterChange();
}

function find(id: number): TransferItem | undefined {
    return transferStore.get().items.find((i) => i.id === id);
}

/** Start a new batch when nothing is running, otherwise join the current one. */
function assignBatch(): number {
    const { items, batch } = transferStore.get();
    const next = items.some(isRunning) ? batch : batch + 1;
    transferStore.set({ batch: next });
    return next;
}

function add(
    kind: TransferItem['kind'],
    name: string,
    state: TransferState,
    batch: number,
): number {
    const id = ++nextId;
    transferStore.set((s) => ({
        items: [...s.items, { id, kind, name, state, pct: 0, batch }],
    }));
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    // Open the panel when a transfer starts so progress is visible.
    if (uiStore.get().menu === null) uiStore.set({ menu: 'transfers' });
    return id;
}

/** When everything has finished: keep the panel open on failure, otherwise
 *  let it settle back into the idle icon after a short delay. */
function afterChange(): void {
    const items = transferStore.get().items;
    if (items.some(isRunning)) return;
    const failed = items.some((i) => i.state === 'failed');
    if (failed || hideTimer !== null) return;
    hideTimer = window.setTimeout(() => {
        hideTimer = null;
        if (uiStore.get().menu === 'transfers') uiStore.set({ menu: null });
    }, CONFIG.ui.UPLOAD_HIDE_DELAY);
}

export function overallProgress(items: TransferItem[], batch: number): number {
    const current = items.filter((i) => i.batch === batch);
    if (current.length === 0) return 0;
    return (
        current.reduce((sum, i) => sum + (i.state === 'done' ? 100 : i.pct), 0) /
        current.length
    );
}

export function cancelTransfer(id: number): void {
    const item = find(id);
    if (!item) return;
    if (item.state === 'active') {
        if (item.kind === 'upload') activeUploadXhr?.abort();
        else controllers.get(id)?.abort();
    } else if (item.state === 'queued') {
        files.delete(id);
        update(id, { state: 'cancelled' });
    }
}

export function cancelAllTransfers(): void {
    for (const item of transferStore.get().items)
        if (isRunning(item)) cancelTransfer(item.id);
}

export function clearTransfers(): void {
    transferStore.set({ items: [] });
    uiStore.set({ menu: null });
}

// ------------------------------------------------------------------
// Upload
// ------------------------------------------------------------------
export function queueUploads(list: FileList | File[]): void {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    const batch = assignBatch();
    for (const file of arr) files.set(add('upload', file.name, 'queued', batch), file);
    showToast(
        arr.length > 1 ? `Uploading ${arr.length} files` : `Uploading: ${arr[0].name}`,
        'info',
    );
    // One listing fetch for the whole batch, not one per file.
    void refreshServerFileCache().finally(() => {
        if (activeUploadId === null) processQueue();
    });
}

function processQueue(): void {
    const next = transferStore
        .get()
        .items.find((i) => i.kind === 'upload' && i.state === 'queued');
    if (next) void uploadFile(next.id);
    else afterChange();
}

async function refreshServerFileCache(): Promise<void> {
    serverFileCache = null;
    try {
        const resp = await fetch(`/api/files/list?session_id=${sessionQuery()}`, {
            headers: Auth.headers(),
        });
        if (!resp.ok) return;
        const data: { entries: { name: string }[] } = await resp.json();
        serverFileCache = new Set(data.entries.map((e) => e.name));
    } catch {
        // Fall back to the server's 409 response for conflicts.
        showToast('Could not list server files; overwrite check unavailable', 'info');
    }
}

async function uploadFile(id: number, overwrite = false): Promise<void> {
    const file = files.get(id);
    const item = find(id);
    if (!file || !item || item.state === 'cancelled') {
        processQueue();
        return;
    }

    const max = uiStore.get().maxUploadSize;
    if (max && file.size > max) {
        showToast(
            `${file.name}: file size (${formatSize(file.size)}) exceeds limit (${formatSize(max)})`,
            'error',
        );
        update(id, { state: 'failed' });
        processQueue();
        return;
    }

    // Asking first avoids the server rejecting a large body mid-stream.
    if (!overwrite && serverFileCache?.has(file.name)) {
        activeUploadId = id;
        const ok = await showConfirm(`"${file.name}" already exists. Overwrite it?`);
        activeUploadId = null;
        if (ok) return uploadFile(id, true);
        update(id, { state: 'cancelled' });
        processQueue();
        return;
    }

    update(id, { state: 'active', pct: 0 });
    activeUploadId = id;
    const xhr = new XMLHttpRequest();
    activeUploadXhr = xhr;
    const form = new FormData();
    form.append('file', file);

    const finish = () => {
        activeUploadXhr = null;
        activeUploadId = null;
        files.delete(id);
        processQueue();
    };

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable)
            update(id, { pct: Math.round((e.loaded / e.total) * 100) });
    });

    xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            update(id, { state: 'done', pct: 100 });
            try {
                const data = JSON.parse(xhr.responseText);
                showToast(
                    `Uploaded: ${data.filename} (${formatSize(data.size)})`,
                    'success',
                );
            } catch {
                showToast('Upload complete', 'success');
            }
            finish();
        } else if (xhr.status === 409) {
            activeUploadXhr = null;
            void showConfirm(`"${file.name}" already exists. Overwrite it?`).then(
                (ok) => {
                    if (ok) void uploadFile(id, true);
                    else {
                        update(id, { state: 'cancelled' });
                        finish();
                    }
                },
            );
        } else {
            let err = `Upload failed (${xhr.status})`;
            try {
                err = JSON.parse(xhr.responseText).error || err;
            } catch {
                /* keep the status message */
            }
            update(id, { state: 'failed' });
            showToast(`${file.name}: ${err}`, 'error');
            finish();
        }
    });

    xhr.addEventListener('abort', () => {
        update(id, { state: 'cancelled' });
        showToast(`${file.name}: upload cancelled`, 'info');
        finish();
    });

    xhr.addEventListener('error', () => {
        update(id, { state: 'failed' });
        showToast(`${file.name}: upload failed (network error)`, 'error');
        finish();
    });

    let url = `/api/files/upload?session_id=${sessionQuery()}`;
    if (overwrite) url += '&overwrite=true';
    xhr.open('POST', url);
    const auth = Auth.httpHeader();
    if (auth) xhr.setRequestHeader('Authorization', auth);
    xhr.send(form);
}

// ------------------------------------------------------------------
// Download (streamed, with progress + cancel)
// ------------------------------------------------------------------
export function download(path: string): void {
    const name = path.split('/').pop() || path;
    const id = add('download', name, 'active', assignBatch());
    const controller = new AbortController();
    controllers.set(id, controller);
    showToast(`Downloading: ${name}`, 'info');

    const url = `/api/files/download?path=${encodeURIComponent(path)}&session_id=${sessionQuery()}`;
    void (async () => {
        try {
            const resp = await fetch(url, {
                headers: Auth.headers(),
                signal: controller.signal,
            });
            if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
            const total = Number(resp.headers.get('Content-Length')) || 0;
            const chunks: BlobPart[] = [];
            if (resp.body) {
                const reader = resp.body.getReader();
                let received = 0;
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    if (total > 0)
                        update(id, { pct: Math.round((received / total) * 100) });
                }
            } else {
                chunks.push(await resp.blob());
            }
            const blobUrl = URL.createObjectURL(new Blob(chunks));
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
            update(id, { state: 'done', pct: 100 });
            showToast(`Downloaded: ${name}`, 'success');
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                update(id, { state: 'cancelled' });
                showToast(`Download cancelled: ${name}`, 'info');
            } else {
                update(id, { state: 'failed' });
                showToast(
                    err instanceof Error ? err.message : 'Download failed',
                    'error',
                );
            }
        } finally {
            controllers.delete(id);
        }
    })();
}
