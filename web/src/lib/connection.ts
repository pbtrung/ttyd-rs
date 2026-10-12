// WebSocket connection, reconnection policy, heartbeat and message dispatch.
import { Auth } from './auth';
import { CONFIG } from './config';
import { fileStore, renderFileList, renderFileListError } from './files';
import {
    term,
    currentDimensions,
    writeErrorMessage,
    writeSystemMessage,
} from './terminal';
import { showToast } from './toast';
import { uiStore } from './ui';

// ------------------------------------------------------------------
// Reconnect policy — retry count + exponential backoff in one place
// ------------------------------------------------------------------
const ReconnectPolicy = {
    count: 0,
    get exhausted() {
        return this.count >= CONFIG.reconnect.MAX_RETRIES;
    },
    reset() {
        this.count = 0;
    },
    /** Record an attempt and return the delay (ms) before the next one. */
    nextDelay() {
        this.count++;
        const { BASE_DELAY, MAX_DELAY } = CONFIG.reconnect;
        return Math.min(BASE_DELAY * 2 ** (this.count - 1), MAX_DELAY);
    },
};

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let countdownTimer: number | null = null;
let heartbeatTimer: number | null = null;
let pongCheckTimer: number | null = null;
let lastPongTime = Date.now();
// Timestamps of the latest hidden/visible transitions. pongCheckTimer
// ignores elapsed time that includes a stretch where the tab was hidden
// (timers throttled or frozen) until the foreground probe re-validates
// the connection — see the visibilitychange handler.
let lastHiddenAt = 0;
let lastVisibleAt = 0;
let probeAwaitingPong = false;
let visibilityProbeTimer: number | null = null;
let serverDisconnected = false;
let authFailed = false;
let hasAuthenticated = false;
let readOnly = false;
let hasShownReadOnlyWarning = false;
// True while a reconnect is starting (debounces Enter-to-reconnect).
let reconnecting = false;

const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
let joinSessionId = new URLSearchParams(location.search).get('session');

function sendMsg(type: string, data: object): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({ type, data }));
        } catch (e) {
            console.error('Failed to send message:', e);
            showToast('Failed to send; the connection may be down', 'error');
        }
    }
}

export const isOpen = () => !!ws && ws.readyState === WebSocket.OPEN;

/** Send the current terminal size (if connected). */
export function sendResize(): void {
    if (serverDisconnected) return;
    const { cols, rows } = currentDimensions();
    sendMsg('resize', { cols, rows });
}

export function sendFileList(path: string, showHidden: boolean): boolean {
    if (!isOpen()) return false;
    sendMsg('file_list', { path, show_hidden: showHidden });
    return true;
}

/** Whether keyboard input must not be sent right now. */
export const inputBlocked = () => serverDisconnected || readOnly;

export function sendInput(data: string): void {
    sendMsg('input', { payload: data });
}

// ------------------------------------------------------------------
// Status helpers
// ------------------------------------------------------------------
function setConnected(connected: boolean): void {
    uiStore.set({
        status: connected ? 'connected' : 'disconnected',
        statusText: connected ? 'Connected' : 'Disconnected',
        online: connected && hasAuthenticated,
    });
}

function showBanner(kind: 'reconnecting' | 'lost', text: string): void {
    uiStore.set({
        banner: { kind, text },
        status: kind === 'reconnecting' ? 'reconnecting' : 'disconnected',
    });
}

const hideBanner = () => uiStore.set({ banner: null });

function clearSession(): void {
    uiStore.set({ sessionId: null });
}

function setReadOnly(value: boolean): void {
    readOnly = value;
    uiStore.set({ readOnly: value });
}

function showLoginError(error: string): void {
    const login = uiStore.get().login;
    if (login) uiStore.set({ login: { ...login, error, busy: false } });
}

function clearTimer(t: number | null, interval = false): null {
    if (t !== null) (interval ? clearInterval : clearTimeout)(t);
    return null;
}

function stopHeartbeatTimers(): void {
    heartbeatTimer = clearTimer(heartbeatTimer, true);
    pongCheckTimer = clearTimer(pongCheckTimer, true);
}

