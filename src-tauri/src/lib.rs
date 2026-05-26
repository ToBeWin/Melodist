#![deny(unsafe_code)]

/// Audio playback engine.
pub mod audio;
/// Tauri IPC command handlers.
pub mod commands;
/// Embedded cover art extraction and cache helpers.
pub mod cover;
/// Local music library scanning and persistence.
pub mod library;
/// Lyrics parsing and serialization logic.
pub mod lyrics;
/// Shared application state.
pub mod state;
/// Serializable data types shared with the frontend.
pub mod types;

use state::AppState;

/// Runs the Melodist Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(error) = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            commands::player::start_player_event_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::player::play,
            commands::player::set_queue,
            commands::player::update_queue,
            commands::player::next_track,
            commands::player::previous_track,
            commands::player::pause,
            commands::player::seek,
            commands::player::set_volume,
            commands::player::set_replay_gain_enabled,
            commands::player::list_audio_output_devices,
            commands::player::set_audio_output_device,
            commands::player::toggle_shuffle,
            commands::player::cycle_repeat,
            commands::player::get_player_state,
            commands::library::scan_directory,
            commands::library::import_dropped_paths,
            commands::library::watch_library_directories,
            commands::library::remove_library_directory,
            commands::library::search_tracks,
            commands::library::get_all_tracks,
            commands::library::get_all_albums,
            commands::library::show_in_file_manager,
            commands::lyrics::load_lyrics,
            commands::lyrics::save_lrc,
            commands::lyrics::generate_lyrics,
            commands::lyrics::translate_lyrics,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::get_data_locations,
            commands::settings::open_app_data_dir,
            commands::settings::clear_cover_cache,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("Failed to run Melodist: {error}");
    }
}
