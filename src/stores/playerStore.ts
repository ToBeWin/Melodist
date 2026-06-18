import { create } from 'zustand'

import { translate } from '../lib/i18n'
import { onPlayerOutputError, onPlayerStateUpdate, onPositionUpdate, tauriPlayer } from '../lib/tauri'
import {
  currentIndexAfterQueueMove,
  queueAfterAppendingTrack,
  queueAfterClearingPlayed,
  queueAfterRemovingIndex,
  queueRecoveryAfterPlaybackFailure,
  shouldPersistPlayerStateTransition,
  shouldAutoSkipOutputError,
} from '../lib/queue'
import { useLibraryStore } from './libraryStore'
import { useSettingsStore } from './settingsStore'
import { notifyError, useToastStore } from './toastStore'
import { useUiStore } from './uiStore'
import type { PlayerState, Track } from '../types'

interface PlayerStore {
  status: 'stopped' | 'loading' | 'playing' | 'paused'
  currentTrack: Track | null
  queue: Track[]
  currentIndex: number | null
  positionMs: number
  durationMs: number
  volume: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
  lyricsOpen: boolean
  play: (track: Track) => Promise<void>
  setQueueAndPlay: (tracks: Track[], startIndex: number) => Promise<void>
  addToQueue: (track: Track) => Promise<void>
  playNext: (track: Track) => Promise<void>
  removeFromQueue: (index: number) => Promise<void>
  moveQueueTrack: (index: number, direction: -1 | 1) => Promise<void>
  moveQueueTrackTo: (index: number, targetIndex: number) => Promise<void>
  clearPlayedFromQueue: () => Promise<void>
  clearQueue: () => Promise<void>
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  toggleMute: () => Promise<void>
  toggleShuffle: () => Promise<void>
  cycleRepeat: () => Promise<void>
  toggleLyrics: () => void
  closeLyrics: () => void
  restorePlaybackSession: () => Promise<void>
}

let queuePersistTimer: ReturnType<typeof window.setTimeout> | null = null
let lastPositionPersistMs = 0
let lastAudibleVolume = 0.72

function findQueueIndexByPath(queue: Track[], path: string | null) {
  if (!path) return -1
  return queue.findIndex((track) => track.path === path)
}

function applyPlayerState(state: PlayerState, queue: Track[], fallbackTrack: Track | null) {
  if (!state.currentTrack) {
    return {
      status: state.status,
      currentTrack: null,
      currentIndex: null,
      positionMs: state.positionMs,
      durationMs: state.durationMs,
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
    }
  }

  const currentIndex = findQueueIndexByPath(queue, state.currentTrack)
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : fallbackTrack

  return {
    status: state.status,
    currentTrack,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
    positionMs: state.positionMs,
    durationMs: currentTrack?.durationMs ?? state.durationMs,
    volume: state.volume,
    shuffle: state.shuffle,
    repeat: state.repeat,
  }
}

function queueForTrack(track: Track, state: PlayerStore) {
  const currentQueueIndex = state.queue.findIndex((queueTrack) => queueTrack.id === track.id)
  if (currentQueueIndex >= 0 && state.queue.length > 1) {
    return { queue: state.queue, index: currentQueueIndex }
  }

  const library = useLibraryStore.getState()
  const visibleTracks = library.filteredTracks.length > 0 ? library.filteredTracks : library.tracks
  const visibleIndex = visibleTracks.findIndex((libraryTrack) => libraryTrack.id === track.id)
  if (visibleIndex >= 0 && visibleTracks.length > 1) {
    return { queue: visibleTracks, index: visibleIndex }
  }

  return { queue: [track], index: 0 }
}

function stopAfterPlaybackError(track: Track, queue: Track[], currentIndex: number) {
  return {
    status: 'stopped' as const,
    currentTrack: track,
    queue,
    currentIndex,
    positionMs: 0,
    durationMs: track.durationMs,
  }
}

function nextLocalIndex(state: PlayerStore) {
  if (state.queue.length === 0 || state.currentIndex === null) return null
  if (state.repeat === 'one') return state.currentIndex
  if (state.currentIndex + 1 < state.queue.length) return state.currentIndex + 1
  return state.repeat === 'all' ? 0 : null
}

