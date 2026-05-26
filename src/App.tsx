import { Plus, RefreshCw, Search, Upload, X } from 'lucide-react'

import { LyricsPanel } from './components/LyricsPanel/LyricsPanel'
import { AlbumGrid } from './components/Library/AlbumGrid'
import { ArtistList } from './components/Library/ArtistList'
import { TrackList } from './components/Library/TrackList'
import { NowPlayingView } from './components/NowPlaying/NowPlayingView'
import { PlayerBar } from './components/Player/PlayerBar'
import { QueuePanel } from './components/QueuePanel/QueuePanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ToastViewport } from './components/Toast/ToastViewport'
import { useGlobalMediaShortcuts } from './hooks/useGlobalMediaShortcuts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useLibraryDragDrop } from './hooks/useLibraryDragDrop'
import { useI18n } from './lib/i18n'
import { useLibraryStore } from './stores/libraryStore'
import { usePlayerStore } from './stores/playerStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUiStore, type LibraryView } from './stores/uiStore'

const libraryTabs: Array<{ labelKey: 'app.tracks' | 'app.albums' | 'app.artists'; view: LibraryView }> = [
  { labelKey: 'app.tracks', view: 'tracks' },
  { labelKey: 'app.albums', view: 'albums' },
  { labelKey: 'app.artists', view: 'artists' },
]

function getPageTitleKey(activeView: string, libraryView: LibraryView) {
  if (activeView === 'nowPlaying') return 'app.nowPlaying'
  if (activeView === 'settings') return 'app.settings'
  if (libraryView === 'albums') return 'app.albums'
  if (libraryView === 'artists') return 'app.artists'
  return 'app.library'
}

export default function App() {
  useGlobalMediaShortcuts()
  useKeyboardShortcuts()
  const isDropActive = useLibraryDragDrop()
  const { t } = useI18n()

  const searchQuery = useLibraryStore((state) => state.searchQuery)
  const totalTracks = useLibraryStore((state) => state.tracks.length)
  const visibleTracks = useLibraryStore((state) => state.filteredTracks.length)
  const search = useLibraryStore((state) => state.search)
  const isScanning = useLibraryStore((state) => state.isScanning)
  const scanProgress = useLibraryStore((state) => state.scanProgress)
  const chooseAndScanDirectory = useLibraryStore((state) => state.chooseAndScanDirectory)
  const rescanLibrary = useLibraryStore((state) => state.rescanLibrary)
  const musicDirectories = useSettingsStore((state) => state.musicDirectories)
  const activeView = useUiStore((state) => state.activeView)
  const libraryView = useUiStore((state) => state.libraryView)
  const setLibraryView = useUiStore((state) => state.setLibraryView)
  const queueOpen = useUiStore((state) => state.queueOpen)
  const lyricsOpen = usePlayerStore((state) => state.lyricsOpen)
  const scanPercent = scanProgress && scanProgress.total > 0 ? scanProgress.scanned / scanProgress.total : 0
  const showLibraryTools = activeView === 'library' || activeView === 'albums' || activeView === 'artists'
  const pageTitle = t(getPageTitleKey(activeView, libraryView))
  const sidePanelOpen = queueOpen || lyricsOpen
  const hasSearchQuery = searchQuery.trim().length > 0

  const renderMainContent = () => {
    if (activeView === 'settings') return <SettingsPanel />
    if (activeView === 'nowPlaying') return <NowPlayingView />
    if (libraryView === 'albums') return <AlbumGrid />
    if (libraryView === 'artists') return <ArtistList />
    return <TrackList />
  }

  return (
    <div className={`app-shell ${sidePanelOpen ? 'side-panel-open' : ''}`}>
      <Sidebar />
      <main className="main-content">
        <header className="library-toolbar">
          <h2>{pageTitle}</h2>
          {showLibraryTools ? (
            <>
              <div className="search-field" title={t('app.searchHelp')}>
                <Search size={16} />
                <input
                  aria-label={t('app.search')}
                  placeholder={t('app.search')}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => search(event.currentTarget.value)}
                />
                {hasSearchQuery ? (
                  <button aria-label={t('app.clearSearch')} type="button" onClick={() => search('')}>
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <div className="segmented-control" role="tablist" aria-label={t('app.libraryView')}>
                {libraryTabs.map((tab) => (
                  <button
                    aria-selected={libraryView === tab.view}
                    className={libraryView === tab.view ? 'active' : ''}
                    key={tab.view}
                    role="tab"
                    type="button"
                    onClick={() => setLibraryView(tab.view)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>
              <button aria-label={t('app.addFolder')} className="primary-action" type="button" onClick={() => void chooseAndScanDirectory()}>
                <Plus size={16} />
                <span className="action-label">{t('app.addFolder')}</span>
              </button>
              <button
                aria-label={t('app.refresh')}
                className="secondary-action"
                disabled={isScanning || musicDirectories.length === 0}
                title={t('app.refresh')}
                type="button"
                onClick={() => void rescanLibrary()}
              >
                <RefreshCw size={16} />
                <span className="action-label">{t('app.refresh')}</span>
              </button>
            </>
          ) : null}
        </header>
        {showLibraryTools && totalTracks > 0 ? (
          <div className="library-meta-bar">
            <span>
              {hasSearchQuery
                ? t('app.searchStatsFiltered', {
                    count: visibleTracks.toLocaleString(),
                    total: totalTracks.toLocaleString(),
                  })
                : t('app.searchStats', { total: totalTracks.toLocaleString() })}
            </span>
            <span>{t('app.searchSyntaxShort')}</span>
          </div>
        ) : null}
        {isScanning && scanProgress && showLibraryTools ? (
          <div className="scan-progress">
            <RefreshCw size={16} />
            <span>
              {t('app.scanning', {
                scanned: scanProgress.scanned.toLocaleString(),
                total: scanProgress.total.toLocaleString(),
              })}
            </span>
            <progress aria-label={t('app.scanProgress')} max={1} value={scanPercent} />
          </div>
        ) : null}
        <div className="content-stage" key={`${activeView}-${libraryView}`}>
          {renderMainContent()}
        </div>
      </main>
      <LyricsPanel />
      <QueuePanel />
      <ToastViewport />
      {isDropActive ? (
        <div aria-live="polite" className="drop-import-overlay" role="status">
          <div>
            <Upload size={28} />
            <h2>{t('app.dropImportTitle')}</h2>
            <p>{t('app.dropImportBody')}</p>
          </div>
        </div>
      ) : null}
      <PlayerBar />
    </div>
  )
}
