import { create } from 'zustand'

import { translate } from '../lib/i18n'
import { tauriLyrics } from '../lib/tauri'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'
import { errorMessage, useToastStore } from './toastStore'
import type { LyricsData, Track } from '../types'

interface LyricsStore {
  activeTrackId: string | null
  data: LyricsData | null
  error: string | null
  isLoading: boolean
  loadForTrack: (track: Track | null) => Promise<void>
  saveLrcForTrack: (track: Track, contents: string) => Promise<void>
}

function localized(key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) {
  return translate(useSettingsStore.getState().appLanguage, key, params)
}

export const useLyricsStore = create<LyricsStore>((set) => ({
  activeTrackId: null,
  data: null,
  error: null,
  isLoading: false,
  loadForTrack: async (track) => {
    if (!track) {
      set({ activeTrackId: null, data: null, error: null, isLoading: false })
      return
    }

    set({ activeTrackId: track.id, data: null, error: null, isLoading: true })
    try {
      const data = await tauriLyrics.load(track.id)
      set((state) =>
        state.activeTrackId === track.id
          ? { data, error: null, isLoading: false }
          : state,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : localized('lyrics.loadFailed')
      set((state) =>
        state.activeTrackId === track.id
          ? { data: null, error: message, isLoading: false }
          : state,
      )
    }
  },
  saveLrcForTrack: async (track, contents) => {
    set({ activeTrackId: track.id, error: null, isLoading: true })
    try {
      const data = await tauriLyrics.saveLrc(track.id, contents)
      set((state) =>
        state.activeTrackId === track.id
          ? { data, error: null, isLoading: false }
          : state,
      )
      useToastStore.getState().pushToast({
        title: localized('lyrics.saveLrcComplete'),
        message: track.title ?? track.path,
        tone: 'success',
      })
    } catch (error) {
      const message = errorMessage(error) || localized('lyrics.saveLrcFailed')
      set((state) =>
        state.activeTrackId === track.id
          ? { error: message, isLoading: false }
          : state,
      )
      useToastStore.getState().pushToast({
        title: localized('lyrics.saveLrcFailed'),
        message,
        tone: 'error',
      })
    }
  },
}))

let lastTrackId: string | null = null

usePlayerStore.subscribe((state) => {
  const track = state.currentTrack
  const nextTrackId = track?.id ?? null
  if (nextTrackId === lastTrackId) return

  lastTrackId = nextTrackId
  void useLyricsStore.getState().loadForTrack(track)
})

void useLyricsStore.getState().loadForTrack(usePlayerStore.getState().currentTrack)

export default useLyricsStore
