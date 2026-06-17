//! MVP audio state engine.

use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rodio::{Decoder, Source};
use thiserror::Error;

use crate::audio::AudioOutputSnapshot;
use crate::types::{PlayStatus, RepeatMode};

/// Snapshot of the player state exposed through IPC.
#[derive(Clone)]
pub struct PlayerSnapshot {
    /// Current playback status.
    pub status: PlayStatus,
    /// Current track path.
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

/// Result of a periodic playback tick.
#[derive(Clone)]
pub struct PlayerTick {
    /// Latest player state after advancing finished tracks when needed.
    pub snapshot: PlayerSnapshot,
    /// Whether audio output should be synchronized with the snapshot.
    pub output_changed: bool,
}

impl Default for PlayerSnapshot {
    fn default() -> Self {
        Self {
            status: PlayStatus::Stopped,
            current_track: None,
            position_ms: 0,
            duration_ms: 0,
            volume: 0.72,
            shuffle: false,
            repeat: RepeatMode::None,
        }
    }
}

/// Playback errors produced by the audio engine.
#[derive(Debug, Error)]
pub enum AudioError {
    /// The requested audio path was empty.
    #[error("Audio path cannot be empty")]
    EmptyPath,
    /// The requested audio path is not an existing file.
    #[error("Audio file does not exist: {0}")]
    MissingFile(String),
    /// The output device or stream could not be initialized.
    #[error("Failed to initialize audio output: {0}")]
    Output(String),
    /// The audio file could not be opened.
    #[error("Failed to open audio file: {0}")]
    OpenFile(#[from] std::io::Error),
    /// The audio file could not be decoded.
    #[error("Failed to decode audio file: {0}")]
    Decode(String),
    /// The provided volume was outside the valid range.
    #[error("Volume must be between 0.0 and 1.0")]
    InvalidVolume,
    /// The provided queue did not contain any playable paths.
    #[error("Queue cannot be empty")]
    EmptyQueue,
    /// The requested queue index was outside the queue bounds.
    #[error("Queue index {index} is out of bounds for {len} tracks")]
    InvalidQueueIndex {
        /// Requested index.
        index: usize,
        /// Queue length.
        len: usize,
    },
}

/// Local-first playback state engine.
///
/// This engine intentionally keeps only Send + Sync state in Tauri managed state.
/// Real rodio output should live behind a dedicated audio thread command channel.
#[derive(Default)]
pub struct AudioEngine {
    snapshot: PlayerSnapshot,
    started_at: Option<Instant>,
    started_position_ms: u64,
    queue: Vec<String>,
    current_index: Option<usize>,
    shuffle_order: Vec<usize>,
    shuffle_cursor: Option<usize>,
}

impl AudioEngine {
    /// Starts playback for an existing local audio file.
    pub fn play(&mut self, path: String) -> Result<(), AudioError> {
        let path = validate_audio_path(&path)?;
        let path = path.to_string_lossy().to_string();

        self.queue = vec![path.clone()];
        self.current_index = Some(0);
        self.reset_shuffle_order();
        self.start_track(path);
        Ok(())
    }

    /// Replaces the queue and starts playback at the requested index.
    pub fn set_queue(&mut self, paths: Vec<String>, start_index: usize) -> Result<(), AudioError> {
        let paths = normalize_queue(paths)?;
        if start_index >= paths.len() {
            return Err(AudioError::InvalidQueueIndex {
                index: start_index,
                len: paths.len(),
            });
        }

        let path = paths[start_index].clone();
        self.queue = paths;
        self.current_index = Some(start_index);
        self.reset_shuffle_order();
        self.start_track(path);
        Ok(())
    }

    /// Replaces queue bookkeeping without restarting the current track.
    pub fn update_queue(
        &mut self,
        paths: Vec<String>,
        current_index: usize,
    ) -> Result<(), AudioError> {
        let paths = normalize_queue(paths)?;
        if current_index >= paths.len() {
            return Err(AudioError::InvalidQueueIndex {
                index: current_index,
                len: paths.len(),
            });
        }

        if self.snapshot.current_track.is_none() {
            if let Some(path) = paths.get(current_index).cloned() {
                self.snapshot.status = PlayStatus::Paused;
                self.snapshot.current_track = Some(path.clone());
                self.snapshot.duration_ms = read_duration_ms(Path::new(&path));
                self.snapshot.position_ms = 0;
                self.started_at = None;
                self.started_position_ms = 0;
            }
        }

        self.queue = paths;
        self.current_index = Some(current_index);
        self.reset_shuffle_order();
        Ok(())
    }

