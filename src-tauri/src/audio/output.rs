//! Dedicated audio output thread for rodio playback.

use std::fs::File;
use std::io::BufReader;
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait};
use lofty::file::TaggedFileExt;
use lofty::tag::ItemKey;
use parking_lot::RwLock;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};

const OUTPUT_STATUS_INTERVAL: Duration = Duration::from_millis(100);

/// Playback status reported by the dedicated audio output worker.
#[derive(Clone, Default)]
pub struct AudioOutputSnapshot {
    /// Current output file path.
    pub path: Option<String>,
    /// Best-known output position in milliseconds.
    pub position_ms: u64,
    /// Whether the output sink is actively playing.
    pub is_playing: bool,
    /// Whether the output sink has consumed its current source.
    pub is_finished: bool,
    /// Last output error, if one occurred.
    pub error: Option<String>,
}

/// Thread-safe handle used by Tauri commands to control audio output.
pub struct AudioOutput {
    sender: mpsc::Sender<AudioCommand>,
    status: Arc<RwLock<AudioOutputSnapshot>>,
}

impl Default for AudioOutput {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioOutput {
    /// Starts the audio output worker thread.
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::channel();
        let status = Arc::new(RwLock::new(AudioOutputSnapshot::default()));
        let worker_status = Arc::clone(&status);
        thread::spawn(move || run_output_worker(receiver, worker_status));
        Self { sender, status }
    }

    /// Starts or restarts playback of a local file.
    pub fn play(&self, path: String, position_ms: u64, volume: f32, replay_gain_enabled: bool) {
        let _ = self.sender.send(AudioCommand::Play {
            path,
            position_ms,
            volume,
            replay_gain_enabled,
        });
    }

    /// Pauses the current output sink.
    pub fn pause(&self) {
        let _ = self.sender.send(AudioCommand::Pause);
    }

    /// Resumes the current output sink.
    pub fn resume(&self) {
        let _ = self.sender.send(AudioCommand::Resume);
    }

    /// Stops the current output sink.
    pub fn stop(&self) {
        let _ = self.sender.send(AudioCommand::Stop);
    }

    /// Updates output volume.
    pub fn set_volume(&self, volume: f32) {
        let _ = self.sender.send(AudioCommand::SetVolume(volume));
    }

    /// Selects a preferred output device by system device name.
    pub fn set_output_device(&self, device_id: Option<String>) {
        let _ = self.sender.send(AudioCommand::SetOutputDevice(device_id));
    }

    /// Returns the latest output status snapshot.
    pub fn snapshot(&self) -> AudioOutputSnapshot {
        self.status.read().clone()
    }
}

enum AudioCommand {
    Play {
        path: String,
        position_ms: u64,
        volume: f32,
        replay_gain_enabled: bool,
    },
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    SetOutputDevice(Option<String>),
}

struct OutputRuntime {
    _stream: OutputStream,
    handle: OutputStreamHandle,
}

struct PlaybackClock {
    path: String,
    started_position_ms: u64,
    position_ms: u64,
    started_at: Option<Instant>,
}

impl PlaybackClock {
    fn new(path: String, position_ms: u64) -> Self {
        Self {
            path,
            started_position_ms: position_ms,
            position_ms,
            started_at: Some(Instant::now()),
        }
    }

    fn position_ms(&self) -> u64 {
        self.started_at.map_or(self.position_ms, |started_at| {
            self.started_position_ms
                .saturating_add(duration_to_millis(started_at.elapsed()))
        })
    }

    fn pause(&mut self) {
        self.position_ms = self.position_ms();
        self.started_position_ms = self.position_ms;
        self.started_at = None;
    }

    fn resume(&mut self) {
        self.started_position_ms = self.position_ms;
        self.started_at = Some(Instant::now());
    }
}

fn run_output_worker(
    receiver: mpsc::Receiver<AudioCommand>,
    status: Arc<RwLock<AudioOutputSnapshot>>,
) {
    let mut runtime: Option<OutputRuntime> = None;
    let mut sink: Option<Sink> = None;
    let mut preferred_device_id: Option<String> = None;
    let mut clock: Option<PlaybackClock> = None;

    loop {
        match receiver.recv_timeout(OUTPUT_STATUS_INTERVAL) {
            Ok(command) => match command {
                AudioCommand::Play {
                    path,
                    position_ms,
                    volume,
                    replay_gain_enabled,
                } => {
                    if runtime.is_none() {
                        runtime = create_runtime(preferred_device_id.as_deref());
                    }

                    let Some(runtime) = runtime.as_ref() else {
                        set_error(&status, "No audio output device is available".to_string());
                        continue;
                    };

                    match create_sink(runtime, &path, position_ms, volume, replay_gain_enabled) {
                        Ok(next_sink) => {
                            if let Some(previous_sink) = sink.take() {
                                previous_sink.stop();
                            }
                            clock = Some(PlaybackClock::new(path.clone(), position_ms));
                            sink = Some(next_sink);
                            set_status(
                                &status,
                                AudioOutputSnapshot {
                                    path: Some(path),
                                    position_ms,
                                    is_playing: true,
                                    is_finished: false,
                                    error: None,
                                },
                            );
                        }
                        Err(error) => set_error(&status, error),
                    }
                }
                AudioCommand::Pause => {
                    if let Some(sink) = &sink {
                        sink.pause();
                    }
                    if let Some(clock) = &mut clock {
                        clock.pause();
                    }
                }
                AudioCommand::Resume => {
                    if let Some(sink) = &sink {
                        sink.play();
                    }
                    if let Some(clock) = &mut clock {
                        clock.resume();
                    }
                }
                AudioCommand::Stop => {
                    if let Some(previous_sink) = sink.take() {
                        previous_sink.stop();
                    }
                    clock = None;
                    set_status(&status, AudioOutputSnapshot::default());
                }
                AudioCommand::SetVolume(volume) => {
                    if let Some(sink) = &sink {
                        sink.set_volume(volume);
                    }
                }
                AudioCommand::SetOutputDevice(device_id) => {
                    preferred_device_id = device_id;
                    if let Some(previous_sink) = sink.take() {
                        previous_sink.stop();
                    }
                    clock = None;
                    runtime = None;
                    set_status(&status, AudioOutputSnapshot::default());
                }
            },
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
        }

        refresh_status(&status, sink.as_ref(), clock.as_mut());
    }
}

