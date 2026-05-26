//! Serializable types shared by Tauri commands and the frontend.

use serde::{Deserialize, Serialize};

fn default_volume() -> f32 {
    0.72
}

fn default_app_language() -> String {
    "en".to_string()
}

fn default_playback_position_ms() -> u64 {
    0
}

fn default_whisper_model() -> String {
    "base".to_string()
}

fn default_translation_target_language() -> String {
    "zh-CN".to_string()
}

fn default_lyrics_display_mode() -> String {
    "original".to_string()
}

fn default_playback_repeat() -> String {
    "none".to_string()
}

fn default_replay_gain_enabled() -> bool {
    true
}

/// Playback status serialized to the frontend.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayStatus {
    /// No track is loaded.
    Stopped,
    /// A track is being prepared for playback.
    Loading,
    /// Playback is active.
    Playing,
    /// Playback is paused.
    Paused,
}

/// Repeat behavior for the play queue.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RepeatMode {
    /// Do not repeat.
    None,
    /// Repeat the current track.
    One,
    /// Repeat the queue.
    All,
}

/// Player state returned by the mock player IPC command.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    /// Current playback status.
    pub status: PlayStatus,
    /// Current track identifier or path.
    pub current_track: Option<String>,
    /// Current playback position in milliseconds.
    pub position_ms: u64,
    /// Current track duration in milliseconds.
    pub duration_ms: u64,
    /// Output volume in the inclusive range 0.0 to 1.0.
    pub volume: f32,
    /// Whether shuffle mode is enabled.
    pub shuffle: bool,
    /// Current repeat mode.
    pub repeat: RepeatMode,
}

/// Audio output device option exposed to the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputDevice {
    /// Device identifier used by the MVP. Currently the system device name.
    pub id: String,
    /// Human-readable device name.
    pub name: String,
    /// Whether this is the system default output device.
    pub is_default: bool,
}

/// Track metadata shape shared with the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    /// Stable track identifier.
    pub id: String,
    /// Source file path.
    pub path: String,
    /// Track title.
    pub title: Option<String>,
    /// Track artist.
    pub artist: Option<String>,
    /// Album name.
    pub album: Option<String>,
    /// Album artist name.
    pub album_artist: Option<String>,
    /// Track number within the disc.
    pub track_number: Option<u32>,
    /// Disc number within the album.
    pub disc_number: Option<u32>,
    /// Release year.
    pub year: Option<u32>,
    /// Genre tag.
    pub genre: Option<String>,
    /// Duration in milliseconds.
    pub duration_ms: u64,
    /// Sample rate in hertz.
    pub sample_rate: u32,
    /// Bit depth when known.
    pub bit_depth: Option<u32>,
    /// Bitrate when known.
    pub bitrate: Option<u32>,
    /// File size in bytes.
    pub file_size: u64,
    /// Whether embedded or cached cover art is available.
    pub has_cover: bool,
    /// Cached cover art path when available.
    pub cover_cache_path: Option<String>,
    /// Unix timestamp when the track was added.
    pub date_added: i64,
    /// Unix timestamp when the source file was last modified.
    pub date_modified: i64,
    /// Number of times the track has been played.
    pub play_count: u32,
    /// Unix timestamp for last playback.
    pub last_played: Option<i64>,
}

/// Album summary shared with the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    /// Album name.
    pub name: String,
    /// Album artist.
    pub artist: Option<String>,
    /// Release year.
    pub year: Option<u32>,
    /// Number of tracks in the album.
    pub track_count: u32,
    /// Cached cover art path when available.
    pub cover_cache_path: Option<String>,
    /// Tracks belonging to the album.
    pub tracks: Vec<Track>,
}

/// Lyrics payload shared with the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsData {
    /// Source of the lyrics.
    pub source: LyricsSource,
    /// Timestamped lyric lines.
    pub lines: Vec<LrcLine>,
    /// Whether a cached translation exists.
    pub has_translation: bool,
    /// Translation language when available.
    pub translation_language: Option<String>,
}

/// Source kind for lyrics data.
#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LyricsSource {
    /// Lyrics read from embedded tags.
    Embedded,
    /// Lyrics read from an LRC sidecar file.
    LrcFile,
    /// Lyrics generated locally.
    Generated,
    /// Lyrics entered or imported manually.
    Manual,
}

/// One timestamped LRC line.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LrcLine {
    /// Line timestamp in milliseconds.
    pub timestamp_ms: u64,
    /// Original lyric text.
    pub text: String,
    /// Translated lyric text when available.
    pub translated_text: Option<String>,
    /// Word-level timestamps for extended LRC.
    pub word_timestamps: Option<Vec<WordTimestamp>>,
}

