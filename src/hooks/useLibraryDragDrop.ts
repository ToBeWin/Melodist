import { useEffect, useState } from 'react'

import { onWindowDragDropEvent } from '../lib/tauri'
import { useLibraryStore } from '../stores/libraryStore'
import { notifyError } from '../stores/toastStore'

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
      .catch((error) => notifyError('File drop unavailable', error))

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  return isDragActive
}
