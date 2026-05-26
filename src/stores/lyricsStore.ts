import { create } from 'zustand'

import { tauriLyrics } from '../lib/tauri'
import { usePlayerStore } from './playerStore'
import type { LyricsData, Track } from '../types'

interface LyricsStore {
  activeTrackId: string | null
  data: LyricsData | null
  error: string | null
  isLoading: boolean
  loadForTrack: (track: Track | null) => Promise<void>
  saveLrcForTrack: (track: Track, contents: string) => Promise<void>
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
      const message = error instanceof Error ? error.message : 'Failed to load lyrics'
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save lyrics'
      set((state) =>
        state.activeTrackId === track.id
          ? { error: message, isLoading: false }
          : state,
      )
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
