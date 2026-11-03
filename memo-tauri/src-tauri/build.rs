use std::path::Path;

fn watch_tree(path: &Path) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() { watch_tree(&path); }
            else { println!("cargo:rerun-if-changed={}", path.display()); }
        }
    }
}

fn main() {
    // The shared renderer is embedded into the Tauri executable. Track every
    // asset so UI/i18n updates never leave a stale page inside a new binary.
    watch_tree(Path::new("../../memo/src/renderer"));
    tauri_build::build()
}