fn create_runtime(preferred_device_id: Option<&str>) -> Option<OutputRuntime> {
    if let Some(device_id) = preferred_device_id {
        if let Some(runtime) = create_runtime_for_device(device_id) {
            return Some(runtime);
        }
    }

    OutputStream::try_default()
        .ok()
        .map(|(_stream, handle)| OutputRuntime { _stream, handle })
}

fn create_runtime_for_device(device_id: &str) -> Option<OutputRuntime> {
    let host = cpal::default_host();
    let devices = host.output_devices().ok()?;
    for device in devices {
        let Ok(name) = device.name() else {
            continue;
        };
        if name != device_id {
            continue;
        }

        let Ok((_stream, handle)) = OutputStream::try_from_device(&device) else {
            continue;
        };
        return Some(OutputRuntime { _stream, handle });
    }

    None
}

fn create_sink(
    runtime: &OutputRuntime,
    path: &str,
    position_ms: u64,
    volume: f32,
    replay_gain_enabled: bool,
) -> Result<Sink, String> {
    let file =
        File::open(path).map_err(|error| format!("Failed to open audio output file: {error}"))?;
    let decoder = Decoder::new(BufReader::new(file))
        .map_err(|error| format!("Failed to decode audio output file: {error}"))?;
    let source = decoder.skip_duration(Duration::from_millis(position_ms));
    let sink = Sink::try_new(&runtime.handle)
        .map_err(|error| format!("Failed to create audio sink: {error}"))?;
    sink.set_volume(volume);
    if replay_gain_enabled {
        sink.append(source.amplify(replay_gain_multiplier(path)));
    } else {
        sink.append(source);
    }
    sink.play();
    Ok(sink)
}

fn refresh_status(
    status: &Arc<RwLock<AudioOutputSnapshot>>,
    sink: Option<&Sink>,
    clock: Option<&mut PlaybackClock>,
) {
    let Some(clock) = clock else {
        return;
    };
    let Some(sink) = sink else {
        return;
    };

    let is_finished = sink.empty();
    if is_finished {
        clock.pause();
    }

    set_status(
        status,
        AudioOutputSnapshot {
            path: Some(clock.path.clone()),
            position_ms: clock.position_ms(),
            is_playing: !sink.is_paused() && !is_finished,
            is_finished,
            error: None,
        },
    );
}

fn set_status(status: &Arc<RwLock<AudioOutputSnapshot>>, snapshot: AudioOutputSnapshot) {
    *status.write() = snapshot;
}

fn set_error(status: &Arc<RwLock<AudioOutputSnapshot>>, error: String) {
    let mut snapshot = status.write();
    snapshot.is_playing = false;
    snapshot.error = Some(error);
}

fn duration_to_millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

fn replay_gain_multiplier(path: &str) -> f32 {
    let gain_db = lofty::read_from_path(path)
        .ok()
        .and_then(|tagged_file| {
            tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag())
                .and_then(|tag| tag.get_string(&ItemKey::ReplayGainTrackGain))
                .and_then(parse_replay_gain_db)
        })
        .unwrap_or(0.0);

    10_f32.powf(gain_db / 20.0)
}

fn parse_replay_gain_db(value: &str) -> Option<f32> {
    let trimmed = value.trim();
    let numeric = trimmed
        .strip_suffix("dB")
        .or_else(|| trimmed.strip_suffix("db"))
        .unwrap_or(trimmed)
        .trim();
    numeric.parse::<f32>().ok()
}

#[cfg(test)]
mod tests {
    use super::parse_replay_gain_db;

    #[test]
    fn parses_replay_gain_values_with_db_suffix() {
        assert_eq!(parse_replay_gain_db("+3.25 dB"), Some(3.25));
        assert_eq!(parse_replay_gain_db("-7.0 db"), Some(-7.0));
        assert_eq!(parse_replay_gain_db("0"), Some(0.0));
        assert_eq!(parse_replay_gain_db("not gain"), None);
    }
}
