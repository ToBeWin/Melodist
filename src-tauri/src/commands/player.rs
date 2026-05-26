use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use cpal::traits::{DeviceTrait, HostTrait};
use rodio::Decoder;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::state::AppState;
use crate::types::{AudioOutputDevice, PlayerState};

const PLAYER_EVENT_INTERVAL_MS: u64 = 100;

async fn validate_existing_queue_paths(paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        for path in paths {
            if !Path::new(&path).is_file() {
                return Err(format!("Audio file does not exist: {path}"));
            }
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("Failed to validate queue paths: {error}"))?
}

async fn validate_playable_path(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = std::fs::File::open(&path)
            .map_err(|error| format!("Failed to open audio file {path}: {error}"))?;
        Decoder::new(std::io::BufReader::new(file))
            .map(|_| ())
            .map_err(|error| format!("Failed to decode audio file {path}: {error}"))
    })
    .await
    .map_err(|error| format!("Failed to validate playable audio: {error}"))?
}

fn unix_timestamp_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_secs()).ok())
        .unwrap_or(0)
}

async fn record_playback(app: AppHandle, path: String) -> Result<(), String> {
    let database_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join("library.sqlite3");
    record_playback_at_path(database_path, path).await
}

async fn record_playback_at_path(database_path: PathBuf, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = database_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create app data directory: {error}"))?;
        }
        let database = crate::library::db::Database::open(&database_path)
            .map_err(|error| format!("Failed to open library database: {error}"))?;
        database
            .record_playback_by_path(&path, unix_timestamp_now())
            .map_err(|error| format!("Failed to record playback: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| format!("Failed to join playback stat task: {error}"))?
}

/// Starts playback for the provided local audio file path.
#[tauri::command]
pub async fn play(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    validate_playable_path(path.clone()).await?;
    let started_path = path.clone();
    let player = {
        let mut audio = state.audio.lock();
        audio
            .play(path)
            .map_err(|error| format!("Failed to play track: {error}"))?;
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    record_playback(app, started_path).await?;
    Ok(())
}

/// Replaces the play queue and starts playback at the requested index.
#[tauri::command]
pub async fn set_queue(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
    start_index: usize,
) -> Result<PlayerState, String> {
    validate_existing_queue_paths(paths.clone()).await?;
    let Some(path) = paths.get(start_index) else {
        return Err(format!("Queue index {start_index} is out of bounds"));
    };
    validate_playable_path(path.clone()).await?;
    let started_path = path.clone();
    let player = {
        let mut audio = state.audio.lock();
        audio
            .set_queue(paths, start_index)
            .map_err(|error| format!("Failed to set queue: {error}"))?;
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    record_playback(app, started_path).await?;
    Ok(player_state_from_snapshot(player))
}

/// Updates the play queue without restarting the currently playing track.
#[tauri::command]
pub async fn update_queue(
    state: State<'_, AppState>,
    paths: Vec<String>,
    current_index: usize,
) -> Result<PlayerState, String> {
    validate_existing_queue_paths(paths.clone()).await?;
    let mut audio = state.audio.lock();
    audio
        .update_queue(paths, current_index)
        .map_err(|error| format!("Failed to update queue: {error}"))?;
    let player = audio.snapshot();
    Ok(player_state_from_snapshot(player))
}

/// Advances to the next track in the play queue.
#[tauri::command]
pub async fn next_track(app: AppHandle, state: State<'_, AppState>) -> Result<PlayerState, String> {
    let player = {
        let mut audio = state.audio.lock();
        audio
            .next_track()
            .map_err(|error| format!("Failed to advance queue: {error}"))?;
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    if matches!(player.status, crate::types::PlayStatus::Playing) {
        if let Some(path) = &player.current_track {
            record_playback(app, path.clone()).await?;
        }
    }
    Ok(player_state_from_snapshot(player))
}

/// Moves to the previous track in the play queue or restarts at the queue start.
#[tauri::command]
pub async fn previous_track(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PlayerState, String> {
    let player = {
        let mut audio = state.audio.lock();
        audio
            .previous_track()
            .map_err(|error| format!("Failed to move back in queue: {error}"))?;
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    if matches!(player.status, crate::types::PlayStatus::Playing) {
        if let Some(path) = &player.current_track {
            record_playback(app, path.clone()).await?;
        }
    }
    Ok(player_state_from_snapshot(player))
}
/// Toggles playback between playing and paused.
#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<(), String> {
    let player = {
        let mut audio = state.audio.lock();
        audio.toggle_pause();
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    Ok(())
}

/// Seeks the current track to a position in milliseconds.
#[tauri::command]
pub async fn seek(state: State<'_, AppState>, position_ms: u64) -> Result<(), String> {
    let player = {
        let mut audio = state.audio.lock();
        audio
            .seek(position_ms)
            .map_err(|error| format!("Failed to seek track: {error}"))?;
        audio.snapshot()
    };
    sync_output_to_state(&state, &player);
    Ok(())
}

/// Sets the output volume.
#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String> {
    state
        .audio
        .lock()
        .set_volume(volume)
        .map_err(|error| format!("Failed to set volume: {error}"))?;
    state.output.set_volume(volume);
    Ok(())
}

/// Enables or disables ReplayGain tag normalization for playback.
#[tauri::command]
pub async fn set_replay_gain_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<PlayerState, String> {
    *state.replay_gain_enabled.write() = enabled;
    let player = state.audio.lock().snapshot();
    sync_output_to_state(&state, &player);
    Ok(player_state_from_snapshot(player))
}

/// Returns available audio output devices.
#[tauri::command]
pub async fn list_audio_output_devices() -> Result<Vec<AudioOutputDevice>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_output_device()
        .and_then(|device| device.name().ok());
    let devices = host
        .output_devices()
        .map_err(|error| format!("Failed to enumerate audio output devices: {error}"))?;

    let mut results = Vec::new();
    for device in devices {
        let name = device
            .name()
            .map_err(|error| format!("Failed to read audio output device name: {error}"))?;
        let is_default = default_name.as_deref() == Some(name.as_str());
        if results
            .iter()
            .any(|existing: &AudioOutputDevice| existing.id == name)
        {
            continue;
        }
        results.push(AudioOutputDevice {
            id: name.clone(),
            name,
            is_default,
        });
    }

    Ok(results)
}

/// Selects the audio output device used for subsequent playback.
#[tauri::command]
pub async fn set_audio_output_device(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<PlayerState, String> {
    let normalized_device_id = device_id.and_then(|id| {
        let trimmed = id.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    state.output.set_output_device(normalized_device_id);
    let player = state.audio.lock().snapshot();
    sync_output_to_state(&state, &player);
    Ok(player_state_from_snapshot(player))
}

/// Toggles shuffle mode for the play queue.
#[tauri::command]
pub async fn toggle_shuffle(state: State<'_, AppState>) -> Result<PlayerState, String> {
    let mut audio = state.audio.lock();
    audio.toggle_shuffle();
    Ok(player_state_from_snapshot(audio.snapshot()))
}

/// Cycles repeat mode for the play queue.
#[tauri::command]
pub async fn cycle_repeat(state: State<'_, AppState>) -> Result<PlayerState, String> {
    let mut audio = state.audio.lock();
    audio.cycle_repeat();
    Ok(player_state_from_snapshot(audio.snapshot()))
}

/// Returns the current player state.
#[tauri::command]
pub async fn get_player_state(state: State<'_, AppState>) -> Result<PlayerState, String> {
    let player = state.audio.lock().snapshot();
    Ok(player_state_from_snapshot(player))
}

fn player_state_from_snapshot(player: crate::audio::PlayerSnapshot) -> PlayerState {
    PlayerState {
        status: player.status,
        current_track: player.current_track,
        position_ms: player.position_ms,
        duration_ms: player.duration_ms,
        volume: player.volume,
        shuffle: player.shuffle,
        repeat: player.repeat,
    }
}

/// Starts the player event loop that keeps frontend state in sync with playback.
pub fn start_player_event_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(PLAYER_EVENT_INTERVAL_MS));
        let mut last_output_error: Option<String> = None;

        loop {
            interval.tick().await;

            let tick = {
                let state = app.state::<AppState>();
                let output = state.output.snapshot();
                if output.error != last_output_error {
                    last_output_error = output.error.clone();
                    if let Some(error) = &last_output_error {
                        let _ = app.emit("player://output-error", error.clone());
                    }
                }
                let mut audio = state.audio.lock();
                let output_changed = audio.apply_output_snapshot(&output);
                let mut tick = audio.tick();
                tick.output_changed = tick.output_changed || output_changed;
                tick
            };

            if tick.output_changed {
                let state = app.state::<AppState>();
                sync_output_to_snapshot(&state, &tick.snapshot);
                if matches!(tick.snapshot.status, crate::types::PlayStatus::Playing) {
                    if let Some(path) = tick.snapshot.current_track.clone() {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(error) = record_playback(app, path).await {
                                eprintln!("{error}");
                            }
                        });
                    }
                }
            }

            let _ = app.emit("player://position", tick.snapshot.position_ms);
            let _ = app.emit("player://state", player_state_from_snapshot(tick.snapshot));
        }
    });
}

fn sync_output_to_snapshot(state: &AppState, player: &crate::audio::PlayerSnapshot) {
    match player.status {
        crate::types::PlayStatus::Playing => {
            if let Some(path) = &player.current_track {
                state.output.play(
                    path.clone(),
                    player.position_ms,
                    player.volume,
                    *state.replay_gain_enabled.read(),
                );
            }
        }
        crate::types::PlayStatus::Paused => state.output.pause(),
        crate::types::PlayStatus::Stopped | crate::types::PlayStatus::Loading => {
            state.output.stop();
        }
    }
}

fn sync_output_to_state(state: &State<'_, AppState>, player: &crate::audio::PlayerSnapshot) {
    match player.status {
        crate::types::PlayStatus::Playing => {
            if let Some(path) = &player.current_track {
                state.inner().output.play(
                    path.clone(),
                    player.position_ms,
                    player.volume,
                    *state.inner().replay_gain_enabled.read(),
                );
            }
        }
        crate::types::PlayStatus::Paused => state.inner().output.pause(),
        crate::types::PlayStatus::Stopped | crate::types::PlayStatus::Loading => {
            state.inner().output.stop();
        }
    }
}