function previousLocalIndex(state: PlayerStore) {
  if (state.queue.length === 0 || state.currentIndex === null) return null
  if (state.repeat === 'one') return state.currentIndex
  if (state.currentIndex > 0) return state.currentIndex - 1
  return state.repeat === 'all' ? state.queue.length - 1 : null
}

interface QueueSnapshot {
  currentIndex: number | null
  positionMs: number
  queue: Track[]
  repeat: PlayerStore['repeat']
  shuffle: boolean
}

async function syncQueue(queue: Track[], currentIndex: number | null) {
  if (currentIndex === null || queue.length === 0) return true
  try {
    await tauriPlayer.updateQueue(
      queue.map((queueTrack) => queueTrack.path),
      currentIndex,
    )
    return true
  } catch (error) {
    console.error('Failed to sync queue', error)
    notifyError(localized('player.error.queueUpdate'), error)
    return false
  }
}

function restoreQueueSnapshot(snapshot: QueueSnapshot) {
  usePlayerStore.setState({
    queue: snapshot.queue,
    currentIndex: snapshot.currentIndex,
  })
  persistPlaybackSession(snapshot.queue, snapshot.currentIndex, snapshot.positionMs, snapshot.shuffle, snapshot.repeat)
}

function queueSnapshot(state: PlayerStore): QueueSnapshot {
  return {
    currentIndex: state.currentIndex,
    positionMs: state.positionMs,
    queue: state.queue,
    repeat: state.repeat,
    shuffle: state.shuffle,
  }
}

function openQueuePanel() {
  const ui = useUiStore.getState()
  ui.openQueue()
  usePlayerStore.setState({ lyricsOpen: false })
}

function persistPlaybackSession(
  queue: Track[],
  currentIndex: number | null,
  positionMs: number,
  shuffle: boolean,
  repeat: PlayerStore['repeat'],
) {
  if (queuePersistTimer) {
    window.clearTimeout(queuePersistTimer)
  }

  queuePersistTimer = window.setTimeout(() => {
    void useSettingsStore
      .getState()
      .setPlaybackSession(
        queue.map((track) => track.path),
        currentIndex,
        positionMs,
        shuffle,
        repeat,
      )
  }, 250)
}

function persistCurrentPlaybackSession() {
  const state = usePlayerStore.getState()
  persistPlaybackSession(state.queue, state.currentIndex, state.positionMs, state.shuffle, state.repeat)
}

function tracksFromSavedQueue(savedPaths: string[], libraryTracks: Track[]) {
  const tracksByPath = new Map(libraryTracks.map((track) => [track.path, track]))
  return savedPaths
    .map((path) => tracksByPath.get(path))
    .filter((track): track is Track => Boolean(track))
}

function currentLanguage() {
  return useSettingsStore.getState().appLanguage
}

