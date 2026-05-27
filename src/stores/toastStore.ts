import { create } from 'zustand'

type ToastTone = 'error' | 'info' | 'success'

export interface ToastMessage {
  details?: string[]
  id: string
  message: string
  title: string
  tone: ToastTone
}

interface ToastStore {
  toasts: ToastMessage[]
  dismissToast: (id: string) => void
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
}

const toastTimers = new Map<string, ReturnType<typeof window.setTimeout>>()

function nextToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id)
  if (timer) {
    window.clearTimeout(timer)
    toastTimers.delete(id)
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  dismissToast: (id) => {
    clearToastTimer(id)
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
  pushToast: (toast) => {
    const id = nextToastId()
    set((state) => {
      const toasts = [...state.toasts, { ...toast, id }].slice(-4)
      const visibleIds = new Set(toasts.map((visibleToast) => visibleToast.id))
      for (const previousToast of state.toasts) {
        if (!visibleIds.has(previousToast.id)) {
          clearToastTimer(previousToast.id)
        }
      }
      return { toasts }
    })
    const timer = window.setTimeout(() => {
      get().dismissToast(id)
    }, 5_000)
    toastTimers.set(id, timer)
  },
}))

export function notifyError(title: string, error: unknown) {
  useToastStore.getState().pushToast({
    title,
    message: errorMessage(error),
    tone: 'error',
  })
}

export default useToastStore
