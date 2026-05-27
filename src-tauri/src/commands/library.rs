use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager};
use tokio::task;
use walkdir::WalkDir;

use crate::library::db::Database;
use crate::library::metadata::{is_supported_audio_file, read_track_from_path_with_cover_cache};
use crate::library::scanner::{self, ScanFailure, ScanResult};
use crate::lyrics::parse_lrc;
use crate::state::AppState;
use crate::types::{Album, Track};

const LIBRARY_WATCH_INTERVAL: Duration = Duration::from_secs(10);

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;
    Ok(app_data_dir.join("library.sqlite3"))
}

fn cover_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(app_data_dir.join("cover-cache"))
}

fn open_database(app: &AppHandle) -> Result<Database, String> {
    let path = database_path(app)?;
    Database::open(&path).map_err(|error| format!("Failed to open library database: {error}"))
}

fn validate_scan_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("Directory path cannot be empty".to_string());
    }

    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err(format!("Directory does not exist: {}", path.display()));
    }
    path.canonicalize()
        .map_err(|error| format!("Failed to resolve directory path: {error}"))
}

fn validate_track_file_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("Track path cannot be empty".to_string());
    }

    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err(format!("Track file does not exist: {}", path.display()));
    }
    Ok(path)
}

#[cfg(target_os = "macos")]
fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to reveal file in Finder: {error}"))
}

#[cfg(target_os = "windows")]
fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    let selection = format!("/select,{}", path.display());
    Command::new("explorer")
        .arg(selection)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to reveal file in File Explorer: {error}"))
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or_else(|| format!("Failed to resolve parent directory for {}", path.display()))?;
    Command::new("xdg-open")
        .arg(directory)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open file directory: {error}"))
}

/// Scans a directory and persists discovered audio files to the local library.
#[tauri::command]
pub async fn scan_directory(app: AppHandle, path: String) -> Result<ScanResult, String> {
    let scan_path = validate_scan_path(&path)?;
    let database_path = database_path(&app)?;
    let cover_cache_dir = cover_cache_dir(&app)?;
    let app_for_scan = app.clone();

    let scan_path_for_result = scan_path.clone();
    let mut result = task::spawn_blocking(move || {
        let database = Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        let app_for_progress = app_for_scan.clone();
        scanner::scan_directory_with_progress(
            Path::new(&scan_path),
            &database,
            Some(&cover_cache_dir),
            |progress| {
                let _ = app_for_progress.emit("library://scan-progress", progress);
            },
        )
        .map_err(|error| format!("Failed to scan library: {error}"))
    })
    .await
    .map_err(|error| format!("Library scan task failed: {error}"))??;
    result
        .imported_directories
        .push(scan_path_for_result.to_string_lossy().to_string());
    register_directory_watcher(&app, scan_path_for_result);
    let _ = app.emit("library://scan-complete", result.clone());
    Ok(result)
}

/// Imports dropped audio files and music folders into the local library.
#[tauri::command]
pub async fn import_dropped_paths(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<ScanResult, String> {
    if paths.is_empty() {
        return Err("No dropped files or folders were provided".to_string());
    }

    let dropped_paths = paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
    let database_path = database_path(&app)?;
    let cover_cache_dir = cover_cache_dir(&app)?;
    let app_for_scan = app.clone();

    let result = task::spawn_blocking(move || {
        let database = Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        let app_for_progress = app_for_scan.clone();
        import_paths_with_progress(
            &dropped_paths,
            &database,
            Some(&cover_cache_dir),
            |progress| {
                let _ = app_for_progress.emit("library://scan-progress", progress);
            },
        )
        .map_err(|error| format!("Failed to import dropped paths: {error}"))
    })
    .await
    .map_err(|error| format!("Dropped import task failed: {error}"))??;
    for directory in &result.imported_directories {
        register_directory_watcher(&app, PathBuf::from(directory));
    }
    let _ = app.emit("library://scan-complete", result.clone());
    Ok(result)
}

/// Registers saved library directories for lightweight background change polling.
#[tauri::command]
pub async fn watch_library_directories(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        let Ok(scan_path) = validate_scan_path(&path) else {
            continue;
        };
        register_directory_watcher(&app, scan_path);
    }
    Ok(())
}

