import { useEffect } from 'react'

import { usePlayerStore } from '../stores/playerStore'

const SEEK_STEP_MS = 10_000
const VOLUME_STEP = 0.05

export type KeyboardShortcutAction =
  | 'togglePlayback'
  | 'seekBackward'
  | 'seekForward'
  | 'volumeUp'
  | 'volumeDown'
  | 'nextTrack'
  | 'previousTrack'
  | 'toggleMute'
  | 'toggleLyrics'
  | 'toggleShuffle'
  | 'cycleRepeat'

interface KeyboardShortcutInput {
  code: string
  defaultPrevented?: boolean
  repeat?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  editable?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface ShortcutPlayer<TTrack = unknown> {
  status: 'stopped' | 'loading' | 'playing' | 'paused'
  currentTrack: TTrack | null
  positionMs: number
  durationMs: number
  volume: number
  play: (track: TTrack) => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  toggleMute: () => Promise<void>
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  toggleLyrics: () => void
  toggleShuffle: () => Promise<void>
  cycleRepeat: () => Promise<void>
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const editable = target.closest('input, textarea, select, [contenteditable="true"]')
  return editable !== null
}

export function resolveKeyboardShortcutAction(input: KeyboardShortcutInput): KeyboardShortcutAction | null {
  if (input.defaultPrevented || input.repeat || input.metaKey || input.ctrlKey || input.altKey || input.editable) return null

  switch (input.code) {
    case 'Space':
      return 'togglePlayback'
    case 'ArrowLeft':
      return 'seekBackward'
    case 'ArrowRight':
      return 'seekForward'
    case 'ArrowUp':
      return 'volumeUp'
    case 'ArrowDown':
      return 'volumeDown'
    case 'KeyN':
      return 'nextTrack'
    case 'KeyP':
      return 'previousTrack'
    case 'KeyM':
      return 'toggleMute'
    case 'KeyL':
      return 'toggleLyrics'
    case 'KeyS':
      return 'toggleShuffle'
    case 'KeyR':
      return 'cycleRepeat'
    default:
      return null
  }
}

export function runKeyboardShortcutAction<TTrack>(action: KeyboardShortcutAction, player: ShortcutPlayer<TTrack>) {
  switch (action) {
    case 'togglePlayback':
      if (!player.currentTrack || player.status === 'loading') return
      if (player.status === 'playing' || player.status === 'paused') {
        void player.pause()
        return
      }
      void player.play(player.currentTrack)
      return
    case 'seekBackward':
      if (!player.currentTrack || player.status === 'loading') return
      void player.seek(clamp(player.positionMs - SEEK_STEP_MS, 0, player.durationMs))
      return
    case 'seekForward':
      if (!player.currentTrack || player.status === 'loading') return
      void player.seek(clamp(player.positionMs + SEEK_STEP_MS, 0, player.durationMs))
      return
    case 'volumeUp':
      void player.setVolume(clamp(player.volume + VOLUME_STEP, 0, 1))
      return
    case 'volumeDown':
      void player.setVolume(clamp(player.volume - VOLUME_STEP, 0, 1))
      return
    case 'nextTrack':
      if (!player.currentTrack || player.status === 'loading') return
      void player.nextTrack()
      return
    case 'previousTrack':
      if (!player.currentTrack || player.status === 'loading') return
      void player.previousTrack()
      return
    case 'toggleMute':
      void player.toggleMute()
      return
    case 'toggleLyrics':
      player.toggleLyrics()
      return
    case 'toggleShuffle':
      void player.toggleShuffle()
      return
    case 'cycleRepeat':
      void player.cycleRepeat()
      return
  }
}

// Keep this window-scoped: these unmodified keys would capture normal typing in other apps if registered globally.
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveKeyboardShortcutAction({
        code: event.code,
        defaultPrevented: event.defaultPrevented,
        repeat: event.repeat,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        editable: isEditableTarget(event.target),
      })
      if (action === null) return
      const player = usePlayerStore.getState()

      event.preventDefault()
      runKeyboardShortcutAction(action, player)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
