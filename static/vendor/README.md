# Vendor Libraries

This directory contains third-party JavaScript/WASM libraries and fonts that are embedded into the application for security and reliability.

## Why Local Hosting?

All dependencies are hosted locally instead of using CDN links to:

1. **Security**: Eliminate the risk of CDN hijacking or man-in-the-middle attacks
2. **Reliability**: No dependency on external services
3. **Privacy**: No third-party tracking or external requests
4. **Offline Support**: Works without internet connection
5. **Performance**: Faster load times (no DNS lookup, SSL handshake to CDN)

## Included Libraries

### ghostty-web v0.4.0 (built from git)
- **Files**:
  - `ghostty-web.js` — ES module build (`Terminal`, `FitAddon`, `Ghostty`)
  - `ghostty-vt.wasm` — Ghostty's VT parser/terminal core compiled to WebAssembly
  - `__vite-browser-external-*.js` — empty stub for the library's Node-only
    `fs` fallback; imported by `ghostty-web.js` and must ship alongside it
  - `ghostty-web.LICENSE` — upstream license
- **Purpose**: Terminal emulator for the web with an xterm.js-compatible API
  (URL and OSC 8 link detection built in; no separate addons)
- **License**: MIT
- **Source**: https://github.com/coder/ghostty-web
- **Built from**: ghostty-web `1858a59`, Ghostty submodule `5714ed0`

The WASM module is loaded explicitly from `/vendor/scripts/ghostty-vt.wasm` in
`static/js/terminal.js`. Compiling it requires `'wasm-unsafe-eval'` in the
server's `Content-Security-Policy` (`src/server/http.rs`).

## Fonts

Located in `fonts/`:

### 0xProto Nerd Font Mono
- **Files**: `0xProtoNerdFontMono-Regular.woff2`, `0xProtoNerdFontMono-Bold.woff2`
- **Purpose**: Self-hosted terminal font (Nerd Font icons + ligatures)
- **License**: OFL-1.1
- **Source**: https://github.com/ryanoasis/nerd-fonts

Preloaded in `index.html`, awaited via `document.fonts.load` before the
terminal opens (the canvas renderer measures cell size once at startup), and
set as the terminal `fontFamily`.

## Updating ghostty-web

Requires Zig 0.15.2+ and Node.js (Bun is optional; npm works for the JS build).

```bash
git clone --recurse-submodules https://github.com/coder/ghostty-web
cd ghostty-web
./scripts/build-wasm.sh          # applies the WASM API patch, builds ghostty-vt.wasm
npm install --ignore-scripts
npx vite build
cp dist/ghostty-web.js dist/__vite-browser-external-*.js ghostty-vt.wasm LICENSE \
   /path/to/ttyd-rs/static/vendor/scripts/
mv /path/to/ttyd-rs/static/vendor/scripts/LICENSE /path/to/ttyd-rs/static/vendor/scripts/ghostty-web.LICENSE
```

Remove any stale `__vite-browser-external-*.js` (its hash changes between
builds), update the commit hashes above, then `cargo run` and test in a
browser.

**Caching caveat**: vendor assets are served `immutable` for one year under
fixed filenames, so browsers that already cached an older `ghostty-web.js` /
`ghostty-vt.wasm` may keep it after an upgrade until the cache is cleared.

## Verification

Verify no external dependencies:

```bash
# Check HTML for CDN links
grep -i "cdn\|unpkg\|jsdelivr" static/index.html

# Should return empty (no matches)
```

## Build Process

These files are automatically embedded into the binary at compile time using `rust-embed`, so they are served directly from memory without filesystem access.
