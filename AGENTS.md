# AGENTS.md — Melodist Music Player

> This file is the authoritative specification for all AI coding agents (Codex, Claude Code, etc.)
> working on this codebase. Read it completely before touching any file.
> When in conflict, this document wins over any inline comment or commit message.

---

## 0. Project Identity

**Name**: Melodist  
**Tagline**: The first music player that truly understands your music — lyrics, translation, and metadata, all local, all private.  
**Repo**: `github.com/metapure-lab/melodist`  
**License**: MIT  
**Author**: MetaPure Lab (metapure.ai)  
**Target platforms**: macOS 12+, Windows 10+, Linux (glibc 2.31+)  
**Tech stack**: Rust (backend) + Tauri 2.0 + React 18 + TypeScript + Tailwind CSS v4  

---

## 1. Architecture Overview

```
melodist/
├── src-tauri/               # Rust backend (Tauri 2.0)
│   ├── src/
│   │   ├── main.rs          # Tauri app entry, plugin registration
│   │   ├── lib.rs           # Public library root
│   │   ├── audio/           # Audio engine module
│   │   │   ├── mod.rs
│   │   │   ├── engine.rs    # Symphonia decode + rodio playback
│   │   │   ├── queue.rs     # Play queue state machine
│   │   │   └── resampler.rs # Sample rate conversion
│   │   ├── library/         # Local music library module
│   │   │   ├── mod.rs
│   │   │   ├── scanner.rs   # Recursive directory scan
│   │   │   ├── metadata.rs  # Tag reading (ID3, Vorbis, FLAC)
│   │   │   └── db.rs        # SQLite via rusqlite
│   │   ├── lyrics/          # Lyrics module
│   │   │   ├── mod.rs
│   │   │   ├── lrc.rs       # LRC file parser/writer
│   │   │   ├── whisper.rs   # whisper-rs local inference
│   │   │   └── translate.rs # Translation via configurable LLM API
│   │   ├── cover/           # Album art module
│   │   │   ├── mod.rs
│   │   │   └── extractor.rs # Embedded art extraction + cache
│   │   ├── commands/        # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── player.rs    # play/pause/seek/volume commands
│   │   │   ├── library.rs   # scan/search/list commands
│   │   │   ├── lyrics.rs    # generate/translate/load commands
│   │   │   └── settings.rs  # preferences read/write
│   │   └── state.rs         # Global AppState (Arc<Mutex<...>>)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                     # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Player/          # Bottom player bar
│   │   ├── Library/         # Track list, album grid
│   │   ├── LyricsPanel/     # Synchronized lyrics display
│   │   ├── Sidebar/         # Navigation
│   │   └── Settings/        # Preferences UI
│   ├── stores/              # Zustand stores
│   │   ├── playerStore.ts
│   │   ├── libraryStore.ts
│   │   └── settingsStore.ts
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   └── tauri.ts         # Type-safe Tauri invoke wrappers
│   └── styles/
│       └── globals.css      # Tailwind base + CSS variables
├── package.json
├── vite.config.ts
├── tsconfig.json
└── AGENTS.md                # This file
```

---

## 2. Core Principles (Non-Negotiable)

### 2.1 Local-First, Privacy-First
- All music processing happens on-device by default
- No telemetry, no analytics, no crash reporting without explicit opt-in
- Network requests only occur for: LLM translation API (opt-in, user-configured), cover art fallback fetch (opt-in)
- User data (library DB, lyrics cache, settings) lives in the OS standard app data directory, never in the project folder

### 2.2 Rust Safety Standards
- `#![deny(unsafe_code)]` at crate root — no `unsafe` blocks without a dedicated `// SAFETY:` comment reviewed by maintainer
- All public functions must handle errors via `Result<T, E>`, never `unwrap()` or `expect()` in non-test code
- Use `thiserror` for error types, `anyhow` only at command boundaries where context is added
- No `Arc<Mutex<T>>` held across `.await` points — restructure to avoid deadlock risk

### 2.3 Frontend Constraints
- Zero runtime CSS-in-JS — Tailwind only, no styled-components, no emotion
- No `any` in TypeScript — `unknown` with type guards when type is truly unknown
- All Tauri `invoke()` calls go through `src/lib/tauri.ts` wrappers, never called raw in components
- State lives in Zustand stores — components are dumb, stores own logic
- No `useEffect` for data fetching — use Tauri event listeners or Zustand actions

