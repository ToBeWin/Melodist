//! Shared application state for the Tauri shell.

use std::collections::HashSet;
use std::path::PathBuf;

use parking_lot::{Mutex, RwLock};

use crate::audio::{AudioEngine, AudioOutput};

/// Shared application state registered with Tauri.
pub struct AppState {
    /// Mutable audio playback engine.
    pub audio: Mutex<AudioEngine>,
    /// Dedicated audio output worker.
    pub output: AudioOutput,
    /// Directories already registered for lightweight library change polling.
    pub watched_directories: Mutex<HashSet<PathBuf>>,
    /// Whether ReplayGain tags should be applied during playback.
    pub replay_gain_enabled: RwLock<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            audio: Mutex::new(AudioEngine::default()),
            output: AudioOutput::default(),
            watched_directories: Mutex::new(HashSet::new()),
            replay_gain_enabled: RwLock::new(true),
        }
    }
}
