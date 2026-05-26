import { useEffect } from 'react'

import { tauriGlobalShortcuts } from '../lib/tauri'
import { usePlayerStore } from '../stores/playerStore'
import { runKeyboardShortcutAction, type KeyboardShortcutAction } from './useKeyboardShortcuts'

const GLOBAL_SHORTCUTS: Array<{ shortcut: string; action: KeyboardShortcutAction }> = [
  { shortcut: 'MediaPlayPause', action: 'togglePlayback' },
  { shortcut: 'MediaTrackNext', action: 'nextTrack' },
  { shortcut: 'MediaTrackPrevious', action: 'previousTrack' },
  { shortcut: 'CommandOrControl+Alt+Space', action: 'togglePlayback' },
  { shortcut: 'CommandOrControl+Alt+Right', action: 'nextTrack' },
  { shortcut: 'CommandOrControl+Alt+Left', action: 'previousTrack' },
]

export function resolveGlobalShortcutAction(shortcut: string) {
  return GLOBAL_SHORTCUTS.find((mapping) => mapping.shortcut === shortcut)?.action ?? null
}

export function useGlobalMediaShortcuts() {
  useEffect(() => {
    let disposed = false
    const registeredShortcuts: string[] = []

    const registerShortcuts = async () => {
      for (const mapping of GLOBAL_SHORTCUTS) {
        try {
          await tauriGlobalShortcuts.register(mapping.shortcut, (event) => {
            if (event.state !== 'Pressed') return
            const action = resolveGlobalShortcutAction(event.shortcut)
            if (!action) return
            runKeyboardShortcutAction(action, usePlayerStore.getState())
          })
          if (disposed) {
            void tauriGlobalShortcuts.unregister([mapping.shortcut])
          } else {
            registeredShortcuts.push(mapping.shortcut)
          }
        } catch (error) {
          console.warn(`Global shortcut unavailable: ${mapping.shortcut}`, error)
        }
      }
    }

    void registerShortcuts()

    return () => {
      disposed = true
      void tauriGlobalShortcuts.unregister(registeredShortcuts)
    }
  }, [])
}