    /// Advances playback to the next queue item when one is available.
    pub fn next_track(&mut self) -> Result<(), AudioError> {
        self.refresh_finished();

        let Some(next_index) = self.next_index() else {
            self.stop_at_queue_boundary();
            return Ok(());
        };

        self.current_index = Some(next_index);
        if let Some(path) = self.queue.get(next_index).cloned() {
            self.start_track(path);
        }

        Ok(())
    }

    /// Moves playback to the previous queue item, or restarts the current item at the queue start.
    pub fn previous_track(&mut self) -> Result<(), AudioError> {
        self.refresh_finished();

        let Some(previous_index) = self.previous_index() else {
            self.seek(0)?;
            return Ok(());
        };

        self.current_index = Some(previous_index);
        if let Some(path) = self.queue.get(previous_index).cloned() {
            self.start_track(path);
        }

        Ok(())
    }

    /// Toggles playback between playing and paused when a track is loaded.
    pub fn toggle_pause(&mut self) {
        self.refresh_finished();

        match self.snapshot.status {
            PlayStatus::Playing => {
                let position_ms = self.current_position_ms();
                self.snapshot.status = PlayStatus::Paused;
                self.snapshot.position_ms = position_ms;
                self.started_at = None;
                self.started_position_ms = position_ms;
            }
            PlayStatus::Paused => {
                self.snapshot.status = PlayStatus::Playing;
                self.started_at = Some(Instant::now());
                self.started_position_ms = self.snapshot.position_ms;
            }
            PlayStatus::Stopped | PlayStatus::Loading => {}
        }
    }

    /// Seeks the current track to the requested position, clamped to duration when known.
    pub fn seek(&mut self, position_ms: u64) -> Result<(), AudioError> {
        self.refresh_finished();

        if self.snapshot.current_track.is_none() {
            self.snapshot.position_ms = 0;
            return Ok(());
        }

        let duration_ms = self.snapshot.duration_ms;
        let clamped_ms = clamp_position(position_ms, duration_ms);
        self.snapshot.position_ms = clamped_ms;
        self.started_position_ms = clamped_ms;

        if matches!(self.snapshot.status, PlayStatus::Playing) {
            self.started_at = Some(Instant::now());
        } else {
            self.started_at = None;
        }

        Ok(())
    }

    /// Sets the output volume in the inclusive range 0.0 to 1.0.
    pub fn set_volume(&mut self, volume: f32) -> Result<(), AudioError> {
        if !(0.0..=1.0).contains(&volume) {
            return Err(AudioError::InvalidVolume);
        }

        self.snapshot.volume = volume;

        Ok(())
    }

    /// Toggles shuffle mode for subsequent queue navigation.
    pub fn toggle_shuffle(&mut self) {
        self.snapshot.shuffle = !self.snapshot.shuffle;
        self.reset_shuffle_order();
    }

    /// Cycles repeat mode through none, all, and one.
    pub fn cycle_repeat(&mut self) {
        self.snapshot.repeat = match self.snapshot.repeat {
            RepeatMode::None => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::None,
        };
    }

    /// Returns the latest player state snapshot.
    pub fn snapshot(&mut self) -> PlayerSnapshot {
        let mut snapshot = self.snapshot.clone();
        snapshot.position_ms = self.current_position_ms();
        snapshot
    }

    /// Advances playback bookkeeping and returns a snapshot for event emission.
    pub fn tick(&mut self) -> PlayerTick {
        let output_changed = self.advance_finished_track();
        let mut snapshot = self.snapshot.clone();
        snapshot.position_ms = self.current_position_ms();
        PlayerTick {
            snapshot,
            output_changed,
        }
    }

    /// Reconciles engine state with the dedicated audio output worker.
    pub fn apply_output_snapshot(&mut self, output: &AudioOutputSnapshot) -> bool {
        let Some(current_track) = self.snapshot.current_track.as_deref() else {
            return false;
        };
        if output.path.as_deref() != Some(current_track) {
            return false;
        }

        if output.error.is_some() {
            self.snapshot.status = PlayStatus::Stopped;
            self.snapshot.position_ms = self.current_position_ms();
            self.started_at = None;
            self.started_position_ms = self.snapshot.position_ms;
            return false;
        }

        if output.is_finished && matches!(self.snapshot.status, PlayStatus::Playing) {
            self.snapshot.position_ms = if self.snapshot.duration_ms > 0 {
                self.snapshot.duration_ms
            } else {
                output.position_ms
            };
            self.started_at = None;
            self.started_position_ms = self.snapshot.position_ms;
            let Some(next_index) = self.next_index() else {
                self.stop_at_queue_boundary();
                return true;
            };
            self.current_index = Some(next_index);
            if let Some(path) = self.queue.get(next_index).cloned() {
                self.start_track(path);
            }
            return true;
        }

        if output.is_playing && matches!(self.snapshot.status, PlayStatus::Playing) {
            let position_ms = clamp_position(output.position_ms, self.snapshot.duration_ms);
            self.snapshot.position_ms = position_ms;
            self.started_position_ms = position_ms;
            self.started_at = Some(Instant::now());
        }

        false
    }

