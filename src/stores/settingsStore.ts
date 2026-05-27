import { create } from 'zustand'

import { defaultSettings, tauriLibrary, tauriPlayer, tauriSettings } from '../lib/tauri'
import { notifyError } from './toastStore'
import type { AppLanguage, AppSettings, AudioOutputDevice, DataLocations, TranslationProvider } from '../types'

type WhisperModel = AppSettings['whisperModel']
type LyricsDisplayMode = AppSettings['lyricsDisplayMode']
type TranslationProviderField = keyof TranslationProvider
type SettingsErrorTitleKey =
  | 'audioDevice'
  | 'audioDevices'
  | 'dataLocations'
  | 'load'
  | 'removeDirectory'
  | 'replayGain'
  | 'save'
  | 'volume'
  | 'watchDirectories'

interface SettingsStore {
  appLanguage: AppLanguage
  musicDirectories: string[]
  whisperModel: WhisperModel
  translationProvider: TranslationProvider | null
  translationTargetLanguage: string
  lyricsDisplayMode: LyricsDisplayMode
  lyricsOffsetMs: number
  audioOutputDevice: string | null
  volume: number
  playbackQueuePaths: string[]
  playbackQueueIndex: number | null
  playbackPositionMs: number
  playbackShuffle: boolean
  playbackRepeat: AppSettings['playbackRepeat']
  replayGainEnabled: boolean
  coverArtFallbackEnabled: boolean
  metadataNetworkEnabled: boolean
  audioOutputDevices: AudioOutputDevice[]
  dataLocations: DataLocations | null
  load: () => Promise<void>
  loadAudioOutputDevices: () => Promise<void>
  loadDataLocations: () => Promise<void>
  setAppLanguage: (language: AppLanguage) => Promise<void>
  addMusicDirectory: (path: string) => Promise<void>
  removeMusicDirectory: (path: string) => Promise<void>
  toggleReplayGain: () => Promise<void>
  toggleAiTranslation: () => Promise<void>
  toggleCoverArtFallback: () => Promise<void>
  toggleMetadataNetwork: () => Promise<void>
  setWhisperModel: (model: WhisperModel) => Promise<void>
  setTranslationTargetLanguage: (language: string) => Promise<void>
  setTranslationProviderField: (field: TranslationProviderField, value: string) => Promise<void>
  setLyricsDisplayMode: (mode: LyricsDisplayMode) => Promise<void>
  setLyricsOffsetMs: (offsetMs: number) => Promise<void>
  setAudioOutputDevice: (deviceId: string | null) => Promise<void>
  setPlaybackSession: (
    queuePaths: string[],
    queueIndex: number | null,
    positionMs: number,
    shuffle: boolean,
    repeat: AppSettings['playbackRepeat'],
  ) => Promise<void>
  setStoredVolume: (volume: number) => Promise<void>
  save: () => Promise<void>
}

const selectSettings = (state: SettingsStore): AppSettings => ({
  appLanguage: state.appLanguage,
  musicDirectories: state.musicDirectories,
  whisperModel: state.whisperModel,
  translationProvider: state.translationProvider,
  translationTargetLanguage: state.translationTargetLanguage,
  lyricsDisplayMode: state.lyricsDisplayMode,
  lyricsOffsetMs: Math.trunc(state.lyricsOffsetMs),
  audioOutputDevice: state.audioOutputDevice,
  volume: state.volume,
  playbackQueuePaths: state.playbackQueuePaths,
  playbackQueueIndex: state.playbackQueueIndex,
  playbackPositionMs: Math.max(0, Math.floor(state.playbackPositionMs)),
  playbackShuffle: state.playbackShuffle,
  playbackRepeat: state.playbackRepeat,
  replayGainEnabled: state.replayGainEnabled,
  coverArtFallbackEnabled: state.coverArtFallbackEnabled,
  metadataNetworkEnabled: state.metadataNetworkEnabled,
})

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume))
const normalizeAppLanguage = (language: string): AppLanguage => (language === 'zh-CN' ? 'zh-CN' : 'en')
const normalizeRepeat = (repeat: string): AppSettings['playbackRepeat'] =>
  repeat === 'one' || repeat === 'all' ? repeat : 'none'

