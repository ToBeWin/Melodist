//! Lyrics parsing and serialization helpers.

/// LRC parsing and writing.
pub mod lrc;

pub use lrc::{parse_lrc, write_lrc, LrcParseError};
