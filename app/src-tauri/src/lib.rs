// Vỏ app: chỉ mở cửa sổ chứa game (HTML/JS trong app/dist) + plugin mở link bằng trình duyệt.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("không khởi động được ứng dụng");
}