/// Stops watching a library directory and removes its tracks from the database.
#[tauri::command]
pub async fn remove_library_directory(app: AppHandle, path: String) -> Result<ScanResult, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("Directory path cannot be empty".to_string());
    }

    let scan_path = PathBuf::from(trimmed_path);
    let canonical_path = scan_path.canonicalize().unwrap_or(scan_path);

    let database_path = database_path(&app)?;
    let remove_root = canonical_path.clone();
    let removed = task::spawn_blocking(move || {
        let database = Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        database
            .remove_tracks_under_directory(&remove_root)
            .map_err(|error| format!("Failed to remove library tracks: {error}"))
    })
    .await
    .map_err(|error| format!("Remove library directory task failed: {error}"))??;
    {
        let state = app.state::<AppState>();
        state.watched_directories.lock().remove(&canonical_path);
    }

    let result = ScanResult {
        added: 0,
        updated: 0,
        removed,
        failed: 0,
        imported_lyrics: 0,
        failures: Vec::new(),
        imported_directories: Vec::new(),
    };
    let _ = app.emit("library://scan-complete", result.clone());
    Ok(result)
}

fn register_directory_watcher(app: &AppHandle, scan_path: PathBuf) {
    let Ok(canonical_path) = scan_path.canonicalize() else {
        return;
    };

    let state = app.state::<AppState>();
    if !state
        .watched_directories
        .lock()
        .insert(canonical_path.clone())
    {
        return;
    }

    let app = app.clone();
    thread::spawn(move || watch_directory(app, canonical_path));
}

fn watch_directory(app: AppHandle, scan_path: PathBuf) {
    let mut previous_signature = directory_signature(&scan_path);

    loop {
        thread::sleep(LIBRARY_WATCH_INTERVAL);
        if !is_watched_directory(&app, &scan_path) {
            return;
        }

        let next_signature = directory_signature(&scan_path);
        if next_signature == previous_signature {
            continue;
        }

        previous_signature = next_signature;
        if let Err(error) = rescan_watched_directory(&app, &scan_path) {
            let _ = app.emit("library://watch-error", error);
        }
    }
}

fn is_watched_directory(app: &AppHandle, scan_path: &Path) -> bool {
    let state = app.state::<AppState>();
    let is_watched = state.watched_directories.lock().contains(scan_path);
    is_watched
}

fn rescan_watched_directory(app: &AppHandle, scan_path: &Path) -> Result<(), String> {
    let database_path = database_path(app)?;
    let cover_cache_dir = cover_cache_dir(app)?;
    let database = Database::open(&database_path)
        .map_err(|error| format!("Failed to open library database: {error}"))?;
    let app_for_progress = app.clone();

    let result = scanner::scan_directory_with_progress(
        scan_path,
        &database,
        Some(&cover_cache_dir),
        |progress| {
            let _ = app_for_progress.emit("library://scan-progress", progress);
        },
    )
    .map_err(|error| format!("Failed to rescan watched directory: {error}"))?;
    let _ = app.emit("library://scan-complete", result);
    Ok(())
}

fn import_paths_with_progress<F>(
    paths: &[PathBuf],
    database: &Database,
    cover_cache_dir: Option<&Path>,
    mut on_progress: F,
) -> Result<ScanResult, scanner::ScanError>
where
    F: FnMut(crate::types::ScanProgress),
{
    let mut result = ScanResult::default();
    let mut file_count = 0_u32;

    for path in paths {
        if path.is_dir() {
            let scan_result = scanner::scan_directory_with_progress(
                path,
                database,
                cover_cache_dir,
                |progress| {
                    on_progress(progress);
                },
            )?;
            result
                .imported_directories
                .push(imported_directory_path(path));
            merge_scan_result(&mut result, scan_result);
            continue;
        }

        file_count = file_count.saturating_add(1);
        if is_lrc_file(path) {
            import_lrc_sidecar_file(path, &mut result)?;
        } else {
            import_single_dropped_file(path, database, cover_cache_dir, &mut result)?;
        }
        on_progress(crate::types::ScanProgress {
            scanned: file_count,
            total: u32::try_from(paths.len()).unwrap_or(u32::MAX),
            current_file: path.to_string_lossy().to_string(),
        });
    }

    Ok(result)
}

fn import_single_dropped_file(
    path: &Path,
    database: &Database,
    cover_cache_dir: Option<&Path>,
    result: &mut ScanResult,
) -> Result<(), scanner::ScanError> {
    if !path.is_file() {
        push_scan_failure(
            result,
            path.to_string_lossy().to_string(),
            "Path is not a file or folder".to_string(),
        );
        return Ok(());
    }

    if !is_supported_audio_file(path) {
        push_scan_failure(
            result,
            path.to_string_lossy().to_string(),
            "Unsupported audio format".to_string(),
        );
        return Ok(());
    }

    match read_track_from_path_with_cover_cache(path, cover_cache_dir) {
        Ok(track) => {
            let existed = database.track_exists_by_path(&track.path)?;
            database.upsert_track(&track)?;
            if existed {
                result.updated += 1;
            } else {
                result.added += 1;
            }
        }
        Err(error) => {
            push_scan_failure(
                result,
                path.to_string_lossy().to_string(),
                error.to_string(),
            );
        }
    }

    Ok(())
}