    fn current_position_ms(&self) -> u64 {
        let position_ms = match (self.snapshot.status, self.started_at) {
            (PlayStatus::Playing, Some(started_at)) => self
                .started_position_ms
                .saturating_add(duration_to_millis(started_at.elapsed())),
            _ => self.snapshot.position_ms,
        };

        clamp_position(position_ms, self.snapshot.duration_ms)
    }

    fn start_track(&mut self, path: String) {
        let duration_ms = read_duration_ms(Path::new(&path));

        self.snapshot.status = PlayStatus::Loading;
        self.snapshot.current_track = Some(path);
        self.snapshot.duration_ms = duration_ms;
        self.snapshot.position_ms = 0;

        self.snapshot.status = PlayStatus::Playing;
        self.started_at = Some(Instant::now());
        self.started_position_ms = 0;
    }

    fn next_index(&mut self) -> Option<usize> {
        if self.queue.is_empty() {
            return None;
        }

        let current_index = self.current_index.unwrap_or(0);
        if matches!(self.snapshot.repeat, RepeatMode::One) {
            return Some(current_index);
        }

        if self.snapshot.shuffle && self.queue.len() > 1 {
            return self.next_shuffle_index(current_index);
        }

        let next_index = current_index.saturating_add(1);
        if next_index < self.queue.len() {
            Some(next_index)
        } else if matches!(self.snapshot.repeat, RepeatMode::All) {
            Some(0)
        } else {
            None
        }
    }

    fn previous_index(&mut self) -> Option<usize> {
        if self.queue.is_empty() {
            return None;
        }

        let current_index = self.current_index.unwrap_or(0);
        if matches!(self.snapshot.repeat, RepeatMode::One) {
            return Some(current_index);
        }

        if self.snapshot.shuffle && self.queue.len() > 1 {
            return self.previous_shuffle_index(current_index);
        }

        if current_index > 0 {
            Some(current_index - 1)
        } else if matches!(self.snapshot.repeat, RepeatMode::All) {
            Some(self.queue.len() - 1)
        } else {
            None
        }
    }

    fn stop_at_queue_boundary(&mut self) {
        self.snapshot.status = PlayStatus::Stopped;
        self.snapshot.position_ms = 0;
        self.started_at = None;
        self.started_position_ms = 0;
    }

    fn refresh_finished(&mut self) {
        let is_finished = self.snapshot.duration_ms > 0
            && self.current_position_ms() >= self.snapshot.duration_ms
            && matches!(self.snapshot.status, PlayStatus::Playing);

        if is_finished {
            self.snapshot.status = PlayStatus::Stopped;
            self.snapshot.position_ms = self.snapshot.duration_ms;
            self.started_at = None;
            self.started_position_ms = self.snapshot.position_ms;
        }
    }

    fn advance_finished_track(&mut self) -> bool {
        let is_finished = self.snapshot.duration_ms > 0
            && self.current_position_ms() >= self.snapshot.duration_ms
            && matches!(self.snapshot.status, PlayStatus::Playing);

        if !is_finished {
            return false;
        }

        let Some(next_index) = self.next_index() else {
            self.stop_at_queue_boundary();
            return true;
        };

        self.current_index = Some(next_index);
        if let Some(path) = self.queue.get(next_index).cloned() {
            self.start_track(path);
        }

        true
    }

    fn reset_shuffle_order(&mut self) {
        self.shuffle_order.clear();
        self.shuffle_cursor = None;

        if !self.snapshot.shuffle || self.queue.is_empty() {
            return;
        }

        self.rebuild_shuffle_order();
    }

    fn rebuild_shuffle_order(&mut self) {
        self.shuffle_order = (0..self.queue.len()).collect();
        shuffle_indices(&mut self.shuffle_order);

        let Some(current_index) = self.current_index else {
            self.shuffle_cursor = None;
            return;
        };

        if let Some(cursor) = self
            .shuffle_order
            .iter()
            .position(|index| *index == current_index)
        {
            self.shuffle_order.swap(0, cursor);
            self.shuffle_cursor = Some(0);
        } else {
            self.shuffle_cursor = None;
        }
    }