function localized(key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) {
  return translate(currentLanguage(), key, params)
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  status: 'stopped',
  currentTrack: null,
  queue: [],
  currentIndex: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.72,
  shuffle: false,
  repeat: 'none',
  lyricsOpen: false,
  play: async (track) => {
    const nextQueue = queueForTrack(track, get())
    if (nextQueue.queue.length > 1) {
      await get().setQueueAndPlay(nextQueue.queue, nextQueue.index)
      return
    }

    try {
      set({ status: 'loading', currentTrack: track, queue: [track], currentIndex: 0, durationMs: track.durationMs, positionMs: 0 })
      await tauriPlayer.play(track.path)
      set({ status: 'playing' })
      persistPlaybackSession([track], 0, 0, get().shuffle, get().repeat)
      void useLibraryStore.getState().loadLibrary()
    } catch (error) {
      console.error('Failed to play track', error)
      notifyError(localized('player.error.playback'), error)
      set(stopAfterPlaybackError(track, [track], 0))
    }
  },
  setQueueAndPlay: async (tracks, startIndex) => {
    const track = tracks[startIndex]
    if (!track) return

    try {
      set({
        status: 'loading',
        currentTrack: track,
        queue: tracks,
        currentIndex: startIndex,
        durationMs: track.durationMs,
        positionMs: 0,
      })
      const playerState = await tauriPlayer.setQueue(
        tracks.map((queueTrack) => queueTrack.path),
        startIndex,
      )
      set((state) => applyPlayerState(playerState, tracks, state.currentTrack))
      persistPlaybackSession(tracks, startIndex, 0, get().shuffle, get().repeat)
      void useLibraryStore.getState().loadLibrary()
    } catch (error) {
      console.error('Failed to set queue', error)
      notifyError(localized('player.error.queuePlayback'), error)
      set(stopAfterPlaybackError(track, tracks, startIndex))
    }
  },
  addToQueue: async (track) => {
    const state = get()
    const previousQueue = queueSnapshot(state)
    const nextQueue = queueAfterAppendingTrack(state.queue, state.currentIndex, state.currentTrack, track)
    set({ queue: nextQueue.queue, currentIndex: nextQueue.currentIndex })
    persistPlaybackSession(nextQueue.queue, nextQueue.currentIndex, state.positionMs, state.shuffle, state.repeat)
    openQueuePanel()
    if (!(await syncQueue(nextQueue.queue, nextQueue.currentIndex))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  playNext: async (track) => {
    const state = get()
    const previousQueue = queueSnapshot(state)
    const insertIndex = state.currentIndex === null ? 0 : state.currentIndex + 1
    const queue = state.queue.length > 0 ? [...state.queue] : state.currentTrack ? [state.currentTrack] : []
    queue.splice(insertIndex, 0, track)
    const currentIndex = state.currentIndex ?? (state.currentTrack ? 0 : null)
    set({ queue, currentIndex })
    persistPlaybackSession(queue, currentIndex, state.positionMs, state.shuffle, state.repeat)
    openQueuePanel()
    if (!(await syncQueue(queue, currentIndex))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  removeFromQueue: async (index) => {
    const state = get()
    if (index < 0 || index >= state.queue.length) return

    const previousQueue = queueSnapshot(state)
    const nextQueue = queueAfterRemovingIndex(state.queue, state.currentIndex, index, state.currentTrack)
    const removedCurrent = state.currentIndex === index
    const keptCurrentTrack =
      Boolean(state.currentTrack) &&
      nextQueue.queue.length === 1 &&
      nextQueue.queue[0]?.id === state.currentTrack?.id &&
      state.queue.length === 1

    if (removedCurrent && !keptCurrentTrack && nextQueue.currentIndex !== null) {
      await get().setQueueAndPlay(nextQueue.queue, nextQueue.currentIndex)
      return
    }

    set({ queue: nextQueue.queue, currentIndex: nextQueue.currentIndex })
    persistPlaybackSession(nextQueue.queue, nextQueue.currentIndex, state.positionMs, state.shuffle, state.repeat)
    if (!(await syncQueue(nextQueue.queue, nextQueue.currentIndex))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  moveQueueTrack: async (index, direction) => {
    const targetIndex = index + direction
    await get().moveQueueTrackTo(index, targetIndex)
  },
  moveQueueTrackTo: async (index, targetIndex) => {
    const state = get()
    if (index < 0 || targetIndex < 0 || index >= state.queue.length || targetIndex >= state.queue.length || index === targetIndex) return

    const previousQueue = queueSnapshot(state)
    const queue = [...state.queue]
    const [track] = queue.splice(index, 1)
    if (!track) return
    queue.splice(targetIndex, 0, track)

    const currentIndex = currentIndexAfterQueueMove(state.currentIndex, index, targetIndex)

    set({ queue, currentIndex })
    persistPlaybackSession(queue, currentIndex, state.positionMs, state.shuffle, state.repeat)
    if (!(await syncQueue(queue, currentIndex))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  clearPlayedFromQueue: async () => {
    const state = get()
    const previousQueue = queueSnapshot(state)
    const nextQueue = queueAfterClearingPlayed(state.queue, state.currentIndex)
    if (nextQueue.queue === state.queue) return
    set({ queue: nextQueue.queue, currentIndex: nextQueue.currentIndex })
    persistPlaybackSession(nextQueue.queue, nextQueue.currentIndex, state.positionMs, state.shuffle, state.repeat)
    if (!(await syncQueue(nextQueue.queue, nextQueue.currentIndex))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  clearQueue: async () => {
    const state = get()
    const previousQueue = queueSnapshot(state)
    if (!state.currentTrack) {
      set({ queue: [], currentIndex: null })
      persistPlaybackSession([], null, 0, state.shuffle, state.repeat)
      return
    }
    const queue = [state.currentTrack]
    set({ queue, currentIndex: 0 })
    persistPlaybackSession(queue, 0, state.positionMs, state.shuffle, state.repeat)
    if (!(await syncQueue(queue, 0))) {
      restoreQueueSnapshot(previousQueue)
    }
  },
  nextTrack: async () => {
    const state = get()
    const localIndex = nextLocalIndex(state)
    const localTrack = localIndex === null ? state.currentTrack : state.queue[localIndex]

    try {
      const playerState = await tauriPlayer.nextTrack()
      const queue = get().queue
      if (!playerState.currentTrack && localIndex !== null && localTrack) {
        const recoveredState = await tauriPlayer.setQueue(
          queue.map((queueTrack) => queueTrack.path),
          localIndex,
        )
        set(applyPlayerState(recoveredState, queue, localTrack))
        const nextState = get()
        persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
        return
      }
      set(applyPlayerState(playerState, queue, localTrack))
      const nextState = get()
      persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
      void useLibraryStore.getState().loadLibrary()
    } catch (error) {
      console.error('Failed to advance queue', error)
      if (localIndex !== null && localTrack) {
        try {
          const queue = get().queue
          const recoveredState = await tauriPlayer.setQueue(
            queue.map((queueTrack) => queueTrack.path),
            localIndex,
          )
          set(applyPlayerState(recoveredState, queue, localTrack))
          const nextState = get()
          persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
          void useLibraryStore.getState().loadLibrary()
        } catch (recoveryError) {
          console.error('Failed to recover queue advance', recoveryError)
          notifyError(localized('player.error.nextTrack'), recoveryError)
        }
      } else {
        notifyError(localized('player.error.nextTrack'), error)
      }
    }
  },
  previousTrack: async () => {
    const state = get()
    const localIndex = previousLocalIndex(state)
    const localTrack = localIndex === null ? state.currentTrack : state.queue[localIndex]

    try {
      const playerState = await tauriPlayer.previousTrack()
      const queue = get().queue
      if (!playerState.currentTrack && localIndex !== null && localTrack) {
        const recoveredState = await tauriPlayer.setQueue(
          queue.map((queueTrack) => queueTrack.path),
          localIndex,
        )
        set(applyPlayerState(recoveredState, queue, localTrack))
        const nextState = get()
        persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
        return
      }
      set(applyPlayerState(playerState, queue, localTrack))
      const nextState = get()
      persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
      void useLibraryStore.getState().loadLibrary()
    } catch (error) {
      console.error('Failed to move back in queue', error)
      if (localIndex !== null && localTrack) {
        try {
          const queue = get().queue
          const recoveredState = await tauriPlayer.setQueue(
            queue.map((queueTrack) => queueTrack.path),
            localIndex,
          )
          set(applyPlayerState(recoveredState, queue, localTrack))
          const nextState = get()
          persistPlaybackSession(nextState.queue, nextState.currentIndex, nextState.positionMs, nextState.shuffle, nextState.repeat)
          void useLibraryStore.getState().loadLibrary()
        } catch (recoveryError) {
          console.error('Failed to recover queue previous', recoveryError)
          notifyError(localized('player.error.previousTrack'), recoveryError)
        }
      } else {
        notifyError(localized('player.error.previousTrack'), error)
      }
    }
  },
  pause: async () => {
    const previousStatus = get().status
    try {
      await tauriPlayer.pause()
      if (previousStatus === 'playing') {
        set({ status: 'paused' })
      } else if (previousStatus === 'paused') {
        set({ status: 'playing' })
      }
    } catch (error) {
      console.error('Failed to pause playback', error)
      notifyError(localized('player.error.playbackControl'), error)
    }
  },
  seek: async (positionMs) => {
    try {
      await tauriPlayer.seek(positionMs)
      set({ positionMs })
    } catch (error) {
      console.error('Failed to seek', error)
      notifyError(localized('player.error.seek'), error)
    }
  },
  setVolume: async (volume) => {
    const nextVolume = Math.min(1, Math.max(0, volume))
    const previousVolume = get().volume
    const previousAudibleVolume = lastAudibleVolume
    if (nextVolume > 0) {
      lastAudibleVolume = nextVolume
    }
    try {
      await tauriPlayer.setVolume(nextVolume)
      set({ volume: nextVolume })
      void useSettingsStore.getState().setStoredVolume(nextVolume)
    } catch (error) {
      lastAudibleVolume = previousAudibleVolume
      set({ volume: previousVolume })
      console.error('Failed to set volume', error)
      notifyError(localized('player.error.volumeUpdate'), error)
    }
  },
  toggleMute: async () => {
    const state = get()
    const nextVolume = state.volume > 0 ? 0 : lastAudibleVolume || 0.72
    await get().setVolume(nextVolume)
  },
  toggleShuffle: async () => {
    const previousShuffle = get().shuffle
    set({ shuffle: !previousShuffle })
    try {
      const playerState = await tauriPlayer.toggleShuffle()
      set((state) =>
        playerState.currentTrack
          ? applyPlayerState(playerState, state.queue, state.currentTrack)
          : { shuffle: playerState.shuffle || !previousShuffle },
      )
      persistCurrentPlaybackSession()
    } catch (error) {
      set({ shuffle: previousShuffle })
      console.error('Failed to toggle shuffle', error)
      notifyError(localized('player.error.shuffleUpdate'), error)
    }
  },
  cycleRepeat: async () => {
    const previousRepeat = get().repeat
    const nextRepeat = previousRepeat === 'none' ? 'all' : previousRepeat === 'all' ? 'one' : 'none'
    set({ repeat: nextRepeat })
    try {
      const playerState = await tauriPlayer.cycleRepeat()
      set((state) =>
        playerState.currentTrack ? applyPlayerState(playerState, state.queue, state.currentTrack) : { repeat: nextRepeat },
      )
      persistCurrentPlaybackSession()
    } catch (error) {
      set({ repeat: previousRepeat })
      console.error('Failed to cycle repeat mode', error)
      notifyError(localized('player.error.repeatUpdate'), error)
    }
  },
  toggleLyrics: () => {
    const nextLyricsOpen = !get().lyricsOpen
    if (nextLyricsOpen) {
      useUiStore.getState().closeQueue()
    }
    set({ lyricsOpen: nextLyricsOpen })
  },
  closeLyrics: () => set({ lyricsOpen: false }),
  restorePlaybackSession: async () => {
    try {
      await useSettingsStore.getState().load()
      await useLibraryStore.getState().loadLibrary()
      const settings = useSettingsStore.getState()
      const library = useLibraryStore.getState()
      const queue = tracksFromSavedQueue(settings.playbackQueuePaths, library.tracks)
      if (queue.length === 0) return

      const currentIndex =
        settings.playbackQueueIndex !== null && settings.playbackQueueIndex >= 0 && settings.playbackQueueIndex < queue.length
          ? settings.playbackQueueIndex
          : 0
      const currentTrack = queue[currentIndex] ?? queue[0]
      if (!currentTrack) return

      const restoredPositionMs = Math.min(settings.playbackPositionMs, currentTrack.durationMs)
      set({
        status: 'paused',
        currentTrack,
        queue,
        currentIndex,
        positionMs: restoredPositionMs,
        durationMs: currentTrack.durationMs,
        shuffle: settings.playbackShuffle,
        repeat: settings.playbackRepeat,
      })

      if (!(await syncQueue(queue, currentIndex))) {
        set({
          status: 'stopped',
          currentTrack: null,
          queue: [],
          currentIndex: null,
          positionMs: 0,
          durationMs: 0,
          shuffle: settings.playbackShuffle,
          repeat: settings.playbackRepeat,
        })
        persistPlaybackSession([], null, 0, settings.playbackShuffle, settings.playbackRepeat)
        return
      }

      if (settings.playbackShuffle) {
        const playerState = await tauriPlayer.toggleShuffle()
        set((state) => applyPlayerState(playerState, queue, state.currentTrack))
      }
      const repeatCycles = settings.playbackRepeat === 'all' ? 1 : settings.playbackRepeat === 'one' ? 2 : 0
      for (let cycle = 0; cycle < repeatCycles; cycle += 1) {
        const playerState = await tauriPlayer.cycleRepeat()
        set((state) => applyPlayerState(playerState, queue, state.currentTrack))
      }
      if (restoredPositionMs > 0) {
        await get().seek(restoredPositionMs)
      }
    } catch (error) {
      const state = get()
      set({
        status: 'stopped',
        currentTrack: null,
        queue: [],
        currentIndex: null,
        positionMs: 0,
        durationMs: 0,
      })
      persistPlaybackSession([], null, 0, state.shuffle, state.repeat)
      console.error('Failed to restore playback session', error)
      notifyError(localized('player.error.sessionRestore'), error)
    }
  },
}))

void onPositionUpdate((positionMs) => {
  usePlayerStore.setState({ positionMs })
  const state = usePlayerStore.getState()
  if (state.currentTrack && Math.abs(positionMs - lastPositionPersistMs) >= 5_000) {
    lastPositionPersistMs = positionMs
    persistPlaybackSession(state.queue, state.currentIndex, positionMs, state.shuffle, state.repeat)
  }
})

void onPlayerStateUpdate((playerState) => {
  const state = usePlayerStore.getState()
  if (playerState.volume > 0) {
    lastAudibleVolume = playerState.volume
  }
  const nextState = applyPlayerState(playerState, state.queue, state.currentTrack)
  usePlayerStore.setState(nextState)
  if (
    shouldPersistPlayerStateTransition(
      state.currentTrack?.path ?? null,
      nextState.currentTrack?.path ?? null,
      state.currentIndex,
      nextState.currentIndex,
    )
  ) {
    lastPositionPersistMs = nextState.positionMs
    persistPlaybackSession(state.queue, nextState.currentIndex ?? null, nextState.positionMs, nextState.shuffle, nextState.repeat)
    void useLibraryStore.getState().loadLibrary()
  }
})

void onPlayerOutputError((message) => {
  notifyError(localized('player.error.audioOutput'), message)
  if (!shouldAutoSkipOutputError(message)) return

  const state = usePlayerStore.getState()
  const previousState = {
    currentIndex: state.currentIndex,
    currentTrack: state.currentTrack,
    durationMs: state.durationMs,
    positionMs: state.positionMs,
    queue: state.queue,
    status: 'stopped' as const,
  }
  const recovery = queueRecoveryAfterPlaybackFailure(state.queue, state.currentIndex)
  if (!recovery) return

  const recoveryTrack = recovery.queue[recovery.currentIndex]
  if (!recoveryTrack) return

  useToastStore.getState().pushToast({
    title: localized('player.recovery.skippingTitle'),
    message: localized('player.recovery.skippingBody', {
      title: state.currentTrack?.title ?? localized('player.recovery.currentTrack'),
    }),
    tone: 'info',
  })
  usePlayerStore.setState({
    status: 'loading',
    currentTrack: recoveryTrack,
    queue: recovery.queue,
    currentIndex: recovery.currentIndex,
    positionMs: 0,
    durationMs: recoveryTrack.durationMs,
  })
  persistPlaybackSession(recovery.queue, recovery.currentIndex, 0, state.shuffle, state.repeat)

  void tauriPlayer
    .setQueue(
      recovery.queue.map((track) => track.path),
      recovery.currentIndex,
    )
    .then((playerState) => {
      usePlayerStore.setState((nextState) => applyPlayerState(playerState, nextState.queue, recoveryTrack))
    })
    .catch((error: unknown) => {
      usePlayerStore.setState(previousState)
      persistPlaybackSession(state.queue, state.currentIndex, state.positionMs, state.shuffle, state.repeat)
      console.error('Failed to recover after output error', error)
      notifyError(localized('player.error.queueRecovery'), error)
    })
})

void usePlayerStore.getState().restorePlaybackSession()

export default usePlayerStore
