export interface Track {
  id: string
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
  dateAdded: number
  dateModified: number
  playCount: number
  lastPlayed: number | null
}

export interface Album {
  name: string
  artist: string | null
  year: number | null
  trackCount: number
  coverCachePath: string | null
  tracks: Track[]
}

export interface PlayerState {
  status: 'stopped' | 'loading' | 'playing' | 'paused'
  currentTrack: string | null
  positionMs: number
  durationMs: number
  volume: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
}

export interface AudioOutputDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface LyricsData {
  source: 'embedded' | 'lrc_file' | 'generated' | 'manual'
  lines: LrcLine[]
  hasTranslation: boolean
  translationLanguage: string | null
}

export interface DataLocations {
  appDataDir: string
  settingsPath: string
  libraryDatabasePath: string
  coverCacheDir: string
}

export interface LrcLine {
  timestampMs: number
  text: string
  translatedText: string | null
  wordTimestamps: WordTimestamp[] | null
}

export interface WordTimestamp {
  timestampMs: number
  word: string
}

export interface ScanProgress {
  scanned: number
  total: number
  currentFile: string
}

export interface ScanResult {
  added: number
  updated: number
  removed: number
  failed: number
  importedLyrics: number
  failures: ScanFailure[]
  importedDirectories: string[]
}

export interface ScanFailure {
  path: string
  reason: string
}

export interface TranslationProvider {
  baseUrl: string
  apiKey: string
  model: string
}

export type AppLanguage = 'en' | 'zh-CN'

export interface AppSettings {
  appLanguage: AppLanguage
  musicDirectories: string[]
  whisperModel: 'tiny' | 'base' | 'small' | 'medium'
  translationProvider: TranslationProvider | null
  translationTargetLanguage: string
  lyricsDisplayMode: 'original' | 'translated' | 'bilingual'
  lyricsOffsetMs: number
  audioOutputDevice: string | null
  volume: number
  playbackQueuePaths: string[]
  playbackQueueIndex: number | null
  playbackPositionMs: number
  playbackShuffle: boolean
  playbackRepeat: 'none' | 'one' | 'all'
  replayGainEnabled: boolean
  coverArtFallbackEnabled: boolean
  metadataNetworkEnabled: boolean
}
