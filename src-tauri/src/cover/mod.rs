//! Embedded cover art extraction and local cache helpers.

mod extractor;

pub use extractor::{cache_embedded_cover, embedded_cover_exists, CachedCover, CoverCacheError};
