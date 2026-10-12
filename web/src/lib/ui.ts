// App-level UI state shared by the header, dialogs and the WebSocket layer.
import { createStore } from './store';

export type Menu = 'settings' | 'files' | 'transfers' | null;
export type Status =
    'pending' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const uiStore = createStore({
    status: 'connecting' as Status,
    statusText: 'Connecting…',
    banner: null as null | { kind: 'reconnecting' | 'lost'; text: string },
    sessionId: null as string | null,
    readOnly: false,
    /** File transfer enabled on the server (from /api/config or auth_ok). */
    fileTransfer: false,
    /** Authenticated and connected: file actions are usable. */
    online: false,
    maxUploadSize: null as number | null,
    login: null as null | { method: 'basic' | 'token'; error: string; busy: boolean },
    menu: null as Menu,
    shortcutManagerOpen: false,
    dragging: false,
});

export const closeMenus = () => uiStore.set({ menu: null });

export function toggleMenu(menu: Exclude<Menu, null>): void {
    uiStore.set((s) => ({ menu: s.menu === menu ? null : menu }));
}

export function openUploadPicker(): void {
    document.getElementById('upload-input')?.click();
}
