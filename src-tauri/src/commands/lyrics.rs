use std::fs;
use std::path::{Path, PathBuf};

use lofty::file::{TaggedFile, TaggedFileExt};
use lofty::tag::{ItemKey, ItemValue, Tag};
use tauri::{AppHandle, Manager};
use tokio::task;

use crate::library::db::Database;
use crate::lyrics::{parse_lrc, write_lrc};
use crate::types::{LrcLine, LyricsData, LyricsSource};

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;
    Ok(app_data_dir.join("library.sqlite3"))
}

/// Loads lyrics for a track in the local library.
#[tauri::command]
pub async fn load_lyrics(app: AppHandle, track_id: String) -> Result<Option<LyricsData>, String> {
    if track_id.trim().is_empty() {
        return Err("Track id cannot be empty".to_string());
    }

    let database_path = database_path(&app)?;
    task::spawn_blocking(move || {
        let database = Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        let Some(track) = database
            .track_by_id(&track_id)
            .map_err(|error| format!("Failed to load track for lyrics: {error}"))?
        else {
            return Ok(None);
        };

        let track_path = PathBuf::from(track.path);
        let embedded_lines = load_embedded_lyrics(&track_path)?;
        if let Some(lines) = embedded_lines {
            return Ok(Some(lyrics_data(LyricsSource::Embedded, lines)));
        }

        let lrc_path = track_path.with_extension("lrc");
        let lrc_lines = load_lrc_file(&lrc_path)?;
        Ok(lrc_lines.map(|lines| lyrics_data(LyricsSource::LrcFile, lines)))
    })
    .await
    .map_err(|error| format!("Lyrics load task failed: {error}"))?
}

/// Saves same-name sidecar LRC lyrics for a library track.
#[tauri::command]
pub async fn save_lrc(
    app: AppHandle,
    track_id: String,
    contents: String,
) -> Result<LyricsData, String> {
    if track_id.trim().is_empty() {
        return Err("Track id cannot be empty".to_string());
    }
    if contents.trim().is_empty() {
        return Err("LRC contents cannot be empty".to_string());
    }

    let database_path = database_path(&app)?;
    task::spawn_blocking(move || {
        let lines =
            parse_lrc(&contents).map_err(|error| format!("Failed to parse LRC: {error}"))?;
        if lines.is_empty() {
            return Err("LRC must contain at least one timestamped lyric line".to_string());
        }

        let database = Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        let Some(track) = database
            .track_by_id(&track_id)
            .map_err(|error| format!("Failed to load track for lyrics: {error}"))?
        else {
            return Err("Track was not found in the local library".to_string());
        };

        let lrc_path = PathBuf::from(track.path).with_extension("lrc");
        fs::write(&lrc_path, write_lrc(&lines))
            .map_err(|error| format!("Failed to write LRC file {}: {error}", lrc_path.display()))?;
        Ok(lyrics_data(LyricsSource::LrcFile, lines))
    })
    .await
    .map_err(|error| format!("Lyrics save task failed: {error}"))?
}

fn lyrics_data(source: LyricsSource, lines: Vec<LrcLine>) -> LyricsData {
    LyricsData {
        source,
        lines,
        has_translation: false,
        translation_language: None,
    }
}

fn load_lrc_file(path: &Path) -> Result<Option<Vec<LrcLine>>, String> {
    if !path.is_file() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read LRC file {}: {error}", path.display()))?;
    let lines = parse_lrc(&contents)
        .map_err(|error| format!("Failed to parse LRC file {}: {error}", path.display()))?;
    Ok(Some(lines))
}

fn load_embedded_lyrics(path: &Path) -> Result<Option<Vec<LrcLine>>, String> {
    let tagged_file =
        lofty::read_from_path(path).map_err(|error| format!("Failed to read tags: {error}"))?;
    let Some(text) = embedded_lyrics_text(&tagged_file) else {
        return Ok(None);
    };

    match parse_lrc(&text) {
        Ok(lines) if !lines.is_empty() => Ok(Some(lines)),
        Ok(_) | Err(_) => Ok(Some(plain_lyrics_to_lines(&text))),
    }
}

fn embedded_lyrics_text(tagged_file: &TaggedFile) -> Option<String> {
    tagged_file.tags().iter().find_map(lyrics_text_from_tag)
}

