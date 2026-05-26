//! Lightweight file metadata extraction for library scans.

use std::fs;
use std::path::Path;
use std::time::{Duration, UNIX_EPOCH};

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::{Accessor, ItemKey, Tag};
use thiserror::Error;

use crate::cover::{cache_embedded_cover, embedded_cover_exists, CoverCacheError};
use crate::types::Track;

/// Audio extensions supported by the Melodist scanner.
pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "aiff", "ape", "wv",
];

/// Returns true when a path has a supported audio extension.
pub fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|supported| supported.eq_ignore_ascii_case(extension))
        })
        .unwrap_or(false)
}

/// Creates a stable track id from a canonical path string.
pub fn track_id_for_path(path: &Path) -> String {
    blake3::hash(path.to_string_lossy().as_bytes())
        .to_hex()
        .to_string()
}

/// Metadata errors returned while reading an audio file.
#[derive(Debug, Error)]
pub enum MetadataError {
    /// Filesystem metadata could not be read.
    #[error("filesystem error: {0}")]
    Filesystem(#[from] std::io::Error),
    /// Audio metadata could not be parsed.
    #[error("tag read error: {0}")]
    TagRead(#[from] lofty::error::LoftyError),
    /// Embedded cover art could not be cached.
    #[error("cover cache error: {0}")]
    CoverCache(#[from] CoverCacheError),
}

struct InferredMetadata {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
}

/// Reads basic filesystem metadata and derives a track record.
pub fn read_track_from_path(path: &Path) -> Result<Track, MetadataError> {
    read_track_from_path_with_cover_cache(path, None)
}

/// Reads filesystem metadata and caches embedded cover art when a cache directory is provided.
pub fn read_track_from_path_with_cover_cache(
    path: &Path,
    cover_cache_dir: Option<&Path>,
) -> Result<Track, MetadataError> {
    let canonical_path = path.canonicalize()?;
    let metadata = fs::metadata(&canonical_path)?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| i64::try_from(duration.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0);
    let inferred = infer_metadata_from_path(&canonical_path);
    let tagged_file = lofty::read_from_path(&canonical_path)?;
    let properties = tagged_file.properties();
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let track_id = track_id_for_path(&canonical_path);
    let cached_cover = cover_cache_dir
        .map(|cache_dir| cache_embedded_cover(&tagged_file, &track_id, cache_dir))
        .transpose()?
        .flatten();
    let cover_cache_path = cached_cover.map(|cover| cover.path.to_string_lossy().to_string());
    let has_cover = cover_cache_path.is_some() || embedded_cover_exists(&tagged_file);

    Ok(Track {
        id: track_id,
        path: canonical_path.to_string_lossy().to_string(),
        title: tag
            .and_then(|tag| clean_optional_text(tag.title()))
            .or(inferred.title),
        artist: tag
            .and_then(|tag| clean_optional_text(tag.artist()))
            .or_else(|| inferred.artist.clone()),
        album: tag
            .and_then(|tag| clean_optional_text(tag.album()))
            .or(inferred.album),
        album_artist: tag.and_then(album_artist).or(inferred.artist),
        track_number: tag.and_then(Accessor::track),
        disc_number: tag.and_then(Accessor::disk),
        year: tag.and_then(Accessor::year),
        genre: tag.and_then(|tag| clean_optional_text(tag.genre())),
        duration_ms: duration_to_millis(properties.duration()),
        sample_rate: properties.sample_rate().unwrap_or(0),
        bit_depth: properties.bit_depth().map(u32::from),
        bitrate: properties
            .audio_bitrate()
            .map(|kbps| kbps.saturating_mul(1_000)),
        file_size: metadata.len(),
        has_cover,
        cover_cache_path,
        date_added: modified,
        date_modified: modified,
        play_count: 0,
        last_played: None,
    })
}

fn infer_metadata_from_path(path: &Path) -> InferredMetadata {
    let title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(clean_title)
        .filter(|value| !value.is_empty());
    let album = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .map(clean_directory_name);
    let artist = path
        .parent()
        .and_then(Path::parent)
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .map(clean_directory_name);

    InferredMetadata {
        title,
        artist,
        album,
    }
}

fn clean_optional_text(text: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    text.map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn album_artist(tag: &Tag) -> Option<String> {
    tag.get_string(&ItemKey::AlbumArtist)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn duration_to_millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

fn clean_directory_name(name: &str) -> String {
    name.trim().to_string()
}

fn clean_title(stem: &str) -> String {
    let trimmed = stem.trim();
    let digit_prefix_len = trimmed
        .char_indices()
        .take_while(|(_, character)| character.is_ascii_digit())
        .map(|(index, character)| index + character.len_utf8())
        .last()
        .unwrap_or(0);

    if digit_prefix_len == 0 || digit_prefix_len > 3 {
        return trimmed.to_string();
    }

    let mut trim_index = digit_prefix_len;
    let remainder = &trimmed[trim_index..];
    let separator_index = remainder
        .char_indices()
        .find(|(_, character)| !character.is_whitespace())
        .map(|(index, _)| index)
        .unwrap_or(remainder.len());
    trim_index += separator_index;

    if let Some(separator) = trimmed[trim_index..].chars().next() {
        if matches!(separator, '-' | '_' | '.' | '–' | '—') {
            trim_index += separator.len_utf8();
        }
    }

    let cleaned = trimmed[trim_index..].trim();
    if cleaned.is_empty() {
        trimmed.to_string()
    } else {
        cleaned.to_string()
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        clean_optional_text, clean_title, is_supported_audio_file, read_track_from_path,
        track_id_for_path,
    };

    #[test]
    fn detects_supported_audio_extensions_case_insensitively() {
        assert!(is_supported_audio_file(Path::new("Song.FLAC")));
        assert!(is_supported_audio_file(Path::new("mix.OpUs")));
        assert!(!is_supported_audio_file(Path::new("cover.jpg")));
    }

    #[test]
    fn creates_stable_track_ids_from_paths() {
        let path = Path::new("/music/album/song.flac");
        assert_eq!(track_id_for_path(path), track_id_for_path(path));
        assert_ne!(
            track_id_for_path(path),
            track_id_for_path(Path::new("/music/album/other.flac"))
        );
    }

    #[test]
    fn removes_blank_tag_values() {
        assert_eq!(
            clean_optional_text(Some("  Title  ".into())),
            Some("Title".to_string())
        );
        assert_eq!(clean_optional_text(Some("   ".into())), None);
        assert_eq!(clean_optional_text(None), None);
    }

    #[test]
    fn cleans_common_track_number_prefixes_from_titles() {
        assert_eq!(clean_title("01 Night Drive"), "Night Drive");
        assert_eq!(clean_title("01 - Night Drive"), "Night Drive");
        assert_eq!(clean_title("7_Signal Bloom"), "Signal Bloom");
        assert_eq!(clean_title("2026 Remaster"), "2026 Remaster");
    }

    #[test]
    fn reads_minimal_wav_metadata() {
        let root = temp_audio_dir();
        fs::create_dir_all(&root).expect("temp audio directory");
        let path = root.join("01 Synthetic.wav");
        write_test_wav(&path);

        let track = read_track_from_path(&path).expect("wav metadata should read");

        assert_eq!(track.title.as_deref(), Some("Synthetic"));
        assert_eq!(track.sample_rate, 44_100);
        assert!(track.duration_ms >= 900);
        assert!(track.duration_ms <= 1_100);
        fs::remove_dir_all(&root).expect("cleanup temp audio directory");
    }

    #[test]
    fn infers_missing_artist_and_album_from_folders() {
        let root = temp_audio_dir();
        let album_dir = root.join("夜行者").join("霓虹档案");
        fs::create_dir_all(&album_dir).expect("nested audio directory");
        let path = album_dir.join("02 - 紫色信号.wav");
        write_test_wav(&path);

        let track = read_track_from_path(&path).expect("wav metadata should read");

        assert_eq!(track.title.as_deref(), Some("紫色信号"));
        assert_eq!(track.artist.as_deref(), Some("夜行者"));
        assert_eq!(track.album.as_deref(), Some("霓虹档案"));
        assert_eq!(track.album_artist.as_deref(), Some("夜行者"));
        fs::remove_dir_all(&root).expect("cleanup temp audio directory");
    }

    fn temp_audio_dir() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "melodist-metadata-test-{}-{suffix}",
            std::process::id()
        ))
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