### 2.4 Performance Targets
- App cold start to playback-ready: < 2 seconds
- Library scan: > 500 tracks/second on a modern SSD
- UI thread never blocked — all heavy work (scan, decode, whisper) runs in Tauri async commands or spawned threads
- Memory ceiling: < 150 MB RSS at rest with a 10,000-track library loaded

---

## 3. Rust Backend Specification

### 3.1 Dependencies (Cargo.toml — locked versions)

```toml
[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
tauri-plugin-store = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
thiserror = "1"

# Audio
symphonia = { version = "0.5", features = ["all"] }
rodio = { version = "0.17", default-features = false, features = ["symphonia-all"] }
cpal = "0.15"

# Library / DB
rusqlite = { version = "0.31", features = ["bundled"] }
walkdir = "2"
lofty = "0.21"          # Tag reading: ID3v2, Vorbis, FLAC, MP4

# Lyrics / AI
whisper-rs = { version = "0.11", optional = true }
reqwest = { version = "0.12", features = ["json"], optional = true }

# Utilities
parking_lot = "0.12"
once_cell = "1"
image = { version = "0.25", features = ["jpeg", "png", "webp"] }
base64 = "0.22"

[features]
default = []
ai = ["whisper-rs", "reqwest"]
```

### 3.2 Audio Engine (`audio/engine.rs`)

The audio engine is the heart of the app. Follow these rules strictly:

**Playback state machine:**
```
Stopped → Loading → Playing ↔ Paused → Stopped
                              ↓
                           Finished → (next track)
```

- `Engine` struct owns a `rodio::Sink` and a `rodio::OutputStream`
- Decode happens on a dedicated `tokio::task::spawn_blocking` thread via `symphonia`
- Position tracking: poll `sink.len()` + elapsed time calculation, emit `player://position` Tauri event every 500ms
- Gapless playback: pre-decode next track into a buffer when current track is within 10 seconds of end
- ReplayGain: read `REPLAYGAIN_TRACK_GAIN` tag, apply gain as f32 multiplier before pushing to sink

**Commands exposed:**
```rust
#[tauri::command]
async fn play(state: State<'_, AppState>, path: String) -> Result<(), String>

#[tauri::command]
async fn pause(state: State<'_, AppState>) -> Result<(), String>

#[tauri::command]
async fn seek(state: State<'_, AppState>, position_ms: u64) -> Result<(), String>

#[tauri::command]
async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String>
// volume: 0.0 to 1.0, stored to settings on change

#[tauri::command]
async fn get_player_state(state: State<'_, AppState>) -> Result<PlayerState, String>
```

**PlayerState (serialized to frontend):**
```rust
#[derive(Serialize, Clone)]
pub struct PlayerState {
    pub status: PlayStatus,        // "stopped" | "loading" | "playing" | "paused"
    pub current_track: Option<TrackId>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub shuffle: bool,
    pub repeat: RepeatMode,        // "none" | "one" | "all"
}
```

### 3.3 Library Scanner (`library/scanner.rs`)

- Entry point: `scan_directory(path: &Path, db: &Database) -> Result<ScanResult>`
- Use `walkdir` with `follow_links: false`, `max_depth: 20`
- Supported extensions: `mp3`, `flac`, `m4a`, `aac`, `ogg`, `opus`, `wav`, `aiff`, `ape`, `wv`
- For each file: read tags with `lofty`, hash file path for stable `TrackId` (blake3 of canonical path)
- Upsert into SQLite — re-scan is idempotent
- Emit `library://scan-progress` event every 50 tracks with `{ scanned: u32, total: u32, current_file: String }`
- After scan: emit `library://scan-complete` with `ScanResult { added: u32, updated: u32, removed: u32 }`