fn lyrics_text_from_tag(tag: &Tag) -> Option<String> {
    if let Some(text) = tag.get_string(&ItemKey::Lyrics).and_then(clean_lyrics_text) {
        return Some(text);
    }

    tag.items().find_map(|item| {
        let key_name = item
            .key()
            .map_key(tag.tag_type(), true)
            .or_else(|| match item.key() {
                ItemKey::Unknown(unknown) => Some(unknown.as_str()),
                _ => None,
            })
            .unwrap_or_default();

        if !is_lyrics_item_key(key_name, item.description()) {
            return None;
        }

        match item.value() {
            ItemValue::Text(text) | ItemValue::Locator(text) => clean_lyrics_text(text),
            ItemValue::Binary(_) => None,
        }
    })
}

fn clean_lyrics_text(text: &str) -> Option<String> {
    let trimmed = text.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn is_lyrics_item_key(key: &str, description: &str) -> bool {
    let key = key.to_ascii_lowercase();
    let description = description.to_ascii_lowercase();
    matches!(
        key.as_str(),
        "lyrics" | "uslt" | "unsyncedlyrics" | "unsynchronizedlyrics" | "unsynchronisedlyrics"
    ) || key.starts_with("lyrics-")
        || key.starts_with("lyrics_")
        || (key == "txxx" && description.contains("lyrics"))
}

fn plain_lyrics_to_lines(text: &str) -> Vec<LrcLine> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| LrcLine {
            timestamp_ms: 0,
            text: line.to_string(),
            translated_text: None,
            word_timestamps: None,
        })
        .collect()
}

/// Reports that local AI lyrics generation is outside the v0.1.0 build.
#[tauri::command]
pub async fn generate_lyrics(track_id: String, model: String) -> Result<(), String> {
    if track_id.trim().is_empty() || model.trim().is_empty() {
        return Err("Track id and model are required".to_string());
    }
    Err("AI lyrics generation is planned for v0.2.0 and is not enabled in this build".to_string())
}

/// Reports that lyrics translation is outside the v0.1.0 build.
#[tauri::command]
pub async fn translate_lyrics(track_id: String, target_lang: String) -> Result<(), String> {
    if track_id.trim().is_empty() || target_lang.trim().is_empty() {
        return Err("Track id and target language are required".to_string());
    }
    Err("Lyrics translation is planned for v0.2.0 and is not enabled in this build".to_string())
}

#[cfg(test)]
mod tests {
    use lofty::tag::{ItemKey, ItemValue, Tag, TagItem, TagType};

    use super::{is_lyrics_item_key, lyrics_data, lyrics_text_from_tag, plain_lyrics_to_lines};
    use crate::types::LyricsSource;

    #[test]
    fn plain_lyrics_keep_non_empty_lines_without_timestamps() {
        let lines = plain_lyrics_to_lines(" First line \n\nSecond line");

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].timestamp_ms, 0);
        assert_eq!(lines[0].text, "First line");
        assert_eq!(lines[1].text, "Second line");
    }

    #[test]
    fn detects_common_custom_lyrics_keys() {
        assert!(is_lyrics_item_key("lyrics-eng", ""));
        assert!(is_lyrics_item_key("UNSYNCEDLYRICS", ""));
        assert!(is_lyrics_item_key("TXXX", "Lyrics"));
        assert!(!is_lyrics_item_key("lyricist", ""));
    }

    #[test]
    fn reads_custom_lyrics_tag_item() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.insert_unchecked(TagItem::new(
            ItemKey::Unknown("lyrics-eng".to_string()),
            ItemValue::Text("First line\nSecond line".to_string()),
        ));

        assert_eq!(
            lyrics_text_from_tag(&tag).as_deref(),
            Some("First line\nSecond line"),
        );
    }

    #[test]
    fn lyrics_data_can_report_embedded_source_for_priority_chain() {
        let lines = plain_lyrics_to_lines("Embedded wins");
        let data = lyrics_data(LyricsSource::Embedded, lines);

        assert!(matches!(data.source, LyricsSource::Embedded));
        assert_eq!(data.lines[0].text, "Embedded wins");
    }
}