    fn ensure_shuffle_cursor(&mut self, current_index: usize) -> Option<usize> {
        let needs_rebuild = self.shuffle_order.len() != self.queue.len()
            || !self.shuffle_order.contains(&current_index);

        if needs_rebuild {
            self.rebuild_shuffle_order();
        }

        let cursor = self
            .shuffle_cursor
            .filter(|cursor| self.shuffle_order.get(*cursor) == Some(&current_index))
            .or_else(|| {
                self.shuffle_order
                    .iter()
                    .position(|index| *index == current_index)
            })?;
        self.shuffle_cursor = Some(cursor);
        Some(cursor)
    }

    fn next_shuffle_index(&mut self, current_index: usize) -> Option<usize> {
        let cursor = self.ensure_shuffle_cursor(current_index)?;
        let next_cursor = cursor.saturating_add(1);

        if let Some(next_index) = self.shuffle_order.get(next_cursor).copied() {
            self.shuffle_cursor = Some(next_cursor);
            return Some(next_index);
        }

        if !matches!(self.snapshot.repeat, RepeatMode::All) {
            return None;
        }

        self.rebuild_shuffle_order();
        let next_index = self.shuffle_order.get(1).copied()?;
        self.shuffle_cursor = Some(1);
        Some(next_index)
    }

    fn previous_shuffle_index(&mut self, current_index: usize) -> Option<usize> {
        let cursor = self.ensure_shuffle_cursor(current_index)?;

        if cursor > 0 {
            let previous_cursor = cursor - 1;
            let previous_index = self.shuffle_order.get(previous_cursor).copied()?;
            self.shuffle_cursor = Some(previous_cursor);
            return Some(previous_index);
        }

        if !matches!(self.snapshot.repeat, RepeatMode::All) {
            return None;
        }

        let previous_cursor = self.shuffle_order.len().checked_sub(1)?;
        let previous_index = self.shuffle_order.get(previous_cursor).copied()?;
        self.shuffle_cursor = Some(previous_cursor);
        Some(previous_index)
    }
}

fn normalize_queue(paths: Vec<String>) -> Result<Vec<String>, AudioError> {
    let paths = paths
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();

    if paths.is_empty() {
        Err(AudioError::EmptyQueue)
    } else {
        Ok(paths)
    }
}

fn validate_audio_path(path: &str) -> Result<PathBuf, AudioError> {
    if path.trim().is_empty() {
        return Err(AudioError::EmptyPath);
    }

    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err(AudioError::MissingFile(path.display().to_string()));
    }

    Ok(path)
}

fn read_duration_ms(path: &Path) -> u64 {
    File::open(path)
        .ok()
        .and_then(|file| Decoder::new(BufReader::new(file)).ok())
        .and_then(|decoder| decoder.total_duration())
        .map(duration_to_millis)
        .unwrap_or(0)
}

fn duration_to_millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

fn clamp_position(position_ms: u64, duration_ms: u64) -> u64 {
    if duration_ms == 0 {
        position_ms
    } else {
        position_ms.min(duration_ms)
    }
}

fn shuffle_indices(indices: &mut [usize]) {
    let mut state = shuffle_seed();
    for index in (1..indices.len()).rev() {
        let swap_index = usize::try_from(next_random(&mut state)).unwrap_or(0) % (index + 1);
        indices.swap(index, swap_index);
    }
}

fn shuffle_seed() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_nanos()).ok())
        .unwrap_or(0x9e37_79b9_7f4a_7c15)
}