**Track schema (SQLite):**
```sql
CREATE TABLE IF NOT EXISTS tracks (
    id          TEXT PRIMARY KEY,   -- blake3 hash of path
    path        TEXT NOT NULL UNIQUE,
    title       TEXT,
    artist      TEXT,
    album       TEXT,
    album_artist TEXT,
    track_number INTEGER,
    disc_number  INTEGER,
    year        INTEGER,
    genre       TEXT,
    duration_ms INTEGER,
    sample_rate INTEGER,
    bit_depth   INTEGER,
    bitrate     INTEGER,
    file_size   INTEGER,
    has_cover   INTEGER DEFAULT 0,
    cover_cache_path TEXT,
    date_added  INTEGER NOT NULL,   -- unix timestamp
    date_modified INTEGER NOT NULL,
    play_count  INTEGER DEFAULT 0,
    last_played INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title, artist, album, content=tracks, content_rowid=rowid
);
```

### 3.4 Lyrics Engine (`lyrics/`)

**Priority chain (highest to lowest):**
1. Embedded lyrics tag (`LYRICS` / `USLT` in ID3)
2. `.lrc` sidecar file (same directory, same filename)
3. Whisper local inference (AI feature, user-triggered)
4. Translation layer (applied on top of any lyrics source)

**LRC format support:**
- Parse `[mm:ss.xx]` timestamps with 10ms precision
- Support extended LRC with word-level timestamps `<mm:ss.xx>word`
- Writer must produce valid LRC on export

**Whisper integration (feature-gated):**
```rust
#[cfg(feature = "ai")]
pub async fn generate_lyrics(
    audio_path: &Path,
    model: WhisperModel,  // Tiny | Base | Small | Medium
    language: Option<String>,
) -> Result<Vec<LrcLine>>
```
- Default model: `Base` (good balance of speed/accuracy, ~150MB)
- Run in `spawn_blocking` — never block async runtime
- Cache result as `.lrc` sidecar after generation
- Emit `lyrics://progress` events during generation: `{ percent: f32, stage: String }`

**Translation:**
- Configurable provider: OpenAI-compatible API (user supplies base URL + API key in settings)
- Translate line-by-line in batches of 20 to reduce API calls
- Cache translations in SQLite: `CREATE TABLE lyrics_translations (track_id TEXT, source_lang TEXT, target_lang TEXT, original TEXT, translated TEXT)`
- Display mode: `original_only | translated_only | bilingual` (user preference)

### 3.5 AppState

```rust
pub struct AppState {
    pub audio: parking_lot::Mutex<AudioEngine>,
    pub library: parking_lot::Mutex<Library>,
    pub db: parking_lot::Mutex<Database>,
    pub queue: parking_lot::RwLock<PlayQueue>,
    pub settings: parking_lot::RwLock<Settings>,
}
```

- `AppState` is registered as Tauri managed state in `main.rs`
- Lock granularity: never hold two locks simultaneously (deadlock prevention)
- Settings changes: write to `tauri-plugin-store` JSON file immediately on mutation

---

## 4. Frontend Specification

### 4.1 Design System

**Typography:**
- UI font: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- Monospace (timestamps, bitrate): `"JetBrains Mono", monospace`
- Font sizes: 11px (metadata), 13px (secondary), 15px (primary), 18px (title), 24px (display)

**Color tokens (CSS variables, defined in `globals.css`):**
```css
:root {
  --bg-base: #0f0f0f;
  --bg-surface: #1a1a1a;
  --bg-elevated: #242424;
  --bg-hover: #2e2e2e;
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --text-primary: rgba(255,255,255,0.92);
  --text-secondary: rgba(255,255,255,0.55);
  --text-muted: rgba(255,255,255,0.3);
  --accent: #a78bfa;        /* violet-400 — brand color */
  --accent-dim: #7c3aed;
  --danger: #f87171;
  --success: #34d399;
  --waveform: rgba(167,139,250,0.6);
}
```

**Dark-only UI** — Melodist is intentionally dark-mode only. Do not implement light mode. The design philosophy is "music player as ambient object."

**Spacing scale**: 4px base unit. Use multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48px.

**Border radius**: 4px (inputs), 8px (cards, buttons), 12px (panels), 9999px (pills, sliders).

**Animations:**
- Duration: 150ms for micro-interactions, 250ms for panel transitions
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions
- No animation when `prefers-reduced-motion: reduce` is set — always check this

