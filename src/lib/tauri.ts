import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { register, unregister, type ShortcutHandler } from '@tauri-apps/plugin-global-shortcut'
import { getCurrentWindow, type DragDropEvent } from '@tauri-apps/api/window'

import type {
  Album,
  AppSettings,
  AudioOutputDevice,
  DataLocations,
  LyricsData,
  PlayerState,
  ScanProgress,
  ScanResult,
  Track,
} from '../types'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

const isTauriRuntime = () => typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined

const invokeTauri = <T>(command: string, args: Record<string, unknown> | undefined, browserFallback: T) => {
  if (!isTauriRuntime()) return Promise.resolve(browserFallback)
  return invoke<T>(command, args)
}

export const toAssetUrl = (path: string | null | undefined) => {
  if (!path || !isTauriRuntime()) return null
  return convertFileSrc(path)
}

export const tauriPlayer = {
  play: (path: string) => invokeTauri<void>('play', { path }, undefined),
  setQueue: (paths: string[], startIndex: number) =>
    invokeTauri<PlayerState>('set_queue', { paths, startIndex }, {
      status: paths[startIndex] ? 'playing' : 'stopped',
      currentTrack: paths[startIndex] ?? null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  updateQueue: (paths: string[], currentIndex: number) =>
    invokeTauri<PlayerState>('update_queue', { paths, currentIndex }, {
      status: 'stopped',
      currentTrack: paths[currentIndex] ?? null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  nextTrack: () =>
    invokeTauri<PlayerState>('next_track', undefined, {
      status: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  previousTrack: () =>
    invokeTauri<PlayerState>('previous_track', undefined, {
      status: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  pause: () => invokeTauri<void>('pause', undefined, undefined),
  seek: (positionMs: number) => invokeTauri<void>('seek', { positionMs }, undefined),
  setVolume: (volume: number) => invokeTauri<void>('set_volume', { volume }, undefined),
  setReplayGainEnabled: (enabled: boolean) => invokeTauri<PlayerState>('set_replay_gain_enabled', { enabled }, {
    status: 'stopped',
    currentTrack: null,
    positionMs: 0,
    durationMs: 0,
    volume: 0.72,
    shuffle: false,
    repeat: 'none',
  }),
  listAudioOutputDevices: () => invokeTauri<AudioOutputDevice[]>('list_audio_output_devices', undefined, []),
  setAudioOutputDevice: (deviceId: string | null) =>
    invokeTauri<PlayerState>('set_audio_output_device', { deviceId }, {
      status: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  toggleShuffle: () =>
    invokeTauri<PlayerState>('toggle_shuffle', undefined, {
      status: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  cycleRepeat: () =>
    invokeTauri<PlayerState>('cycle_repeat', undefined, {
      status: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.72,
      shuffle: false,
      repeat: 'none',
    }),
  getState: () => invokeTauri<PlayerState>('get_player_state', undefined, {
    status: 'stopped',
    currentTrack: null,
    positionMs: 0,
    durationMs: 0,
    volume: 0.72,
    shuffle: false,
    repeat: 'none',
  }),
}

export const tauriLibrary = {
  scan: (path: string) =>
    invokeTauri<ScanResult>('scan_directory', { path }, {
      added: 0,
      updated: 0,
      removed: 0,
      failed: 0,
      importedLyrics: 0,
      failures: [],
      importedDirectories: [],
    }),
  importDroppedPaths: (paths: string[]) =>
    invokeTauri<ScanResult>('import_dropped_paths', { paths }, {
      added: 0,
      updated: 0,
      removed: 0,
      failed: 0,
      importedLyrics: 0,
      failures: [],
      importedDirectories: [],
    }),
  watchDirectories: (paths: string[]) => invokeTauri<void>('watch_library_directories', { paths }, undefined),
  removeDirectory: (path: string) =>
    invokeTauri<ScanResult>('remove_library_directory', { path }, {
      added: 0,
      updated: 0,
      removed: 0,
      failed: 0,
      importedLyrics: 0,
      failures: [],
      importedDirectories: [],
    }),
  search: (query: string) => invokeTauri<Track[]>('search_tracks', { query }, []),
  getTracks: () => invokeTauri<Track[]>('get_all_tracks', undefined, []),
  getAlbums: () => invokeTauri<Album[]>('get_all_albums', undefined, []),
  showInFileManager: (path: string) => invokeTauri<void>('show_in_file_manager', { path }, undefined),
}

export const tauriDialog = {
  openMusicDirectory: async () => {
    if (!isTauriRuntime()) return null
    const selected = await open({
      title: 'Add Music Folder',
      directory: true,
      multiple: false,
      recursive: true,
      canCreateDirectories: false,
    })
    return typeof selected === 'string' ? selected : null
  },
}

export const tauriGlobalShortcuts = {
  register: (shortcut: string, handler: ShortcutHandler) => {
    if (!isTauriRuntime()) return Promise.resolve()
    return register(shortcut, handler)
  },
  unregister: (shortcuts: string[]) => {
    if (!isTauriRuntime() || shortcuts.length === 0) return Promise.resolve()
    return unregister(shortcuts)
  },
}

export const tauriLyrics = {
  load: (trackId: string) => invokeTauri<LyricsData | null>('load_lyrics', { trackId }, null),
  saveLrc: (trackId: string, contents: string) => invokeTauri<LyricsData>('save_lrc', { trackId, contents }, {
    source: 'lrc_file',
    lines: [],
    hasTranslation: false,
    translationLanguage: null,
  }),
  generate: (trackId: string, model: string) => invokeTauri<void>('generate_lyrics', { trackId, model }, undefined),
  translate: (trackId: string, targetLang: string) =>
    invokeTauri<void>('translate_lyrics', { trackId, targetLang }, undefined),
}

export const defaultSettings: AppSettings = {
  appLanguage: 'en',
  musicDirectories: [],
  whisperModel: 'base',
  translationProvider: null,
  translationTargetLanguage: 'zh-CN',
  lyricsDisplayMode: 'original',
  lyricsOffsetMs: 0,
  audioOutputDevice: null,
  volume: 0.72,
  playbackQueuePaths: [],
  playbackQueueIndex: null,
  playbackPositionMs: 0,
  playbackShuffle: false,
  playbackRepeat: 'none',
  replayGainEnabled: true,
  coverArtFallbackEnabled: false,
  metadataNetworkEnabled: false,
}

export const tauriSettings = {
  load: () => invokeTauri<AppSettings>('load_settings', undefined, defaultSettings),
  save: (settings: AppSettings) => invokeTauri<AppSettings>('save_settings', { settings }, settings),
  getDataLocations: () =>
    invokeTauri<DataLocations>('get_data_locations', undefined, {
      appDataDir: '',
      settingsPath: '',
      libraryDatabasePath: '',
      coverCacheDir: '',
    }),
  openAppDataDir: () => invokeTauri<void>('open_app_data_dir', undefined, undefined),
  clearCoverCache: () => invokeTauri<number>('clear_cover_cache', undefined, 0),
}

export const onPositionUpdate = (cb: (ms: number) => void) =>
  isTauriRuntime() ? listen<number>('player://position', (event) => cb(event.payload)) : Promise.resolve(() => undefined)

export const onPlayerStateUpdate = (cb: (state: PlayerState) => void) =>
  isTauriRuntime() ? listen<PlayerState>('player://state', (event) => cb(event.payload)) : Promise.resolve(() => undefined)

export const onPlayerOutputError = (cb: (message: string) => void) =>
  isTauriRuntime() ? listen<string>('player://output-error', (event) => cb(event.payload)) : Promise.resolve(() => undefined)

export const onScanProgress = (cb: (progress: ScanProgress) => void) =>
  isTauriRuntime()
    ? listen<ScanProgress>('library://scan-progress', (event) => cb(event.payload))
    : Promise.resolve(() => undefined)

export const onScanComplete = (cb: (result: ScanResult) => void) =>
  isTauriRuntime()
    ? listen<ScanResult>('library://scan-complete', (event) => cb(event.payload))
    : Promise.resolve(() => undefined)

export const onLibraryWatchError = (cb: (message: string) => void) =>
  isTauriRuntime()
    ? listen<string>('library://watch-error', (event) => cb(event.payload))
    : Promise.resolve(() => undefined)

export const onWindowDragDropEvent = (cb: (event: DragDropEvent) => void) =>
  isTauriRuntime() ? getCurrentWindow().onDragDropEvent((event) => cb(event.payload)) : Promise.resolve(() => undefined)