const settingsErrorTitles: Record<AppLanguage, Record<SettingsErrorTitleKey, string>> = {
  en: {
    audioDevice: 'Audio output update failed',
    audioDevices: 'Audio output devices failed to load',
    dataLocations: 'Data locations failed to load',
    load: 'Settings failed to load',
    removeDirectory: 'Directory removal failed',
    replayGain: 'ReplayGain update failed',
    save: 'Settings failed to save',
    volume: 'Volume restore failed',
    watchDirectories: 'Library watcher setup failed',
  },
  'zh-CN': {
    audioDevice: '音频输出更新失败',
    audioDevices: '音频输出设备加载失败',
    dataLocations: '数据位置加载失败',
    load: '设置加载失败',
    removeDirectory: '目录移除失败',
    replayGain: 'ReplayGain 更新失败',
    save: '设置保存失败',
    volume: '音量恢复失败',
    watchDirectories: '曲库监听启动失败',
  },
}

function localizedSettingsErrorTitle(key: SettingsErrorTitleKey) {
  return settingsErrorTitles[useSettingsStore.getState().appLanguage][key]
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaultSettings,
  audioOutputDevices: [],
  dataLocations: null,
  load: async () => {
    let settings: AppSettings
    try {
      settings = await tauriSettings.load()
    } catch (error) {
      console.error('Failed to load settings', error)
      notifyError(localizedSettingsErrorTitle('load'), error)
      return
    }

    const volume = clampVolume(settings.volume)
    set({
      ...settings,
      appLanguage: normalizeAppLanguage(settings.appLanguage),
      playbackRepeat: normalizeRepeat(settings.playbackRepeat),
      volume,
    })

    try {
      await tauriPlayer.setVolume(volume)
    } catch (error) {
      console.error('Failed to restore volume', error)
      notifyError(localizedSettingsErrorTitle('volume'), error)
    }

    try {
      await tauriPlayer.setReplayGainEnabled(settings.replayGainEnabled)
    } catch (error) {
      console.error('Failed to restore ReplayGain', error)
      notifyError(localizedSettingsErrorTitle('replayGain'), error)
    }

    try {
      await tauriPlayer.setAudioOutputDevice(settings.audioOutputDevice)
    } catch (error) {
      set({ audioOutputDevice: null })
      console.error('Failed to restore audio output device', error)
      notifyError(localizedSettingsErrorTitle('audioDevice'), error)
      await get().save()
    }

    try {
      await tauriLibrary.watchDirectories(settings.musicDirectories)
    } catch (error) {
      console.error('Failed to watch library directories', error)
      notifyError(localizedSettingsErrorTitle('watchDirectories'), error)
    }
  },
  loadAudioOutputDevices: async () => {
    try {
      const audioOutputDevices = await tauriPlayer.listAudioOutputDevices()
      set({ audioOutputDevices })
    } catch (error) {
      console.error('Failed to load audio output devices', error)
      notifyError(localizedSettingsErrorTitle('audioDevices'), error)
    }
  },
  loadDataLocations: async () => {
    try {
      const dataLocations = await tauriSettings.getDataLocations()
      set({ dataLocations })
    } catch (error) {
      console.error('Failed to load data locations', error)
      notifyError(localizedSettingsErrorTitle('dataLocations'), error)
    }
  },
  setAppLanguage: async (language) => {
    const previousAppLanguage = get().appLanguage
    set({ appLanguage: language })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ appLanguage: previousAppLanguage })
      console.error('Failed to save app language', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  addMusicDirectory: async (path) => {
    const previousDirectories = get().musicDirectories
    set((state) => ({
      musicDirectories: state.musicDirectories.includes(path)
        ? state.musicDirectories
        : [...state.musicDirectories, path],
    }))
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ musicDirectories: previousDirectories })
      console.error('Failed to save music directory', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  removeMusicDirectory: async (path) => {
    const previousDirectories = get().musicDirectories
    if (!previousDirectories.includes(path)) return

    set((state) => ({ musicDirectories: state.musicDirectories.filter((directory) => directory !== path) }))
    try {
      await tauriLibrary.removeDirectory(path)
    } catch (error) {
      set({ musicDirectories: previousDirectories })
      console.error('Failed to remove library directory', error)
      notifyError(localizedSettingsErrorTitle('removeDirectory'), error)
      return
    }
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      console.error('Failed to save directory removal', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  toggleReplayGain: async () => {
    const previousReplayGainEnabled = get().replayGainEnabled
    const enabled = !previousReplayGainEnabled
    set({ replayGainEnabled: enabled })
    try {
      await tauriPlayer.setReplayGainEnabled(enabled)
    } catch (error) {
      set({ replayGainEnabled: previousReplayGainEnabled })
      console.error('Failed to set ReplayGain', error)
      notifyError(localizedSettingsErrorTitle('replayGain'), error)
      return
    }
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ replayGainEnabled: previousReplayGainEnabled })
      try {
        await tauriPlayer.setReplayGainEnabled(previousReplayGainEnabled)
      } catch (revertError) {
        console.error('Failed to restore ReplayGain after settings save failure', revertError)
      }
      console.error('Failed to save ReplayGain setting', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  toggleAiTranslation: async () => {
    const previousTranslationProvider = get().translationProvider
    set((state) => ({
      translationProvider: state.translationProvider
        ? null
        : { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
    }))
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ translationProvider: previousTranslationProvider })
      console.error('Failed to save AI translation setting', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  toggleCoverArtFallback: async () => {
    const previousCoverArtFallbackEnabled = get().coverArtFallbackEnabled
    set((state) => ({ coverArtFallbackEnabled: !state.coverArtFallbackEnabled }))
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ coverArtFallbackEnabled: previousCoverArtFallbackEnabled })
      console.error('Failed to save cover art fallback setting', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  toggleMetadataNetwork: async () => {
    const previousMetadataNetworkEnabled = get().metadataNetworkEnabled
    set((state) => ({ metadataNetworkEnabled: !state.metadataNetworkEnabled }))
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ metadataNetworkEnabled: previousMetadataNetworkEnabled })
      console.error('Failed to save metadata network setting', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setWhisperModel: async (model) => {
    const previousWhisperModel = get().whisperModel
    set({ whisperModel: model })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ whisperModel: previousWhisperModel })
      console.error('Failed to save whisper model', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setTranslationTargetLanguage: async (language) => {
    const previousTranslationTargetLanguage = get().translationTargetLanguage
    set({ translationTargetLanguage: language })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ translationTargetLanguage: previousTranslationTargetLanguage })
      console.error('Failed to save translation target language', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setTranslationProviderField: async (field, value) => {
    const previousTranslationProvider = get().translationProvider
    set((state) => ({
      translationProvider: {
        ...(state.translationProvider ?? {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o-mini',
        }),
        [field]: value,
      },
    }))
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ translationProvider: previousTranslationProvider })
      console.error('Failed to save translation provider', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setLyricsDisplayMode: async (mode) => {
    const previousLyricsDisplayMode = get().lyricsDisplayMode
    set({ lyricsDisplayMode: mode })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ lyricsDisplayMode: previousLyricsDisplayMode })
      console.error('Failed to save lyrics display mode', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setLyricsOffsetMs: async (offsetMs) => {
    const previousLyricsOffsetMs = get().lyricsOffsetMs
    set({ lyricsOffsetMs: Math.trunc(offsetMs) })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ lyricsOffsetMs: previousLyricsOffsetMs })
      console.error('Failed to save lyrics offset', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setAudioOutputDevice: async (deviceId) => {
    const previousAudioOutputDevice = get().audioOutputDevice
    set({ audioOutputDevice: deviceId })
    try {
      await tauriPlayer.setAudioOutputDevice(deviceId)
    } catch (error) {
      set({ audioOutputDevice: previousAudioOutputDevice })
      console.error('Failed to set audio output device', error)
      notifyError(localizedSettingsErrorTitle('audioDevice'), error)
      return
    }
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ audioOutputDevice: previousAudioOutputDevice })
      try {
        await tauriPlayer.setAudioOutputDevice(previousAudioOutputDevice)
      } catch (revertError) {
        console.error('Failed to restore audio output device after settings save failure', revertError)
      }
      console.error('Failed to save audio output device', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setPlaybackSession: async (queuePaths, queueIndex, positionMs, shuffle, repeat) => {
    const previousSession = {
      playbackQueuePaths: get().playbackQueuePaths,
      playbackQueueIndex: get().playbackQueueIndex,
      playbackPositionMs: get().playbackPositionMs,
      playbackShuffle: get().playbackShuffle,
      playbackRepeat: get().playbackRepeat,
    }
    set({
      playbackQueuePaths: queuePaths,
      playbackQueueIndex: queueIndex,
      playbackPositionMs: Math.max(0, Math.floor(positionMs)),
      playbackShuffle: shuffle,
      playbackRepeat: repeat,
    })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set(previousSession)
      console.error('Failed to save playback session', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  setStoredVolume: async (volume) => {
    const previousVolume = get().volume
    set({ volume: clampVolume(volume) })
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      set({ volume: previousVolume })
      console.error('Failed to save stored volume', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
  save: async () => {
    try {
      const saved = await tauriSettings.save(selectSettings(get()))
      set(saved)
    } catch (error) {
      console.error('Failed to save settings', error)
      notifyError(localizedSettingsErrorTitle('save'), error)
    }
  },
}))

void useSettingsStore.getState().load()
void useSettingsStore.getState().loadAudioOutputDevices()
void useSettingsStore.getState().loadDataLocations()

export default useSettingsStore
