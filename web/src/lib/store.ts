// Minimal external store: plain modules own the state (so non-React code
// such as the WebSocket layer can update it) and components subscribe with
// `useStore`.
import { useSyncExternalStore } from 'react';

export interface Store<T> {
    get(): T;
    set(patch: Partial<T> | ((state: T) => Partial<T>)): void;
    subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        set(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch;
            state = { ...state, ...next };
            listeners.forEach((l) => l());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

/** Subscribe to a slice of a store. The selector must return a primitive or
 *  a reference already held by the state (not a freshly built object). */
export function useStore<T, U>(store: Store<T>, selector: (state: T) => U): U {
    return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
