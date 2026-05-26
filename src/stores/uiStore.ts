import { create } from 'zustand'

export type AppView = 'library' | 'albums' | 'artists' | 'nowPlaying' | 'settings'
export type LibraryView = 'tracks' | 'albums' | 'artists'

interface UiStore {
  activeView: AppView
  libraryView: LibraryView
  queueOpen: boolean
  setActiveView: (view: AppView) => void
  setLibraryView: (view: LibraryView) => void
  openQueue: () => void
  toggleQueue: () => void
  closeQueue: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  activeView: 'library',
  libraryView: 'tracks',
  queueOpen: false,
  setActiveView: (view) =>
    set((state) => ({
      activeView: view,
      libraryView:
        view === 'albums' ? 'albums' : view === 'artists' ? 'artists' : view === 'library' ? state.libraryView : state.libraryView,
    })),
  setLibraryView: (view) =>
    set({
      libraryView: view,
      activeView: view === 'tracks' ? 'library' : view,
    }),
  openQueue: () => set({ queueOpen: true }),
  toggleQueue: () => set((state) => ({ queueOpen: !state.queueOpen })),
  closeQueue: () => set({ queueOpen: false }),
}))

export default useUiStore
