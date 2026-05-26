use std::fs;
use std::path::Path;
use std::process::Command;

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::types::{AppSettings, DataLocations};

const SETTINGS_STORE_PATH: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

/// Loads persistent application settings from the Tauri store.
#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(SETTINGS_STORE_PATH)
        .map_err(|error| format!("Failed to open settings store: {error}"))?;

    let Some(value) = store.get(SETTINGS_KEY) else {
        let settings = AppSettings::default();
        save_settings_to_store(&app, &settings)?;
        return Ok(settings);
    };

    serde_json::from_value(value)
        .map_err(|error| format!("Failed to parse settings store: {error}"))
}

/// Saves persistent application settings to the Tauri store immediately.
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    save_settings_to_store(&app, &settings)?;
    Ok(settings)
}

/// Returns local data paths used by the app.
#[tauri::command]
pub async fn get_data_locations(app: AppHandle) -> Result<DataLocations, String> {
    data_locations(&app)
}

/// Opens the local app data directory in the platform file manager.
#[tauri::command]
pub async fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    let locations = data_locations(&app)?;
    open_path_in_file_manager(Path::new(&locations.app_data_dir))
}

/// Clears extracted cover art cache files.
#[tauri::command]
pub async fn clear_cover_cache(app: AppHandle) -> Result<u32, String> {
    let locations = data_locations(&app)?;
    let cover_cache_dir = std::path::PathBuf::from(locations.cover_cache_dir);
    tauri::async_runtime::spawn_blocking(move || {
        if !cover_cache_dir.is_dir() {
            return Ok(0);
        }

        let mut removed = 0_u32;
        for entry in fs::read_dir(&cover_cache_dir)
            .map_err(|error| format!("Failed to read cover cache directory: {error}"))?
        {
            let entry = entry.map_err(|error| format!("Failed to inspect cache entry: {error}"))?;
            let path = entry.path();
            if path.is_file() {
                fs::remove_file(&path)
                    .map_err(|error| format!("Failed to remove {}: {error}", path.display()))?;
                removed = removed.saturating_add(1);
            }
        }
        Ok(removed)
    })
    .await
    .map_err(|error| format!("Clear cover cache task failed: {error}"))?
}

fn save_settings_to_store(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE_PATH)
        .map_err(|error| format!("Failed to open settings store: {error}"))?;
    let value = serde_json::to_value(settings)
        .map_err(|error| format!("Failed to serialize settings: {error}"))?;
    store.set(SETTINGS_KEY, value);
    store
        .save()
        .map_err(|error| format!("Failed to save settings store: {error}"))
}

fn data_locations(app: &AppHandle) -> Result<DataLocations, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    Ok(DataLocations {
        app_data_dir: app_data_dir.display().to_string(),
        settings_path: app_data_dir.join(SETTINGS_STORE_PATH).display().to_string(),
        library_database_path: app_data_dir.join("library.sqlite3").display().to_string(),
        cover_cache_dir: app_data_dir.join("cover-cache").display().to_string(),
    })
}

#[cfg(target_os = "macos")]
fn open_path_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open Finder: {error}"))
}

#[cfg(target_os = "windows")]
fn open_path_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open File Explorer: {error}"))
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn open_path_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open file manager: {error}"))
}
