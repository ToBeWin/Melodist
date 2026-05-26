import { create } from 'zustand'

import { translate } from '../lib/i18n'
import { filterTracksByLibrarySearch } from '../lib/librarySearch'
import { scanFailureDetails, scanResultMessage } from '../lib/scanResult'
import { onLibraryWatchError, onScanComplete, onScanProgress, tauriDialog, tauriLibrary } from '../lib/tauri'
import { useSettingsStore } from './settingsStore'
import { notifyError, useToastStore } from './toastStore'
import type { Album, ScanProgress, Track } from '../types'

type SortDirection = 'asc' | 'desc'
export type TrackSortField = 'trackNumber' | 'title' | 'artist' | 'album' | 'duration' | 'dateAdded' | 'lastPlayed' | 'playCount'

interface LibraryStore {
  tracks: Track[]
  albums: Album[]
  artists: string[]
  isScanning: boolean
  scanProgress: ScanProgress | null
  searchQuery: string
  sortField: TrackSortField
  sortDirection: SortDirection
  filteredTracks: Track[]
  scanDirectory: (path: string) => Promise<void>
  importDroppedPaths: (paths: string[]) => Promise<void>
  chooseAndScanDirectory: () => Promise<void>
  rescanLibrary: () => Promise<void>
  search: (query: string) => void
  setSort: (field: TrackSortField) => void
  loadLibrary: () => Promise<void>
}

function trackSortKey(track: Track) {
  return [
    String(track.discNumber ?? 0).padStart(3, '0'),
    String(track.trackNumber ?? 0).padStart(3, '0'),
    track.title ?? track.path,
  ].join('|')
}

export const buildAlbums = (tracks: Track[]): Album[] => {
  const albums = Object.values(
    tracks.reduce<Record<string, Album>>((albums, track) => {
      const name = track.album ?? 'Unknown Album'
      const artist = track.albumArtist ?? track.artist
      const key = `${artist ?? 'Unknown Artist'}\0${name}`
      const existing = albums[key]
      if (existing) {
        existing.tracks.push(track)
        existing.trackCount += 1
        if (!existing.coverCachePath && track.coverCachePath) {
          existing.coverCachePath = track.coverCachePath
        }
        return albums
      }
      albums[key] = {
        name,
        artist,
        year: track.year,
        trackCount: 1,
        coverCachePath: track.coverCachePath,
        tracks: [track],
      }
      return albums
    }, {}),
  )

  return albums
    .map((album) => ({ ...album, tracks: [...album.tracks].sort((a, b) => trackSortKey(a).localeCompare(trackSortKey(b))) }))
    .sort((a, b) => `${a.artist ?? ''}${a.name}`.localeCompare(`${b.artist ?? ''}${b.name}`))
}

function compareNullableText(first: string | null, second: string | null) {
  return (first ?? '').localeCompare(second ?? '', undefined, { sensitivity: 'base', numeric: true })
}

function compareNullableNumber(first: number | null, second: number | null) {
  return (first ?? Number.MAX_SAFE_INTEGER) - (second ?? Number.MAX_SAFE_INTEGER)
}

function compareNullableRecentNumber(first: number | null, second: number | null) {
  return (first ?? 0) - (second ?? 0)
}

function compareTracks(first: Track, second: Track, field: TrackSortField): number {
  switch (field) {
    case 'trackNumber':
      return (
        compareNullableText(first.albumArtist ?? first.artist, second.albumArtist ?? second.artist) ||
        compareNullableText(first.album, second.album) ||
        compareNullableNumber(first.discNumber, second.discNumber) ||
        compareNullableNumber(first.trackNumber, second.trackNumber) ||
        compareNullableText(first.title, second.title) ||
        first.path.localeCompare(second.path)
      )
    case 'title':
      return compareNullableText(first.title, second.title) || first.path.localeCompare(second.path)
    case 'artist':
      return compareNullableText(first.artist, second.artist) || compareNullableText(first.title, second.title)
    case 'album':
      return compareNullableText(first.album, second.album) || compareTracks(first, second, 'trackNumber')
    case 'duration':
      return first.durationMs - second.durationMs || compareNullableText(first.title, second.title)
    case 'dateAdded':
      return first.dateAdded - second.dateAdded || compareNullableText(first.title, second.title)
    case 'lastPlayed':
      return compareNullableRecentNumber(first.lastPlayed, second.lastPlayed) || compareNullableText(first.title, second.title)
    case 'playCount':
      return first.playCount - second.playCount || compareNullableRecentNumber(first.lastPlayed, second.lastPlayed)
  }
}

function sortTracks(tracks: Track[], field: TrackSortField, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...tracks].sort((first, second) => compareTracks(first, second, field) * multiplier)
}

function defaultSortDirection(field: TrackSortField): SortDirection {
  return field === 'lastPlayed' || field === 'playCount' || field === 'dateAdded' ? 'desc' : 'asc'
}