### 4.2 Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Sidebar (220px fixed)  │  Main Content          │
│  ─────────────────────  │  ─────────────────────  │
│  Library                │  [Track List / Album   │
│  Albums                 │   Grid / Now Playing]  │
│  Artists                │                        │
│  Playlists              │                        │
│  ─────────────────────  │                        │
│  Settings               │                        │
├─────────────────────────────────────────────────┤
│  Player Bar (80px fixed bottom)                 │
│  [Cover] [Track Info] [Controls] [Progress]     │
│  [Volume] [Shuffle] [Repeat] [Lyrics Toggle]    │
└─────────────────────────────────────────────────┘
```

- Sidebar: `w-[220px] shrink-0`, collapsible to icon-only at `w-[56px]`
- Player bar: `h-[80px]`, `position: fixed bottom-0`, always visible
- Main content: `overflow-y-auto`, padding-bottom accounts for player bar height
- Lyrics panel: slides in from right as overlay panel, `w-[380px]`, backdrop blur

### 4.3 Component Rules

**Player Bar (`components/Player/`):**
- Cover art: 48×48px, `rounded-lg`, click to open Now Playing full view
- Progress bar: custom `<input type="range">` styled with CSS, draggable, shows hover time tooltip
- Volume: identical range input, remember last value in `playerStore`
- Keyboard shortcuts (global, registered via Tauri global shortcut plugin):
  - `Space`: play/pause
  - `←` / `→`: seek ±10s
  - `↑` / `↓`: volume ±5%
  - `N` / `P`: next / previous track
  - `L`: toggle lyrics panel
  - `S`: toggle shuffle
  - `R`: cycle repeat mode

**Track List (`components/Library/TrackList.tsx`):**
- Virtualized with `@tanstack/react-virtual` — mandatory for libraries > 500 tracks
- Row height: 52px fixed
- Columns: `#` (track number) | Cover (32px) | Title + Artist | Album | Duration | Actions (…)
- Double-click: play immediately, replace queue
- Right-click: context menu — Add to queue / Play next / Add to playlist / Show in Finder / Get info

**Lyrics Panel (`components/LyricsPanel/`):**
- Current line: `--accent` color, font-size 18px, font-weight 500
- Past lines: `--text-muted`, 15px
- Future lines: `--text-secondary`, 15px
- Auto-scroll to keep current line centered — use `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Click on a line: seek to that timestamp
- "Generate with AI" button: visible when no lyrics exist, triggers `generate_lyrics` command
- Translation toggle: appears when translated lyrics are cached

### 4.4 Zustand Store Interfaces

```typescript
// playerStore.ts
interface PlayerStore {
  status: 'stopped' | 'loading' | 'playing' | 'paused'
  currentTrack: Track | null
  positionMs: number
  durationMs: number
  volume: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
  lyricsOpen: boolean
  // Actions
  play: (track: Track) => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setVolume: (v: number) => Promise<void>
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleLyrics: () => void
}

// libraryStore.ts
interface LibraryStore {
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
  isScanning: boolean
  scanProgress: { scanned: number; total: number } | null
  searchQuery: string
  filteredTracks: Track[]
  // Actions
  scanDirectory: (path: string) => Promise<void>
  search: (query: string) => void
  loadLibrary: () => Promise<void>
}

// settingsStore.ts
interface SettingsStore {
  musicDirectories: string[]
  whisperModel: 'tiny' | 'base' | 'small' | 'medium'
  translationProvider: { baseUrl: string; apiKey: string; model: string } | null
  translationTargetLanguage: string
  lyricsDisplayMode: 'original' | 'translated' | 'bilingual'
  audioOutputDevice: string | null
  replayGainEnabled: boolean
  // Actions
  addMusicDirectory: (path: string) => Promise<void>
  removeMusicDirectory: (path: string) => Promise<void>
  save: () => Promise<void>
}
```

### 4.5 Tauri IPC Wrapper (`src/lib/tauri.ts`)

All `invoke` calls must be defined here with full TypeScript types. Components import from this file only.

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const tauriPlayer = {
  play: (path: string) => invoke<void>('play', { path }),
  pause: () => invoke<void>('pause'),
  seek: (positionMs: number) => invoke<void>('seek', { positionMs }),
  setVolume: (volume: number) => invoke<void>('set_volume', { volume }),
  getState: () => invoke<PlayerState>('get_player_state'),
}

export const tauriLibrary = {
  scan: (path: string) => invoke<void>('scan_directory', { path }),
  search: (query: string) => invoke<Track[]>('search_tracks', { query }),
  getTracks: () => invoke<Track[]>('get_all_tracks'),
  getAlbums: () => invoke<Album[]>('get_all_albums'),
}

export const tauriLyrics = {
  load: (trackId: string) => invoke<LyricsData | null>('load_lyrics', { trackId }),
  generate: (trackId: string, model: string) => invoke<void>('generate_lyrics', { trackId, model }),
  translate: (trackId: string, targetLang: string) => invoke<void>('translate_lyrics', { trackId, targetLang }),
}

// Event listeners — call in store init, not in components
export const onPositionUpdate = (cb: (ms: number) => void) =>
  listen<number>('player://position', e => cb(e.payload))

export const onScanProgress = (cb: (p: ScanProgress) => void) =>
  listen<ScanProgress>('library://scan-progress', e => cb(e.payload))
```

