import { useEffect, useState } from 'react'

import { translate } from '../lib/i18n'
import { onWindowDragDropEvent } from '../lib/tauri'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { notifyError } from '../stores/toastStore'

function localized(key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) {
  return translate(useSettingsStore.getState().appLanguage, key, params)
}

export function useLibraryDragDrop() {
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | null = null

    void onWindowDragDropEvent((event) => {
      if (event.type === 'enter' || event.type === 'over') {
        setIsDragActive(true)
        return
      }

      if (event.type === 'leave') {
        setIsDragActive(false)
        return
      }

      setIsDragActive(false)
      if (event.type === 'drop') {
        void useLibraryStore.getState().importDroppedPaths(event.paths)
      }
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten()
          return
        }
        unlisten = nextUnlisten
      })
      .catch((error) => notifyError(localized('library.dropUnavailableTitle'), error))

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  return isDragActive
}
