import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useToastStore } from './toastStore'

const baseToast = {
  message: 'Something happened',
  title: 'Notice',
  tone: 'info' as const,
}

function resetToasts() {
  for (const toast of useToastStore.getState().toasts) {
    useToastStore.getState().dismissToast(toast.id)
  }
  useToastStore.setState({ toasts: [] })
}

describe('toastStore', () => {
  beforeEach(() => {
    let nextTimerId = 1
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => nextTimerId++),
    })
    resetToasts()
  })

  test('clears a pending auto-dismiss timer when a toast is dismissed manually', () => {
    useToastStore.getState().pushToast(baseToast)
    const [toast] = useToastStore.getState().toasts

    expect(toast).toBeDefined()
    if (!toast) return

    useToastStore.getState().dismissToast(toast.id)

    expect(window.clearTimeout).toHaveBeenCalledWith(1)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  test('clears timers for toasts trimmed from the visible stack', () => {
    for (let index = 0; index < 5; index += 1) {
      useToastStore.getState().pushToast({ ...baseToast, title: `Notice ${index}` })
    }

    expect(useToastStore.getState().toasts).toHaveLength(4)
    expect(window.clearTimeout).toHaveBeenCalledWith(1)
  })
})