---

## 5. File & Code Conventions

### 5.1 Rust
- `snake_case` for functions, variables, modules
- `PascalCase` for types, traits, enums
- `SCREAMING_SNAKE_CASE` for constants
- Max function length: 50 lines — extract helpers if longer
- Every public item must have a `///` doc comment
- `mod.rs` files only re-export, never contain logic
- Group imports: std → external crates → internal modules (separated by blank lines)
- Run `cargo fmt` and `cargo clippy -- -D warnings` before every commit — CI enforces this

### 5.2 TypeScript / React
- `camelCase` for variables, functions, hooks
- `PascalCase` for components, types, interfaces
- `SCREAMING_SNAKE_CASE` for constants
- Component files: one component per file, filename matches component name
- Hook files: `use` prefix, live in `src/hooks/`
- No default exports except for page-level components and Zustand stores
- Props interfaces: `interface TrackListProps { ... }` defined in same file, above component
- All `async` functions in stores must be wrapped in try/catch, error surfaced via toast notification

### 5.3 Git Conventions
- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/` prefixes
- Commit message format: `feat(audio): add gapless playback pre-buffering`
- Scope options: `audio`, `library`, `lyrics`, `cover`, `ui`, `player`, `settings`, `ci`
- No merge commits on main — rebase only
- Every PR must pass: `cargo test`, `cargo clippy`, `cargo fmt --check`, `tsc --noEmit`, `eslint`

---

## 6. Build & Development

### 6.1 Prerequisites
```bash
# Rust toolchain
rustup toolchain install stable
rustup target add aarch64-apple-darwin x86_64-apple-darwin  # macOS universal

# Node
node >= 20 (use nvm)
pnpm >= 9

