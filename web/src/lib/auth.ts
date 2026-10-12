// Authentication state and credential encoding.

export type AuthMethod = 'basic' | 'token';

/** UTF-8-safe Base64 (btoa only accepts Latin-1). */
function b64Encode(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

let method: AuthMethod | null = null;
let credentials = '';

export const Auth = {
    /** Configure from the /api/config `auth_method` field. */
    init(authMethod: string | null | undefined): AuthMethod | null {
        method = authMethod === 'token' ? 'token' : authMethod ? 'basic' : null;
        credentials = '';
        return method;
    },

    get required(): boolean {
        return method !== null;
    },

    get method(): AuthMethod | null {
        return method;
    },

    /** Store credentials from the login form. Returns false when a required
     *  field is empty. */
    setFromForm(form: { username: string; password: string; token: string }): boolean {
        if (method === 'basic') {
            if (!form.username || !form.password) return false;
            credentials = b64Encode(`${form.username}:${form.password}`);
            return true;
        }
        if (method === 'token') {
            if (!form.token) return false;
            credentials = form.token;
            return true;
        }
        return false;
    },

    /** Payload for the WS `auth` message, or null when not required. */
    wsPayload(): { method: AuthMethod; credentials: string } | null {
        return method ? { method, credentials } : null;
    },

    /** Value for the HTTP `Authorization` header, or null. */
    httpHeader(): string | null {
        if (!method || !credentials) return null;
        return method === 'basic' ? `Basic ${credentials}` : `Bearer ${credentials}`;
    },

    headers(): Record<string, string> {
        const h = Auth.httpHeader();
        return h ? { Authorization: h } : {};
    },
};
