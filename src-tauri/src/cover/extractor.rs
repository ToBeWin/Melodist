//! Extraction of embedded audio cover art into the local app cache.

use std::fs;
use std::path::{Path, PathBuf};

use lofty::file::{TaggedFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture};
use thiserror::Error;

/// Result of writing embedded cover art into the cache.
#[derive(Debug, Clone)]
pub struct CachedCover {
    /// Absolute filesystem path to the cached cover image.
    pub path: PathBuf,
}

/// Errors returned while caching embedded cover art.
#[derive(Debug, Error)]
pub enum CoverCacheError {
    /// The cover cache directory or file could not be written.
    #[error("cover cache filesystem error: {0}")]
    Filesystem(#[from] std::io::Error),
}

/// Returns true when a tagged file contains at least one embedded picture.
pub fn embedded_cover_exists(tagged_file: &TaggedFile) -> bool {
    first_picture(tagged_file).is_some()
}

/// Caches the first embedded picture in a tagged file using the stable track id as filename.
pub fn cache_embedded_cover(
    tagged_file: &TaggedFile,
    track_id: &str,
    cache_dir: &Path,
) -> Result<Option<CachedCover>, CoverCacheError> {
    let Some(picture) = first_picture(tagged_file) else {
        return Ok(None);
    };

    fs::create_dir_all(cache_dir)?;
    let extension = extension_for_picture(picture);
    let cache_path = cache_dir.join(format!("{track_id}.{extension}"));
    fs::write(&cache_path, picture.data())?;
    remove_stale_cover_variants(cache_dir, track_id, extension);

    Ok(Some(CachedCover { path: cache_path }))
}

fn first_picture(tagged_file: &TaggedFile) -> Option<&Picture> {
    tagged_file
        .tags()
        .iter()
        .find_map(|tag| tag.pictures().first())
}

fn extension_for_picture(picture: &Picture) -> &'static str {
    match picture.mime_type() {
        Some(MimeType::Jpeg) => "jpg",
        Some(MimeType::Png) => "png",
        Some(MimeType::Unknown(value)) if value.eq_ignore_ascii_case("image/webp") => "webp",
        _ => extension_from_signature(picture.data()).unwrap_or("jpg"),
    }
}

fn extension_from_signature(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("jpg");
    }

    if data.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("png");
    }

    if data.len() >= 12 && &data[..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return Some("webp");
    }

    None
}

fn remove_stale_cover_variants(cache_dir: &Path, track_id: &str, kept_extension: &str) {
    for extension in ["jpg", "png", "webp"] {
        if extension != kept_extension {
            let _ = fs::remove_file(cache_dir.join(format!("{track_id}.{extension}")));
        }
    }
}

#[cfg(test)]
mod tests {
    use lofty::picture::{MimeType, Picture, PictureType};

    use super::extension_for_picture;

    #[test]
    fn uses_mime_type_for_common_extensions() {
        let jpeg = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Jpeg),
            None,
            vec![0xFF, 0xD8, 0xFF, 0xE0],
        );
        let png = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Png),
            None,
            vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A],
        );

        assert_eq!(extension_for_picture(&jpeg), "jpg");
        assert_eq!(extension_for_picture(&png), "png");
    }

    #[test]
    fn detects_webp_when_lofty_reports_unknown() {
        let webp = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Unknown("image/webp".to_string())),
            None,
            b"RIFFxxxxWEBP".to_vec(),
        );

        assert_eq!(extension_for_picture(&webp), "webp");
    }

    #[test]
    fn falls_back_to_jpg_for_unknown_data() {
        let unknown =
            Picture::new_unchecked(PictureType::CoverFront, None, None, b"unknown".to_vec());

        assert_eq!(extension_for_picture(&unknown), "jpg");
    }
}