# Platform deps (Linux)
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Whisper model (optional, for AI lyrics)
# Place GGUF model files in: $APP_DATA/melodist/models/
# Download: https://huggingface.co/ggerganov/whisper.cpp
```

### 6.2 Dev Commands
```bash
pnpm install          # Install frontend deps
pnpm tauri dev        # Start dev server (hot reload)
pnpm tauri build      # Production build
cargo test            # Run Rust unit tests
cargo test --features ai  # Run with AI features enabled
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
```

### 6.3 CI (GitHub Actions)
- Trigger: push to `main`, all PRs
- Matrix: `[ubuntu-22.04, windows-2022, macos-14]`
- Steps: `cargo clippy`, `cargo test`, `tsc --noEmit`, `eslint`, `pnpm tauri build`
- Release: tag `v*` triggers build + notarization + upload to GitHub Releases

---

## 7. MVP Scope (v0.1.0)

Must have for first public release:

- [ ] Local library scan (add folder, watch for changes)
- [ ] Playback: play/pause/seek/next/prev/volume
- [ ] Play queue with shuffle and repeat
- [ ] Track list view with search
- [ ] Album grid view
- [ ] Basic artist view
- [ ] Embedded cover art display + cover cache
- [ ] LRC sidecar file loading and synchronized display
- [ ] Embedded lyrics tag display
- [ ] Settings: music directories, audio output device, volume normalization
- [ ] Keyboard shortcuts (global)
- [ ] macOS / Windows / Linux builds via CI

Explicitly out of scope for v0.1.0:

- Whisper AI lyrics generation (v0.2.0)
- Translation (v0.2.0)
- Playlist management beyond queue (v0.3.0)
- Last.fm scrobbling (v0.3.0)
- Equalizer (v0.4.0)
- MusicBrainz metadata enrichment (v0.3.0)
- Mobile (never — desktop only by design)

---

## 8. Agent Behavioral Rules

These rules govern how any AI coding agent must behave when working on this codebase.

### 8.1 Before Writing Any Code
1. Read the relevant module specification in this file (Section 3 or 4)
2. Check existing types in `state.rs` and `src/lib/tauri.ts` — do not duplicate types
3. If adding a new Tauri command, add its wrapper to `src/lib/tauri.ts` in the same PR
4. If modifying the SQLite schema, write a migration — never drop and recreate tables

### 8.2 What Agents Must Never Do
- Never use `unwrap()` or `expect()` outside of test modules
- Never block the Tokio async runtime with synchronous I/O — use `spawn_blocking`
- Never add a dependency without checking it compiles on all three target platforms
- Never write to `localStorage` or `sessionStorage` in the frontend — Tauri Store plugin only
- Never hardcode paths — use Tauri's `app_data_dir()` / `audio_dir()` APIs
- Never add a feature that requires always-on internet connectivity
- Never commit `Cargo.lock` changes for Rust without running `cargo update` explicitly
- Never modify `tauri.conf.json` `allowlist` to add permissions without a comment explaining why

### 8.3 Error Handling Pattern
```rust
// Correct pattern for Tauri commands
#[tauri::command]
async fn example_command(state: State<'_, AppState>) -> Result<SomeType, String> {
    let result = do_something()
        .await
        .map_err(|e| format!("Failed to do something: {e}"))?;
    Ok(result)
}

// Never do this
#[tauri::command]
async fn bad_command(state: State<'_, AppState>) -> SomeType {
    do_something().await.unwrap()  // FORBIDDEN
}
```

### 8.4 Adding New Features
1. Feature must fit within the "local-first, privacy-first" principle (Section 2.1)
2. If it requires network access: must be opt-in, clearly documented in Settings UI
3. If it's AI-related: gate behind `[features] ai` in Cargo.toml
4. Write a unit test for any pure function with non-trivial logic
5. Update this AGENTS.md if the architecture changes

### 8.5 PR Checklist (agent must verify before declaring task done)
- [ ] `cargo fmt --check` passes
- [ ] `cargo clippy -- -D warnings` passes (no new warnings)
- [ ] `cargo test` passes
- [ ] `tsc --noEmit` passes
- [ ] No `unwrap()` / `expect()` added outside tests
- [ ] No new `unsafe` blocks without `// SAFETY:` comment
- [ ] New Tauri commands have corresponding wrappers in `src/lib/tauri.ts`
- [ ] New UI components follow the design system (Section 4.1)
- [ ] AGENTS.md updated if architecture changed

---

## 9. Reference: Key Data Types

```typescript
// Shared types (src/types.ts) — these must match Rust serialization exactly

interface Track {
  id: string              // blake3 hash
  path: string
  title: string | null
  artist: string | null
  album: string | null
  albumArtist: string | null
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  genre: string | null
  durationMs: number
  sampleRate: number
  bitDepth: number | null
  bitrate: number | null
  fileSize: number
  hasCover: boolean
  coverCachePath: string | null
  dateAdded: number       // unix timestamp
  playCount: number
  lastPlayed: number | null
}

interface Album {
  name: string
  artist: string | null
  year: number | null
  trackCount: number
  coverCachePath: string | null
  tracks: Track[]
}

interface LyricsData {
  source: 'embedded' | 'lrc_file' | 'generated' | 'manual'
  lines: LrcLine[]
  hasTranslation: boolean
  translationLanguage: string | null
}

interface LrcLine {
  timestampMs: number
  text: string
  translatedText: string | null
  wordTimestamps: WordTimestamp[] | null  // extended LRC
}

interface ScanProgress {
  scanned: number
  total: number
  currentFile: string
}
```

---

*AGENTS.md version: 1.0.0 — maintained by MetaPure Lab*  
*Last updated: 2026-05*  
*Questions about this spec: open a GitHub Discussion, not an Issue*
