import { describe, expect, test } from 'vitest'

import { resolveKeyboardShortcutAction } from './useKeyboardShortcuts'

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
