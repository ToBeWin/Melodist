//! Audio playback state and engine.

mod engine;
mod output;

pub use engine::{AudioEngine, AudioError, PlayerSnapshot};
pub use output::{AudioOutput, AudioOutputSnapshot};
