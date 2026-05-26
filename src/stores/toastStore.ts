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

function nextToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  pushToast: (toast) => {
    const id = nextToastId()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-4) }))
    window.setTimeout(() => {
      get().dismissToast(id)
    }, 5_000)
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