function visibleTracks(tracks: Track[], query: string, field: TrackSortField, direction: SortDirection) {
  return sortTracks(filterTracksByLibrarySearch(tracks, query), field, direction)
}

function currentLanguage() {
  return useSettingsStore.getState().appLanguage
}

function localized(key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) {
  return translate(currentLanguage(), key, params)
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  albums: [],
  artists: [],
  isScanning: false,
  scanProgress: null,
  searchQuery: '',
  sortField: 'trackNumber',
  sortDirection: 'asc',
  filteredTracks: [],
  scanDirectory: async (path) => {
    try {
      set({ isScanning: true, scanProgress: { scanned: 0, total: 0, currentFile: path } })
      const result = await tauriLibrary.scan(path)
      set({
        scanProgress: {
          scanned: result.added + result.updated,
          total: result.added + result.updated,
          currentFile: path,
        },
      })
      await get().loadLibrary()
      useToastStore.getState().pushToast({
        title: localized(result.failed > 0 ? 'library.scanIssueTitle' : 'library.scanCompleteTitle'),
        message: scanResultMessage(currentLanguage(), result),
        details: scanFailureDetails(result),
        tone: result.failed > 0 ? 'info' : 'success',
      })
    } catch (error) {
      console.error('Failed to scan directory', error)
      notifyError(localized('library.scanFailedTitle'), error)
    } finally {
      set({ isScanning: false, scanProgress: null })
    }
  },
  importDroppedPaths: async (paths) => {
    const droppedPaths = paths.filter((path) => path.trim().length > 0)
    if (droppedPaths.length === 0) return
    if (get().isScanning) {
      useToastStore.getState().pushToast({
        title: localized('library.importBusyTitle'),
        message: localized('library.importBusyBody'),
        tone: 'info',
      })
      return
    }

    try {
      set({
        isScanning: true,
        scanProgress: {
          scanned: 0,
          total: droppedPaths.length,
          currentFile: droppedPaths[0] ?? '',
        },
      })
      const result = await tauriLibrary.importDroppedPaths(droppedPaths)
      for (const directory of result.importedDirectories) {
        await useSettingsStore.getState().addMusicDirectory(directory)
      }
      set({
        scanProgress: {
          scanned: result.added + result.updated,
          total: result.added + result.updated + result.failed,
          currentFile: droppedPaths[droppedPaths.length - 1] ?? '',
        },
      })
      await get().loadLibrary()
      useToastStore.getState().pushToast({
        title: localized(result.failed > 0 ? 'library.importIssueTitle' : 'library.importCompleteTitle'),
        message: scanResultMessage(currentLanguage(), result),
        details: scanFailureDetails(result),
        tone: result.failed > 0 ? 'info' : 'success',
      })
    } catch (error) {
      console.error('Failed to import dropped files or folders', error)
      notifyError(localized('library.importFailedTitle'), error)
    } finally {
      set({ isScanning: false, scanProgress: null })
    }
  },
  chooseAndScanDirectory: async () => {
    try {
      const path = await tauriDialog.openMusicDirectory()
      if (!path) return
      await useSettingsStore.getState().addMusicDirectory(path)
      await get().scanDirectory(path)
    } catch (error) {
      console.error('Failed to choose and scan directory', error)
      notifyError(localized('library.scanFailedTitle'), error)
    }
  },
  rescanLibrary: async () => {
    const directories = useSettingsStore.getState().musicDirectories
    for (const directory of directories) {
      await get().scanDirectory(directory)
    }
  },
  search: (query) =>
    set((state) => ({
      searchQuery: query,
      filteredTracks: visibleTracks(state.tracks, query, state.sortField, state.sortDirection),
    })),
  setSort: (field) =>
    set((state) => {
      const sortDirection = state.sortField === field && state.sortDirection === 'asc' ? 'desc' : defaultSortDirection(field)
      return {
        sortField: field,
        sortDirection,
        filteredTracks: visibleTracks(state.tracks, state.searchQuery, field, sortDirection),
      }
    }),
  loadLibrary: async () => {
    try {
      const tracks = await tauriLibrary.getTracks()
      const state = get()
      set({
        tracks,
        albums: buildAlbums(tracks),
        artists: Array.from(new Set(tracks.map((track) => track.artist ?? 'Unknown Artist'))),
        filteredTracks: visibleTracks(tracks, state.searchQuery, state.sortField, state.sortDirection),
      })
    } catch (error) {
      console.error('Failed to load library', error)
      notifyError(localized('library.loadFailedTitle'), error)
    }
  },
}))

void useLibraryStore.getState().loadLibrary()

void onScanProgress((scanProgress) => {
  useLibraryStore.setState({ isScanning: true, scanProgress })
})

void onScanComplete(() => {
  useLibraryStore.setState({
    isScanning: false,
    scanProgress: null,
  })
  void useLibraryStore.getState().loadLibrary()
})

void onLibraryWatchError((message) => {
  notifyError(localized('library.watchFailedTitle'), message)
})

export default useLibraryStore
