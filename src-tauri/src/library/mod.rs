//! Local music library scanning and persistence.

pub mod db;
pub mod metadata;
pub mod scanner;

pub use db::Database;
pub use scanner::{scan_directory, ScanResult};
