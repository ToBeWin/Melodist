//! Recursive directory scanner for the local music library.

use std::collections::HashSet;
use std::path::Path;

use thiserror::Error;
use walkdir::WalkDir;

use crate::library::db::Database;
use crate::library::metadata::{is_supported_audio_file, read_track_from_path_with_cover_cache};
use crate::types::ScanProgress;

/// A supported audio file that could not be imported during a scan.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFailure {
    /// Source file path that failed metadata extraction.
    pub path: String,
    /// Human-readable failure reason.
    pub reason: String,
}

/// Summary returned after a library scan.
#[derive(Debug, Default, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    /// Number of newly added tracks.
    pub added: u32,
    /// Number of updated tracks.
    pub updated: u32,
    /// Number of removed tracks.
    pub removed: u32,
    /// Number of supported files that could not be imported.
    pub failed: u32,
    /// Number of timestamped LRC sidecar files imported.
    pub imported_lyrics: u32,
    /// First few failed files for UI diagnostics.
    pub failures: Vec<ScanFailure>,
    /// Music directories imported or scanned by this operation.
    pub imported_directories: Vec<String>,
}

/// Errors that can happen during a library scan.
#[derive(Debug, Error)]
pub enum ScanError {
    /// Database operation failed.
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    /// Filesystem walk failed.
    #[error("walkdir error: {0}")]
    Walkdir(#[from] walkdir::Error),
    /// Filesystem metadata failed.
    #[error("filesystem error: {0}")]
    Filesystem(#[from] std::io::Error),
}

/// Scans a directory recursively and upserts supported audio files into SQLite.
pub fn scan_directory(path: &Path, database: &Database) -> Result<ScanResult, ScanError> {
    scan_directory_with_progress(path, database, None, |_| {})
}

/// Scans a directory recursively and reports progress after every 50 tracks.
pub fn scan_directory_with_progress<F>(
    path: &Path,
    database: &Database,
    cover_cache_dir: Option<&Path>,
    mut on_progress: F,
) -> Result<ScanResult, ScanError>
where
    F: FnMut(ScanProgress),
{
    let canonical_root = path.canonicalize()?;
    let mut files = Vec::new();
    for entry in WalkDir::new(path).follow_links(false).max_depth(20) {
        let entry = entry?;
        let file_path = entry.path();
        if entry.file_type().is_file() && is_supported_audio_file(file_path) {
            files.push(file_path.to_path_buf());
        }
    }

    let total = u32::try_from(files.len()).unwrap_or(u32::MAX);
    let mut result = ScanResult::default();
    let mut discovered_paths = HashSet::<String>::new();
    for (index, file_path) in files.iter().enumerate() {
        if let Ok(canonical_path) = file_path.canonicalize() {
            discovered_paths.insert(canonical_path.to_string_lossy().to_string());
        }

        match read_track_from_path_with_cover_cache(file_path, cover_cache_dir) {
            Ok(track) => {
                discovered_paths.insert(track.path.clone());
                let existed = database.track_exists_by_path(&track.path)?;
                database.upsert_track(&track)?;
                if existed {
                    result.updated += 1;
                } else {
                    result.added += 1;
                }
            }
            Err(error) => {
                result.failed += 1;
                if result.failures.len() < 12 {
                    result.failures.push(ScanFailure {
                        path: file_path.to_string_lossy().to_string(),
                        reason: error.to_string(),
                    });
                }
            }
        }

        let scanned = u32::try_from(index + 1).unwrap_or(u32::MAX);
        if scanned % 50 == 0 || scanned == total {
            on_progress(ScanProgress {
                scanned,
                total,
                current_file: file_path.to_string_lossy().to_string(),
            });
        }
    }

    for stored_path in database.track_paths()? {
        if Path::new(&stored_path).starts_with(&canonical_root)
            && !discovered_paths.contains(&stored_path)
            && database.remove_track_by_path(&stored_path)?
        {
            result.removed += 1;
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::library::db::Database;
    use crate::library::metadata::track_id_for_path;
    use crate::types::Track;

    use super::scan_directory;

    static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_scan_dir() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "melodist-scanner-test-{}-{suffix}-{counter}",
            std::process::id()
        ))
    }

    fn track(path: &Path) -> Track {
        Track {
            id: track_id_for_path(path),
            path: path.to_string_lossy().to_string(),
            title: Some("Stale".to_string()),
            artist: None,
            album: None,
            album_artist: None,
            track_number: None,
            disc_number: None,
            year: None,
            genre: None,
            duration_ms: 0,
            sample_rate: 0,
            bit_depth: None,
            bitrate: None,
            file_size: 0,
            has_cover: false,
            cover_cache_path: None,
            date_added: 1,
            date_modified: 1,
            play_count: 0,
            last_played: None,
        }
    }

    #[test]
    fn scan_removes_missing_tracks_under_scanned_directory() {
        let root = temp_scan_dir();
        fs::create_dir_all(&root).expect("temp scan directory");
        let canonical_root = root.canonicalize().expect("canonical temp scan directory");
        let stale_path = canonical_root.join("removed.flac");
        let database = Database::open_in_memory().expect("database opens");
        database
            .upsert_track(&track(&stale_path))
            .expect("insert stale track");

        let result = scan_directory(&root, &database).expect("scan empty directory");

        assert_eq!(result.removed, 1);
        assert!(database.all_tracks().expect("tracks").is_empty());
        fs::remove_dir_all(&root).expect("cleanup temp scan directory");
    }

    #[test]
    fn scan_adds_nested_unicode_wav_tracks() {
        let root = temp_scan_dir();
        let nested = root.join("夜行者").join("霓虹档案");
        fs::create_dir_all(&nested).expect("nested unicode directory");
        write_test_wav(&nested.join("01 城市低鸣.wav"));
        write_test_wav(&root.join("02 Local First.wav"));
        fs::write(root.join("cover.jpg"), b"not audio").expect("write ignored file");
        let database = Database::open_in_memory().expect("database opens");

        let result = scan_directory(&root, &database).expect("scan smoke library");
        let tracks = database.all_tracks().expect("tracks load");

        assert_eq!(result.added, 2);
        assert_eq!(result.updated, 0);
        assert_eq!(tracks.len(), 2);
        assert!(tracks.iter().any(
            |track| track.path.contains("夜行者") && track.title.as_deref() == Some("城市低鸣")
        ));
        assert!(tracks.iter().all(|track| track.sample_rate == 44_100));
        fs::remove_dir_all(&root).expect("cleanup temp scan directory");
    }

    fn write_test_wav(path: &Path) {
        let sample_rate = 44_100_u32;
        let channels = 1_u16;
        let bits_per_sample = 16_u16;
        let sample_count = sample_rate;
        let data_size = sample_count * u32::from(channels) * u32::from(bits_per_sample / 8);
        let byte_rate = sample_rate * u32::from(channels) * u32::from(bits_per_sample / 8);
        let block_align = channels * (bits_per_sample / 8);
        let mut bytes = Vec::new();

        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data_size).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16_u32.to_le_bytes());
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&channels.to_le_bytes());
        bytes.extend_from_slice(&sample_rate.to_le_bytes());
        bytes.extend_from_slice(&byte_rate.to_le_bytes());
        bytes.extend_from_slice(&block_align.to_le_bytes());
        bytes.extend_from_slice(&bits_per_sample.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_size.to_le_bytes());
        bytes.resize(bytes.len() + data_size as usize, 0);

        fs::write(path, bytes).expect("write synthetic wav");
    }
}