// ------------------------------------------------------------------
// Connect
// ------------------------------------------------------------------
export function connect(): void {
    reconnectTimer = clearTimer(reconnectTimer);
    countdownTimer = clearTimer(countdownTimer, true);
    authFailed = false;
    if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
            ws.close();
        ws = null;
    }

    const socket = new WebSocket(wsUrl);
    ws = socket;

    socket.onopen = () => {
        ReconnectPolicy.reset();
        serverDisconnected = false;
        reconnecting = false;
        hideBanner();
        stopHeartbeatTimers();

        lastPongTime = Date.now();
        heartbeatTimer = window.setInterval(
            () => sendMsg('ping', { timestamp: Date.now() }),
            CONFIG.heartbeat.INTERVAL,
        );
        pongCheckTimer = window.setInterval(() => {
            // Skip while hidden or until the foreground probe re-validates:
            // elapsed time then includes throttled/frozen stretches rather
            // than real server silence. `document.hidden` also covers a page
            // loaded in a background tab that never fired visibilitychange.
            if (
                document.hidden ||
                lastHiddenAt > lastPongTime ||
                lastVisibleAt > lastPongTime
            )
                return;
            if (Date.now() - lastPongTime > CONFIG.heartbeat.PONG_TIMEOUT) {
                console.error('Server pong timeout, forcing reconnect');
                ws?.close();
            }
        }, CONFIG.heartbeat.PONG_CHECK_INTERVAL);

        const auth = Auth.wsPayload();
        if (auth) sendMsg('auth', auth);
        else onAuthenticated();
    };

    socket.onmessage = (event) => {
        let msg: { type: string; data: any };
        try {
            msg = JSON.parse(event.data as string);
        } catch (e) {
            console.error('Failed to parse message:', e);
            return;
        }
        switch (msg.type) {
            case 'auth_ok': {
                // When auth is required, /api/config omits file-transfer
                // details; they arrive with the capabilities instead.
                const cap = msg.data?.capabilities;
                if (cap) {
                    uiStore.set({
                        fileTransfer: cap.file_transfer !== false,
                        maxUploadSize: cap.max_upload_size || null,
                    });
                }
                onAuthenticated();
                break;
            }
            case 'auth_fail':
                authFailed = true;
                ReconnectPolicy.count = CONFIG.reconnect.MAX_RETRIES;
                showLoginError(msg.data?.reason || 'Authentication failed');
                ws?.close();
                break;
            case 'ready':
                setConnected(true);
                hideBanner();
                if (msg.data?.session_id)
                    uiStore.set({ sessionId: msg.data.session_id });
                setReadOnly(!!msg.data?.readonly);
                hasShownReadOnlyWarning = false;
                if (readOnly)
                    writeSystemMessage(
                        'Read-only mode: your keystrokes will not be sent.',
                    );
                break;
            case 'output':
                term.write(msg.data.payload);
                break;
            case 'pong':
                lastPongTime = Date.now();
                probeAwaitingPong = false;
                break;
            case 'disconnect':
                writeSystemMessage(`Disconnected: ${msg.data?.reason}`);
                writeSystemMessage('Press Enter or refresh page to reconnect.');
                setConnected(false);
                setReadOnly(false);
                clearSession();
                serverDisconnected = true;
                stopHeartbeatTimers();
                showBanner(
                    'lost',
                    'Session ended. Press Enter or reconnect to start a new one.',
                );
                ws?.close();
                break;
            case 'error': {
                const { code, message, fatal } = msg.data ?? {};
                if (
                    (code === 'FILE_LIST_ERROR' || code === 'FILE_TRANSFER_DISABLED') &&
                    fileStore.get().open
                ) {
                    renderFileListError(message);
                } else {
                    writeErrorMessage(`Error: ${message}`);
                }
                if (fatal) {
                    showToast(`Fatal error: ${message}`, 'error');
                    // A stale join target (e.g. ?session=) would fail on every
                    // reconnect; drop it so the next attempt starts fresh.
                    if (code === 'SESSION_NOT_FOUND') {
                        joinSessionId = null;
                        clearSession();
                    }
                    serverDisconnected = true;
                    ws?.close();
                }
                break;
            }
            case 'file_list_result':
                renderFileList(msg.data);
                break;
            default:
                console.warn('Unknown message type:', msg.type);
        }
    };

    socket.onerror = () => {
        // onclose shows the reconnect banner; only toast mid-session so the
        // first failed connect doesn't notify twice.
        if (hasAuthenticated && !serverDisconnected)
            showToast('WebSocket connection error', 'error');
    };

    socket.onclose = () => {
        uiStore.set({ online: false });
        if (uiStore.get().menu === 'files') uiStore.set({ menu: null });
        stopHeartbeatTimers();

        // Auth failed: the login dialog is the primary surface.
        if (authFailed) return;

        // Auth required but never authenticated (e.g. network failure during
        // login): keep the login dialog up so the user can retry.
        if (Auth.required && !hasAuthenticated) {
            setConnected(false);
            showLoginError(
                'Cannot reach the server. Check your network and try again.',
            );
            return;
        }

        setConnected(false);

        if (serverDisconnected || ReconnectPolicy.exhausted) {
            showBanner(
                'lost',
                serverDisconnected
                    ? 'Connection closed by the server. Reconnect to start a new session.'
                    : 'Connection lost. Check your network and try again.',
            );
            return;
        }

        const delay = ReconnectPolicy.nextDelay();
        const retryText = `Reconnecting (${ReconnectPolicy.count}/${CONFIG.reconnect.MAX_RETRIES})`;
        let remaining = Math.ceil(delay / 1000);
        showBanner('reconnecting', `${retryText} — retrying in ${remaining}s`);
        uiStore.set({ statusText: `${retryText}…` });
        countdownTimer = window.setInterval(() => {
            remaining--;
            if (remaining > 0)
                showBanner('reconnecting', `${retryText} — retrying in ${remaining}s`);
            else countdownTimer = clearTimer(countdownTimer, true);
        }, 1000);
        reconnectTimer = window.setTimeout(connect, delay);
    };
}

