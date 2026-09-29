#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Release packages carry a fixed runtime beside the executable. No bootstrap download.
    #[cfg(all(windows, not(debug_assertions)))]
    {
        use std::os::windows::process::CommandExt;
        let root = std::env::current_exe().expect("Application path").parent().unwrap().to_path_buf();
        let runtime = root.join("WebView2");
        if !runtime.join("msedgewebview2.exe").exists() {
            panic!("The bundled WebView2 folder is missing. Extract the whole portable archive.");
        }
        std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &runtime);
        // Microsoft's fixed-runtime sandbox requires these read/execute ACLs on Windows 10.
        // Scope is the bundled renderer directory only; no user files are shared.
        let _ = std::process::Command::new("icacls.exe")
            .arg(&runtime).args(["/grant", "*S-1-15-2-1:(OI)(CI)(RX)", "/grant", "*S-1-15-2-2:(OI)(CI)(RX)", "/T", "/Q"])
            .creation_flags(0x08000000).output();
        let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", format!("{} --disable-background-networking --disable-component-update --disable-domain-reliability --disable-breakpad --disable-features=msEdgeShoppingAssistant,msEdgeSidebarV2 --no-first-run", existing));
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("RRT Lite could not start");
}
