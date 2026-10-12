import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The build output is committed to ../static and embedded into the Rust
// binary with rust-embed, so `cargo build` never needs Node.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        outDir: '../static',
        emptyOutDir: true,
        // Never inline assets as data: URIs — the server CSP only allows
        // same-origin fonts (`font-src 'self'`), and hashed files under
        // /assets/ are served with an immutable cache header.
        assetsInlineLimit: 0,
        target: 'es2025',
        chunkSizeWarningLimit: 1024,
        // Third-party notices for everything bundled (served at /licenses.md).
        license: { fileName: 'licenses.md' },
    },
    server: {
        // `npm run dev` against a locally running ttyd-rs (default port).
        proxy: {
            '/api': 'http://127.0.0.1:7681',
            '/ws': { target: 'ws://127.0.0.1:7681', ws: true },
        },
    },
});