// Called after auth succeeds (or when no auth is needed).
function onAuthenticated(): void {
    hasAuthenticated = true;
    setReadOnly(false);
    uiStore.set({ login: null, online: true });

    // Resize first (the server requires it), then optionally join.
    sendResize();
    const rejoinId = uiStore.get().sessionId || joinSessionId;
    if (rejoinId) sendMsg('join', { session_id: rejoinId });
}

/** Manual reconnect: reset backoff and the session-ended flag. The server
 *  rejoins the current session if it is still alive, else starts a new one. */
export function reconnectNow(): void {
    ReconnectPolicy.reset();
    serverDisconnected = false;
    writeSystemMessage('Reconnecting...');
    showBanner('reconnecting', 'Reconnecting…');
    connect();
}

export function submitLogin(form: {
    username: string;
    password: string;
    token: string;
}): void {
    const login = uiStore.get().login;
    if (!login) return;
    if (!Auth.setFromForm(form)) {
        uiStore.set({
            login: {
                ...login,
                busy: false,
                error:
                    login.method === 'token'
                        ? 'Please enter a token'
                        : 'Please enter username and password',
            },
        });
        return;
    }
    uiStore.set({ login: { ...login, busy: true, error: '' } });
    ReconnectPolicy.reset();
    connect();
}

// ------------------------------------------------------------------
// Terminal input
// ------------------------------------------------------------------
function handleTerminalData(data: string): void {
    if (serverDisconnected) {
        if ((data === '\r' || data === '\n') && !reconnecting) {
            reconnecting = true;
            writeSystemMessage('Reconnecting...');
            connect();
        }
        return;
    }
    if (readOnly) {
        if (!hasShownReadOnlyWarning) {
            hasShownReadOnlyWarning = true;
            showToast('This is a read-only session. You cannot send input.', 'info');
        }
        return;
    }
    sendInput(data);
}

// ------------------------------------------------------------------
// Tab visibility: a backgrounded tab's timers may be frozen, and mobile
// browsers can kill the socket without firing onclose. On return, probe
// the connection with a fresh one-off timer.
// ------------------------------------------------------------------
function handleVisibilityChange(): void {
    if (document.hidden) {
        lastHiddenAt = Date.now();
        return;
    }
    lastVisibleAt = Date.now();
    visibilityProbeTimer = clearTimer(visibilityProbeTimer);

    if (
        !ws ||
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING
    ) {
        // Known to be down: reconnect now instead of waiting out the backoff.
        if (
            !serverDisconnected &&
            !authFailed &&
            (!Auth.required || hasAuthenticated)
        ) {
            reconnectTimer = clearTimer(reconnectTimer);
            ReconnectPolicy.reset();
            connect();
        }
        return;
    }
    if (ws.readyState !== WebSocket.OPEN) return;

    probeAwaitingPong = true;
    sendMsg('ping', { timestamp: Date.now() });
    visibilityProbeTimer = window.setTimeout(() => {
        visibilityProbeTimer = null;
        if (probeAwaitingPong) {
            probeAwaitingPong = false;
            console.warn('Foreground probe got no response, forcing reconnect');
            ws?.close();
        }
    }, CONFIG.heartbeat.FOREGROUND_PROBE_TIMEOUT);
}

// ------------------------------------------------------------------
// Startup: fetch /api/config, then connect or ask for credentials
// ------------------------------------------------------------------
export async function start(): Promise<void> {
    term.onData(handleTerminalData);
    let resizeTimer: number | null = null;
    term.onResize(() => {
        resizeTimer = clearTimer(resizeTimer);
        resizeTimer = window.setTimeout(sendResize, CONFIG.ui.RESIZE_DEBOUNCE);
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();
        uiStore.set({
            fileTransfer: config.file_transfer_enabled !== false,
            maxUploadSize: config.max_upload_size || null,
        });
        const method = Auth.init(config.auth_method);
        if (method) {
            uiStore.set({
                login: { method, error: '', busy: false },
                status: 'pending',
                statusText: 'Login required',
            });
            return;
        }
    } catch (e) {
        console.error('Failed to load server config:', e);
        showToast('Could not load server config; connecting directly…', 'error');
    }
    connect();
}
