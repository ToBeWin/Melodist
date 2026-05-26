import { describe, expect, test } from 'vitest'

import { resolveGlobalShortcutAction } from './useGlobalMediaShortcuts'

describe('resolveGlobalShortcutAction', () => {
  test('maps media keys and safe global chords to player actions', () => {
    expect(resolveGlobalShortcutAction('MediaPlayPause')).toBe('togglePlayback')
    expect(resolveGlobalShortcutAction('MediaTrackNext')).toBe('nextTrack')
    expect(resolveGlobalShortcutAction('MediaTrackPrevious')).toBe('previousTrack')
    expect(resolveGlobalShortcutAction('CommandOrControl+Alt+Space')).toBe('togglePlayback')
    expect(resolveGlobalShortcutAction('CommandOrControl+Alt+Right')).toBe('nextTrack')
    expect(resolveGlobalShortcutAction('CommandOrControl+Alt+Left')).toBe('previousTrack')
  })

  test('ignores unrelated global shortcuts', () => {
    expect(resolveGlobalShortcutAction('Space')).toBeNull()
    expect(resolveGlobalShortcutAction('KeyN')).toBeNull()
  })
})