fn is_lrc_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("lrc"))
}

fn matching_audio_path_for_lrc(path: &Path) -> Option<PathBuf> {
    let parent = path.parent()?;
    let lrc_stem = path.file_stem()?.to_str()?;
    let entries = fs::read_dir(parent).ok()?;

    entries.filter_map(Result::ok).find_map(|entry| {
        let audio_path = entry.path();
        let audio_stem = audio_path.file_stem()?.to_str()?;
        (audio_path.is_file()
            && is_supported_audio_file(&audio_path)
            && audio_stem.eq_ignore_ascii_case(lrc_stem))
        .then_some(audio_path)
    })
}

fn import_lrc_sidecar_file(path: &Path, result: &mut ScanResult) -> Result<(), scanner::ScanError> {
    if !path.is_file() {
        push_scan_failure(
            result,
            path.to_string_lossy().to_string(),
            "Path is not an LRC file".to_string(),
        );
        return Ok(());
    }

    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) => {
            push_scan_failure(
                result,
                path.to_string_lossy().to_string(),
                format!("Failed to read LRC file: {error}"),
            );
            return Ok(());
        }
    };

    match parse_lrc(&contents) {
        Ok(lines) if !lines.is_empty() => {}
        Ok(_) => {
            push_scan_failure(
                result,
                path.to_string_lossy().to_string(),
                "LRC must contain at least one timestamped lyric line".to_string(),
            );
            return Ok(());
        }
        Err(error) => {
            push_scan_failure(
                result,
                path.to_string_lossy().to_string(),
                format!("Failed to parse LRC: {error}"),
            );
            return Ok(());
        }
    }

    let Some(audio_path) = matching_audio_path_for_lrc(path) else {
        push_scan_failure(
            result,
            path.to_string_lossy().to_string(),
            "No same-name audio file was found for this LRC".to_string(),
        );
        return Ok(());
    };

    let target_lrc_path = audio_path.with_extension("lrc");
    let source = path.canonicalize()?;
    let target = target_lrc_path
        .canonicalize()
        .unwrap_or_else(|_| target_lrc_path.clone());
    if source != target {
        fs::copy(path, &target_lrc_path)?;
    }

    result.imported_lyrics = result.imported_lyrics.saturating_add(1);
    Ok(())
}

fn merge_scan_result(result: &mut ScanResult, next: ScanResult) {
    result.added += next.added;
    result.updated += next.updated;
    result.removed += next.removed;
    result.failed += next.failed;
    result.imported_lyrics += next.imported_lyrics;
    result
        .imported_directories
        .extend(next.imported_directories);
    for failure in next.failures {
        if result.failures.len() >= 12 {
            break;
        }
        result.failures.push(failure);
    }
}

fn imported_directory_path(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

fn push_scan_failure(result: &mut ScanResult, path: String, reason: String) {
    result.failed += 1;
    if result.failures.len() < 12 {
        result.failures.push(ScanFailure { path, reason });
    }
}

fn directory_signature(path: &Path) -> u64 {
    let mut entries = Vec::new();
    collect_directory_signature_entries(path, &mut entries);
    entries.sort_unstable();

    let mut hasher = blake3::Hasher::new();
    for entry in entries {
        hasher.update(entry.as_bytes());
        hasher.update(&[0]);
    }

    let digest = hasher.finalize();
    let mut bytes = [0_u8; 8];
    bytes.copy_from_slice(&digest.as_bytes()[..8]);
    u64::from_le_bytes(bytes)
}

fn collect_directory_signature_entries(path: &Path, signature_entries: &mut Vec<String>) {
    for entry in WalkDir::new(path)
        .follow_links(false)
        .max_depth(20)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() || !is_supported_audio_file(entry.path()) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            let modified = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs())
                .unwrap_or(0);
            signature_entries.push(format!(
                "{}\0{}\0{}",
                entry.path().to_string_lossy(),
                metadata.len(),
                modified
            ));
        }
    }
}

/// Searches tracks by title, artist, or album.
#[tauri::command]
pub async fn search_tracks(app: AppHandle, query: String) -> Result<Vec<Track>, String> {
    task::spawn_blocking(move || {
        let database = open_database(&app)?;
        database
            .search_tracks(&query)
            .map_err(|error| format!("Failed to search tracks: {error}"))
    })
    .await
    .map_err(|error| format!("Search tracks task failed: {error}"))?
}

/// Returns all library tracks.
#[tauri::command]
pub async fn get_all_tracks(app: AppHandle) -> Result<Vec<Track>, String> {
    task::spawn_blocking(move || {
        let database = open_database(&app)?;
        database
            .all_tracks()
            .map_err(|error| format!("Failed to load tracks: {error}"))
    })
    .await
    .map_err(|error| format!("Load tracks task failed: {error}"))?
}

