use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "static/"]
pub struct Assets;

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    /// Embedded build asset matching `assets/<prefix>*<suffix>` (Vite adds
    /// a content hash to every file name under `assets/`).
    fn hashed_asset(prefix: &str, suffix: &str) -> Option<String> {
        Assets::iter()
            .find(|p| p.starts_with(&format!("assets/{prefix}")) && p.ends_with(suffix))
            .map(|p| p.into_owned())
    }

    fn index_html() -> String {
        let asset = Assets::get("index.html").unwrap();
        String::from_utf8(asset.data.into_owned()).unwrap()
    }

    #[test]
    fn test_assets_index_references_bundle() {
        let html = index_html();
        assert!(html.contains("<title>ttyd-rs</title>"));
        assert!(html.contains("id=\"root\""));
        let js = hashed_asset("index-", ".js").unwrap();
        let css = hashed_asset("index-", ".css").unwrap();
        assert!(
            html.contains(&format!("/{js}")),
            "index.html must load {js}"
        );
        assert!(
            html.contains(&format!("/{css}")),
            "index.html must load {css}"
        );
        // The CSP has no 'unsafe-inline' for scripts, so the page must not
        // carry inline <script> blocks.
        assert!(!html.contains("<script>"));
        assert!(!html.contains("<script type=\"module\">"));
    }

    #[test]
    fn test_assets_ghostty_wasm() {
        let path = hashed_asset("ghostty-vt-", ".wasm").unwrap();
        let content = Assets::get(&path).unwrap();
        // WebAssembly binary magic: "\0asm"
        assert_eq!(&content.data[..4], b"\0asm");
    }

    #[test]
    fn test_assets_fonts() {
        assert!(hashed_asset("jetbrains-mono-latin-wght-normal-", ".woff2").is_some());
        assert!(hashed_asset("0xProtoNerdFontMono-Regular-", ".woff2").is_some());
    }

    #[test]
    fn test_assets_pwa_files() {
        let manifest = Assets::get("manifest.webmanifest").unwrap();
        let manifest: serde_json::Value = serde_json::from_slice(&manifest.data).unwrap();
        assert_eq!(manifest["start_url"], "/");
        let icons = manifest["icons"].as_array().unwrap();
        for icon in icons {
            let src = icon["src"].as_str().unwrap().trim_start_matches('/');
            assert!(Assets::get(src).is_some(), "manifest icon missing: {src}");
        }
        assert!(index_html().contains("/manifest.webmanifest"));
        assert!(Assets::get("sw.js").is_some());
        assert!(Assets::get("apple-touch-icon.png").is_some());
        assert!(Assets::get("favicon.ico").is_some());
    }

    #[test]
    fn test_service_worker_bypasses_api_and_ws() {
        let sw = Assets::get("sw.js").unwrap();
        let sw = std::str::from_utf8(&sw.data).unwrap();
        assert!(sw.contains("'/api/'"));
        assert!(sw.contains("'/ws'"));
    }

    #[test]
    fn test_assets_get_nonexistent_returns_none() {
        assert!(Assets::get("nonexistent.txt").is_none());
        assert!(Assets::get("some/deep/path/file.js").is_none());
    }
}
