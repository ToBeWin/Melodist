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
    await get().save()
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
    await get().save()
  },
  toggleAiTranslation: async () => {
    set((state) => ({
      translationProvider: state.translationProvider
        ? null
        : { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
    }))
    await get().save()
  },
  toggleCoverArtFallback: async () => {
    set((state) => ({ coverArtFallbackEnabled: !state.coverArtFallbackEnabled }))
    await get().save()
  },
  toggleMetadataNetwork: async () => {
    set((state) => ({ metadataNetworkEnabled: !state.metadataNetworkEnabled }))
    await get().save()
  },
  setWhisperModel: async (model) => {
    set({ whisperModel: model })
    await get().save()
  },
  setTranslationTargetLanguage: async (language) => {
    set({ translationTargetLanguage: language })
    await get().save()
  },
  setTranslationProviderField: async (field, value) => {
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
    await get().save()
  },
  setLyricsDisplayMode: async (mode) => {
    set({ lyricsDisplayMode: mode })
    await get().save()
  },
  setLyricsOffsetMs: async (offsetMs) => {
    set({ lyricsOffsetMs: Math.trunc(offsetMs) })
    await get().save()
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
    await get().save()
  },
  setPlaybackSession: async (queuePaths, queueIndex, positionMs, shuffle, repeat) => {
    set({
      playbackQueuePaths: queuePaths,
      playbackQueueIndex: queueIndex,
      playbackPositionMs: Math.max(0, Math.floor(positionMs)),
      playbackShuffle: shuffle,
      playbackRepeat: repeat,
    })
    await get().save()
  },
  setStoredVolume: async (volume) => {
    set({ volume: clampVolume(volume) })
    await get().save()
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