fn next_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1);
    *state
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::{clamp_position, AudioEngine};
    use crate::types::PlayStatus;

    #[test]
    fn clamps_seek_to_known_duration() {
        assert_eq!(clamp_position(1_500, 1_000), 1_000);
        assert_eq!(clamp_position(500, 1_000), 500);
    }

    #[test]
    fn leaves_seek_unclamped_when_duration_is_unknown() {
        assert_eq!(clamp_position(1_500, 0), 1_500);
    }

    #[test]
    fn rejects_invalid_volume_without_audio_device() {
        let mut engine = AudioEngine::default();
        assert!(engine.set_volume(1.1).is_err());
        assert!(engine.set_volume(0.5).is_ok());
    }

    #[test]
    fn queue_navigation_advances_and_stops_at_end() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 0)
            .unwrap();

        engine.next_track().unwrap();
        assert_eq!(engine.snapshot().current_track.as_deref(), Some("two.flac"));

        engine.next_track().unwrap();
        assert_eq!(engine.snapshot().status, crate::types::PlayStatus::Stopped);
    }

    #[test]
    fn repeat_all_wraps_queue_navigation() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 1)
            .unwrap();
        engine.cycle_repeat();

        engine.next_track().unwrap();
        assert_eq!(engine.snapshot().current_track.as_deref(), Some("one.flac"));
    }

    #[test]
    fn shuffle_navigation_follows_randomized_order_history() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(
                vec!["one.flac".into(), "two.flac".into(), "three.flac".into()],
                0,
            )
            .unwrap();
        engine.toggle_shuffle();
        engine.shuffle_order = vec![0, 2, 1];
        engine.shuffle_cursor = Some(0);

        engine.next_track().unwrap();
        assert_eq!(
            engine.snapshot().current_track.as_deref(),
            Some("three.flac")
        );

        engine.previous_track().unwrap();
        assert_eq!(engine.snapshot().current_track.as_deref(), Some("one.flac"));
    }

    #[test]
    fn shuffle_without_repeat_stops_after_randomized_order_is_exhausted() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 1)
            .unwrap();
        engine.toggle_shuffle();
        engine.shuffle_order = vec![0, 1];
        engine.shuffle_cursor = Some(1);

        engine.next_track().unwrap();

        assert_eq!(engine.snapshot().status, PlayStatus::Stopped);
    }

    #[test]
    fn update_queue_preserves_current_track_and_position() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 0)
            .unwrap();
        engine.snapshot.status = PlayStatus::Paused;
        engine.snapshot.position_ms = 5_000;
        engine.started_at = None;
        engine
            .update_queue(
                vec!["one.flac".into(), "inserted.flac".into(), "two.flac".into()],
                0,
            )
            .unwrap();

        let snapshot = engine.snapshot();

        assert_eq!(snapshot.current_track.as_deref(), Some("one.flac"));
        assert_eq!(snapshot.position_ms, 5_000);
    }

    #[test]
    fn update_queue_can_restore_paused_snapshot_without_playing() {
        let mut engine = AudioEngine::default();
        engine
            .update_queue(vec!["one.flac".into(), "two.flac".into()], 1)
            .unwrap();

        let snapshot = engine.snapshot();

        assert_eq!(snapshot.current_track.as_deref(), Some("two.flac"));
        assert_eq!(snapshot.status, PlayStatus::Paused);
    }

    #[test]
    fn tick_advances_finished_track_to_next_queue_item() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 0)
            .unwrap();
        engine.snapshot.duration_ms = 1;
        engine.snapshot.status = PlayStatus::Playing;
        engine.started_at = Some(Instant::now() - Duration::from_millis(10));
        engine.started_position_ms = 0;

        let tick = engine.tick();

        assert!(tick.output_changed);
        assert_eq!(tick.snapshot.current_track.as_deref(), Some("two.flac"));
        assert_eq!(tick.snapshot.status, PlayStatus::Playing);
    }

    #[test]
    fn tick_stops_when_finished_at_queue_end_without_repeat() {
        let mut engine = AudioEngine::default();
        engine.set_queue(vec!["one.flac".into()], 0).unwrap();
        engine.snapshot.duration_ms = 1;
        engine.snapshot.status = PlayStatus::Playing;
        engine.started_at = Some(Instant::now() - Duration::from_millis(10));
        engine.started_position_ms = 0;

        let tick = engine.tick();

        assert!(tick.output_changed);
        assert_eq!(tick.snapshot.status, PlayStatus::Stopped);
        assert_eq!(tick.snapshot.current_track.as_deref(), Some("one.flac"));
    }

    #[test]
    fn snapshot_does_not_stop_finished_track_before_event_tick() {
        let mut engine = AudioEngine::default();
        engine
            .set_queue(vec!["one.flac".into(), "two.flac".into()], 0)
            .unwrap();
        engine.snapshot.duration_ms = 1;
        engine.snapshot.status = PlayStatus::Playing;
        engine.started_at = Some(Instant::now() - Duration::from_millis(10));
        engine.started_position_ms = 0;

        let snapshot = engine.snapshot();

        assert_eq!(snapshot.current_track.as_deref(), Some("one.flac"));
        assert_eq!(snapshot.status, PlayStatus::Playing);
        assert_eq!(snapshot.position_ms, 1);

        let tick = engine.tick();

        assert!(tick.output_changed);
        assert_eq!(tick.snapshot.current_track.as_deref(), Some("two.flac"));
        assert_eq!(tick.snapshot.status, PlayStatus::Playing);
    }
}