/// Returns album summaries for the local library.
#[tauri::command]
pub async fn get_all_albums(app: AppHandle) -> Result<Vec<Album>, String> {
    task::spawn_blocking(move || {
        let database = open_database(&app)?;
        database
            .all_albums()
            .map_err(|error| format!("Failed to load albums: {error}"))
    })
    .await
    .map_err(|error| format!("Load albums task failed: {error}"))?
}

/// Reveals a track file in the system file manager.
#[tauri::command]
pub async fn show_in_file_manager(path: String) -> Result<(), String> {
    let path = validate_track_file_path(&path)?;
    task::spawn_blocking(move || reveal_path_in_file_manager(&path))
        .await
        .map_err(|error| format!("Show in file manager task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        directory_signature, import_lrc_sidecar_file, imported_directory_path,
        matching_audio_path_for_lrc,
    };
    use crate::library::scanner::ScanResult;

    static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_signature_dir() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "melodist-signature-test-{}-{suffix}-{counter}",
            std::process::id()
        ))
    }

    #[test]
    fn directory_signature_changes_when_supported_audio_file_changes() {
        let root = temp_signature_dir();
        fs::create_dir_all(&root).expect("temp signature directory");
        let initial_signature = directory_signature(&root);

        fs::write(root.join("song.flac"), b"audio").expect("write supported file");
        let changed_signature = directory_signature(&root);

        assert_ne!(initial_signature, changed_signature);
        fs::remove_dir_all(&root).expect("cleanup temp signature directory");
    }

    #[test]
    fn directory_signature_changes_when_supported_audio_file_is_renamed() {
        let root = temp_signature_dir();
        fs::create_dir_all(&root).expect("temp signature directory");
        let first_path = root.join("a.wav");
        let second_path = root.join("b.wav");
        fs::write(&first_path, b"same audio").expect("write supported file");
        let initial_signature = directory_signature(&root);

        fs::rename(first_path, second_path).expect("rename supported file");
        let renamed_signature = directory_signature(&root);

        assert_ne!(initial_signature, renamed_signature);
        fs::remove_dir_all(&root).expect("cleanup temp signature directory");
    }

    #[test]
    fn matching_audio_path_for_lrc_finds_same_stem_audio() {
        let root = temp_signature_dir();
        fs::create_dir_all(&root).expect("temp signature directory");
        let audio_path = root.join("song.FLAC");
        let lrc_path = root.join("song.lrc");
        fs::write(&audio_path, b"audio").expect("write audio file");
        fs::write(&lrc_path, "[00:01.00]Line").expect("write lrc file");

        assert_eq!(matching_audio_path_for_lrc(&lrc_path), Some(audio_path));

        fs::remove_dir_all(&root).expect("cleanup temp signature directory");
    }

    #[test]
    fn imported_directory_path_uses_canonical_path_when_available() {
        let root = temp_signature_dir();
        fs::create_dir_all(&root).expect("temp signature directory");

        assert_eq!(
            imported_directory_path(&root),
            root.canonicalize()
                .expect("canonical temp signature directory")
                .to_string_lossy()
        );

        fs::remove_dir_all(&root).expect("cleanup temp signature directory");
    }

    #[test]
    fn import_lrc_sidecar_file_reports_import_and_failures() {
        let root = temp_signature_dir();
        fs::create_dir_all(&root).expect("temp signature directory");
        let audio_path = root.join("matched.wav");
        let lrc_path = root.join("matched.lrc");
        let unmatched_path = root.join("orphan.lrc");
        let invalid_path = root.join("invalid.lrc");
        fs::write(&audio_path, b"audio").expect("write audio file");
        fs::write(&lrc_path, "[00:01.00]Line").expect("write valid lrc file");
        fs::write(&unmatched_path, "[00:01.00]Orphan").expect("write unmatched lrc file");
        fs::write(&invalid_path, "No timestamps here").expect("write invalid lrc file");

        let mut result = ScanResult::default();
        import_lrc_sidecar_file(&lrc_path, &mut result).expect("valid lrc import");
        import_lrc_sidecar_file(&unmatched_path, &mut result).expect("unmatched lrc import");
        import_lrc_sidecar_file(&invalid_path, &mut result).expect("invalid lrc import");

        assert_eq!(result.imported_lyrics, 1);
        assert_eq!(result.failed, 2);
        assert!(result
            .failures
            .iter()
            .any(|failure| failure.reason.contains("No same-name audio file")));
        assert!(result.failures.iter().any(|failure| failure
            .reason
            .contains("LRC must contain at least one timestamp")));

        fs::remove_dir_all(&root).expect("cleanup temp signature directory");
    }
}
