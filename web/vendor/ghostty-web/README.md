# Vendored ghostty-web

[ghostty-web](https://github.com/coder/ghostty-web) (MIT) built from git: Ghostty's
VT parser compiled to WebAssembly behind an xterm.js-compatible API. The app
depends on it as a local package (`"ghostty-web": "file:vendor/ghostty-web"` in
`web/package.json`), and Vite bundles it into `static/assets/` with a content
hash.

- **Built from**: ghostty-web `1858a59` (v0.4.0), Ghostty submodule `5714ed0`
- **Files**: `ghostty-web.js` (ES module), `index.d.ts` (types), `ghostty-vt.wasm`,
  `__vite-browser-external-*.js` (empty stub for the library's Node-only `fs`
  fallback, imported by `ghostty-web.js`), `LICENSE`

`web/src/lib/terminal.ts` imports the WASM with `?url` and passes it to
`Ghostty.load()`. Compiling it requires `'wasm-unsafe-eval'` in the server CSP
(`src/server/http.rs`). The license ships as `static/licenses/ghostty-web.txt`.

## Updating

Requires Zig 0.15.2+ and Node.js (Bun is optional; npm works for the JS build).

```bash
git clone --recurse-submodules https://github.com/coder/ghostty-web
cd ghostty-web
./scripts/build-wasm.sh          # applies the WASM API patch, builds ghostty-vt.wasm
npm install --ignore-scripts
npx vite build
V=/path/to/ttyd-rs/web/vendor/ghostty-web
rm -f "$V"/__vite-browser-external-*.js   # hash changes between builds
cp dist/ghostty-web.js dist/index.d.ts dist/__vite-browser-external-*.js ghostty-vt.wasm LICENSE "$V"/
cp LICENSE /path/to/ttyd-rs/web/public/licenses/ghostty-web.txt
```

Then update the commit hashes above and in `package.json`, reinstall
(`cd web && npm install`), rebuild (`npm run build`), test in a browser, and
commit `web/` together with the regenerated `static/`.