/// Word-level timestamp for extended LRC.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTimestamp {
    /// Word timestamp in milliseconds.
    pub timestamp_ms: u64,
    /// Word text.
    pub word: String,
}

/// Library scan progress event payload.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    /// Number of supported audio files processed so far.
    pub scanned: u32,
    /// Total supported audio files discovered before metadata extraction.
    pub total: u32,
    /// Current file path being processed.
    pub current_file: String,
}

/// User-configurable OpenAI-compatible translation provider.
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationProvider {
    /// Provider base URL.
    pub base_url: String,
    /// User-supplied API key.
    pub api_key: String,
    /// Provider model identifier.
    pub model: String,
}

/// Persistent application settings.
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// User interface language.
    #[serde(default = "default_app_language")]
    pub app_language: String,
    /// Local music directories selected by the user.
    #[serde(default)]
    pub music_directories: Vec<String>,
    /// Preferred local Whisper model.
    #[serde(default = "default_whisper_model")]
    pub whisper_model: String,
    /// Optional translation provider.
    #[serde(default)]
    pub translation_provider: Option<TranslationProvider>,
    /// Target language for translations.
    #[serde(default = "default_translation_target_language")]
    pub translation_target_language: String,
    /// Lyrics display mode.
    #[serde(default = "default_lyrics_display_mode")]
    pub lyrics_display_mode: String,
    /// User-calibrated lyric timestamp offset in milliseconds.
    #[serde(default)]
    pub lyrics_offset_ms: i64,
    /// Preferred audio output device.
    #[serde(default)]
    pub audio_output_device: Option<String>,
    /// Last selected playback volume in the inclusive range 0.0 to 1.0.
    #[serde(default = "default_volume")]
    pub volume: f32,
    /// Persisted queue paths for session restore.
    #[serde(default)]
    pub playback_queue_paths: Vec<String>,
    /// Persisted queue index for session restore.
    #[serde(default)]
    pub playback_queue_index: Option<usize>,
    /// Persisted playback position for session restore.
    #[serde(default = "default_playback_position_ms")]
    pub playback_position_ms: u64,
    /// Persisted shuffle state for session restore.
    #[serde(default)]
    pub playback_shuffle: bool,
    /// Persisted repeat state for session restore.
    #[serde(default = "default_playback_repeat")]
    pub playback_repeat: String,
    /// Whether ReplayGain normalization is enabled.
    #[serde(default = "default_replay_gain_enabled")]
    pub replay_gain_enabled: bool,
    /// Whether optional network cover fallback is enabled.
    #[serde(default)]
    pub cover_art_fallback_enabled: bool,
    /// Whether optional network metadata enrichment is enabled.
    #[serde(default)]
    pub metadata_network_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            app_language: default_app_language(),
            music_directories: Vec::new(),
            whisper_model: "base".to_string(),
            translation_provider: None,
            translation_target_language: "zh-CN".to_string(),
            lyrics_display_mode: "original".to_string(),
            lyrics_offset_ms: 0,
            audio_output_device: None,
            volume: default_volume(),
            playback_queue_paths: Vec::new(),
            playback_queue_index: None,
            playback_position_ms: default_playback_position_ms(),
            playback_shuffle: false,
            playback_repeat: default_playback_repeat(),
            replay_gain_enabled: default_replay_gain_enabled(),
            cover_art_fallback_enabled: false,
            metadata_network_enabled: false,
        }
    }
}

/// Local data paths exposed in the privacy settings UI.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocations {
    /// OS-standard application data directory.
    pub app_data_dir: String,
    /// Tauri Store settings JSON file path.
    pub settings_path: String,
    /// SQLite library database path.
    pub library_database_path: String,
    /// Extracted album art cache directory.
    pub cover_cache_dir: String,
}

#[cfg(test)]
mod tests {
    use super::AppSettings;

    #[test]
    fn settings_from_legacy_json_default_missing_volume() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
                "musicDirectories": [],
                "whisperModel": "base",
                "translationProvider": null,
                "translationTargetLanguage": "zh-CN",
                "lyricsDisplayMode": "original",
                "audioOutputDevice": null,
                "replayGainEnabled": true,
                "coverArtFallbackEnabled": false,
                "metadataNetworkEnabled": false
            }"#,
        )
        .expect("legacy settings deserialize");

        assert_eq!(settings.volume, 0.72);
        assert_eq!(settings.app_language, "en");
        assert!(!settings.playback_shuffle);
        assert_eq!(settings.playback_repeat, "none");
    }
}
