import { describe, expect, test, vi } from 'vitest'

import { resolveKeyboardShortcutAction, runKeyboardShortcutAction } from './useKeyboardShortcuts'

describe('resolveKeyboardShortcutAction', () => {
  test('maps Melodist window shortcuts to player actions', () => {
    expect(resolveKeyboardShortcutAction({ code: 'Space' })).toBe('togglePlayback')
    expect(resolveKeyboardShortcutAction({ code: 'ArrowLeft' })).toBe('seekBackward')
    expect(resolveKeyboardShortcutAction({ code: 'ArrowRight' })).toBe('seekForward')
    expect(resolveKeyboardShortcutAction({ code: 'ArrowUp' })).toBe('volumeUp')
    expect(resolveKeyboardShortcutAction({ code: 'ArrowDown' })).toBe('volumeDown')
    expect(resolveKeyboardShortcutAction({ code: 'KeyN' })).toBe('nextTrack')
    expect(resolveKeyboardShortcutAction({ code: 'KeyP' })).toBe('previousTrack')
    expect(resolveKeyboardShortcutAction({ code: 'KeyM' })).toBe('toggleMute')
    expect(resolveKeyboardShortcutAction({ code: 'KeyL' })).toBe('toggleLyrics')
    expect(resolveKeyboardShortcutAction({ code: 'KeyS' })).toBe('toggleShuffle')
    expect(resolveKeyboardShortcutAction({ code: 'KeyR' })).toBe('cycleRepeat')
  })

  test('ignores shortcuts that should stay with the focused app control', () => {
    expect(resolveKeyboardShortcutAction({ code: 'Space', editable: true })).toBeNull()
    expect(resolveKeyboardShortcutAction({ code: 'Space', repeat: true })).toBeNull()
    expect(resolveKeyboardShortcutAction({ code: 'Space', defaultPrevented: true })).toBeNull()
    expect(resolveKeyboardShortcutAction({ code: 'KeyN', metaKey: true })).toBeNull()
    expect(resolveKeyboardShortcutAction({ code: 'KeyN', ctrlKey: true })).toBeNull()
    expect(resolveKeyboardShortcutAction({ code: 'KeyN', altKey: true })).toBeNull()
  })
})

describe('runKeyboardShortcutAction', () => {
  function player(overrides: Partial<Parameters<typeof runKeyboardShortcutAction>[1]> = {}) {
    return {
      status: 'stopped' as const,
      currentTrack: null,
      positionMs: 15_000,
      durationMs: 120_000,
      volume: 0.5,
      play: vi.fn(async () => undefined),
      pause: vi.fn(async () => undefined),
      seek: vi.fn(async () => undefined),
      setVolume: vi.fn(async () => undefined),
      toggleMute: vi.fn(async () => undefined),
      nextTrack: vi.fn(async () => undefined),
      previousTrack: vi.fn(async () => undefined),
      toggleLyrics: vi.fn(),
      toggleShuffle: vi.fn(async () => undefined),
      cycleRepeat: vi.fn(async () => undefined),
      ...overrides,
    }
  }

  test('ignores transport navigation when no track is loaded', () => {
    const shortcutPlayer = player()

    runKeyboardShortcutAction('seekBackward', shortcutPlayer)
    runKeyboardShortcutAction('seekForward', shortcutPlayer)
    runKeyboardShortcutAction('nextTrack', shortcutPlayer)
    runKeyboardShortcutAction('previousTrack', shortcutPlayer)

    expect(shortcutPlayer.seek).not.toHaveBeenCalled()
    expect(shortcutPlayer.nextTrack).not.toHaveBeenCalled()
    expect(shortcutPlayer.previousTrack).not.toHaveBeenCalled()
  })

  test('ignores transport navigation while loading a track', () => {
    const shortcutPlayer = player({ currentTrack: { id: 'track' }, status: 'loading' })

    runKeyboardShortcutAction('seekForward', shortcutPlayer)
    runKeyboardShortcutAction('nextTrack', shortcutPlayer)

    expect(shortcutPlayer.seek).not.toHaveBeenCalled()
    expect(shortcutPlayer.nextTrack).not.toHaveBeenCalled()
  })

  test('runs transport navigation when a track is ready', () => {
    const shortcutPlayer = player({ currentTrack: { id: 'track' }, status: 'playing' })

    runKeyboardShortcutAction('seekForward', shortcutPlayer)
    runKeyboardShortcutAction('nextTrack', shortcutPlayer)

    expect(shortcutPlayer.seek).toHaveBeenCalledWith(25_000)
    expect(shortcutPlayer.nextTrack).toHaveBeenCalledOnce()
  })
})
