import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownUp,
  Check,
  Clock3,
  Copy,
  FolderOpen,
  Info,
  History,
  ListPlus,
  MoreHorizontal,
  Play,
  Sparkles,
  Shuffle,
  TrendingUp,
  Volume2,
} from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { tauriLibrary, toAssetUrl } from '../../lib/tauri'
import { formatDurationMs } from '../../lib/time'
import { trackIndexById } from '../../lib/trackList'
import { useLibraryStore, type TrackSortField } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import type { Track } from '../../types'
import { LibraryEmptyState } from './LibraryEmptyState'
import { TrackInfoDialog } from './TrackInfoDialog'

const TRACK_ROW_HEIGHT = 48
const ACTION_MENU_WIDTH = 292
const ACTION_MENU_HEIGHT = 216
const ACTION_MENU_GAP = 8
const PLAYER_BAR_CLEARANCE = 84

interface ActionMenuPosition {
  left: number
  top: number
}

interface SortHeaderButtonProps {
  active: boolean
  direction: 'asc' | 'desc'
  field: TrackSortField
  label: string
  onSort: (field: TrackSortField) => void
}

interface SortPresetButtonProps {
  active: boolean
  direction: 'asc' | 'desc'
  field: TrackSortField
  icon: ReactNode
  label: string
  onSort: (field: TrackSortField) => void
}

interface TrackRowProps {
  index: number
  isPlaying: boolean
  onAddToQueue: (track: Track) => Promise<void>
  onCopyPath: (track: Track) => Promise<void>
  onGetInfo: (track: Track) => void
  onPlayFromIndex: (index: number) => void
  onPlayNext: (track: Track) => Promise<void>
  onShowInFileManager: (track: Track) => Promise<void>
  track: Track
}

function TrackArtwork({ track }: { track: Track }) {
  const coverUrl = toAssetUrl(track.coverCachePath)

  return (
    <div className={`track-artwork ${coverUrl ? 'with-cover' : ''}`} aria-hidden="true">
      {coverUrl ? (
        <img
          alt=""
          src={coverUrl}
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
    </div>
  )
}

async function copyText(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function menuPositionFromRect(rect: DOMRect, alignToPointer?: { x: number; y: number }): ActionMenuPosition {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const bottomLimit = Math.max(0, viewportHeight - PLAYER_BAR_CLEARANCE)
  const anchorX = alignToPointer?.x ?? rect.right
  const anchorTop = alignToPointer?.y ?? rect.top
  const anchorBottom = alignToPointer?.y ?? rect.bottom
  const left = clamp(anchorX - ACTION_MENU_WIDTH, ACTION_MENU_GAP, Math.max(ACTION_MENU_GAP, viewportWidth - ACTION_MENU_WIDTH - ACTION_MENU_GAP))
  const belowTop = anchorBottom + ACTION_MENU_GAP
  const top =
    belowTop + ACTION_MENU_HEIGHT <= bottomLimit
      ? belowTop
      : clamp(anchorTop - ACTION_MENU_HEIGHT - ACTION_MENU_GAP, ACTION_MENU_GAP, Math.max(ACTION_MENU_GAP, bottomLimit - ACTION_MENU_HEIGHT))

  return { left, top }
}

function SortHeaderButton({ active, direction, field, label, onSort }: SortHeaderButtonProps) {
  const { t } = useI18n()
  const sortLabel = active ? t(direction === 'asc' ? 'track.sort.ascending' : 'track.sort.descending') : undefined

  return (
    <button
      aria-label={sortLabel ? `${label}, ${sortLabel}` : label}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`track-sort-button ${active ? 'active' : ''}`}
      type="button"
      onClick={() => onSort(field)}
    >
      {label}
      {active ? <ArrowDownUp size={13} /> : null}
    </button>
  )
}

function SortPresetButton({ active, direction, field, icon, label, onSort }: SortPresetButtonProps) {
  const { t } = useI18n()

  return (
    <button
      aria-pressed={active}
      className={`track-sort-preset ${active ? 'active' : ''}`}
      type="button"
      onClick={() => onSort(field)}
    >
      {icon}
      <span>{label}</span>
      {active ? <small>{t(direction === 'asc' ? 'track.sort.ascendingShort' : 'track.sort.descendingShort')}</small> : null}
    </button>
  )
}

function TrackRow({
  index,
  isPlaying,
  onAddToQueue,
  onCopyPath,
  onGetInfo,
  onPlayFromIndex,
  onPlayNext,
  onShowInFileManager,
  track,
}: TrackRowProps) {
  const { t } = useI18n()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<ActionMenuPosition | null>(null)
  const [feedback, setFeedback] = useState<'copied' | 'queued' | null>(null)
  const actionsButtonRef = useRef<HTMLButtonElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const title = track.title ?? t('common.unknownTitle')
  const activityLabel =
    track.playCount > 0
      ? t('track.activity.plays', { count: track.playCount })
      : track.lastPlayed
        ? t('track.activity.played')
        : t('track.activity.unplayed')
  const showFeedback = (nextFeedback: 'copied' | 'queued') => {
    setFeedback(nextFeedback)
    window.setTimeout(() => setFeedback(null), 1200)
  }
  const openActionsMenu = (pointer?: { x: number; y: number }) => {
    const rect = actionsButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPosition(menuPositionFromRect(rect, pointer))
    setActionsOpen(true)
  }

  useEffect(() => {
    if (!actionsOpen) return undefined

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (actionsButtonRef.current?.contains(target) || actionsMenuRef.current?.contains(target)) return
      setActionsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsOpen(false)
    }
    const closeOnViewportChange = () => setActionsOpen(false)

    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape, true)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape, true)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [actionsOpen])

  return (
    <div
      aria-current={isPlaying ? 'true' : undefined}
      className={`track-row ${isPlaying ? 'playing' : ''}`}
      role="row"
      tabIndex={0}
      onContextMenu={(event) => {
        event.preventDefault()
        openActionsMenu({ x: event.clientX, y: event.clientY })
      }}
      onDoubleClick={() => onPlayFromIndex(index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPlayFromIndex(index)
        }
      }}
    >
      <span className="track-index">{isPlaying ? <Volume2 size={16} /> : index + 1}</span>
      <TrackArtwork track={track} />
      <span className="track-title">
        <strong>{title}</strong>
        <small>{activityLabel}</small>
      </span>
      <span className="track-artist">{track.artist ?? t('common.unknownArtist')}</span>
      <span className="track-album">{track.album ?? t('common.unknownAlbum')}</span>
      <span className="track-duration">{formatDurationMs(track.durationMs)}</span>
      <div className="track-actions-menu">
        <button
          ref={actionsButtonRef}
          aria-expanded={actionsOpen}
          aria-label={t('track.actions.more', { title })}
          className="track-actions"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (actionsOpen) {
              setActionsOpen(false)
            } else {
              openActionsMenu()
            }
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={18} />
        </button>
        {actionsOpen && menuPosition
          ? createPortal(
              <div
                ref={actionsMenuRef}
                className="track-action-popover"
                role="menu"
                style={{ left: menuPosition.left, top: menuPosition.top } satisfies CSSProperties}
              >
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setActionsOpen(false)
                onPlayFromIndex(index)
              }}
            >
              <Play size={14} />
              {t('track.actions.playFromHere')}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void onPlayNext(track).then(() => {
                  setActionsOpen(false)
                  showFeedback('queued')
                })
              }}
            >
              <Shuffle size={14} />
              {t('track.actions.playNext')}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void onAddToQueue(track).then(() => {
                  setActionsOpen(false)
                  showFeedback('queued')
                })
              }}
            >
              {feedback === 'queued' ? <Check size={14} /> : <ListPlus size={14} />}
              {feedback === 'queued' ? t('track.actions.queued') : t('track.actions.addToQueue')}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setActionsOpen(false)
                void onShowInFileManager(track)
              }}
            >
              <FolderOpen size={14} />
              {t('track.actions.showInFileManager')}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setActionsOpen(false)
                onGetInfo(track)
              }}
            >
              <Info size={14} />
              {t('track.actions.getInfo')}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void onCopyPath(track).then(() => {
                  showFeedback('copied')
                })
              }}
            >
              {feedback === 'copied' ? <Check size={14} /> : <Copy size={14} />}
              {feedback === 'copied' ? t('track.actions.copiedPath') : t('track.actions.copyPath')}
            </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  )
}

export function TrackList() {
  const { t } = useI18n()
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const [infoTrack, setInfoTrack] = useState<Track | null>(null)
  const tracks = useLibraryStore((state) => state.filteredTracks)
  const libraryTrackCount = useLibraryStore((state) => state.tracks.length)
  const chooseAndScanDirectory = useLibraryStore((state) => state.chooseAndScanDirectory)
  const sortField = useLibraryStore((state) => state.sortField)
  const sortDirection = useLibraryStore((state) => state.sortDirection)
  const setSort = useLibraryStore((state) => state.setSort)
  const currentTrackId = usePlayerStore((state) => state.currentTrack?.id ?? null)
  const previousCurrentTrackIdRef = useRef<string | null>(null)
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const playNext = usePlayerStore((state) => state.playNext)
  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    estimateSize: () => TRACK_ROW_HEIGHT,
    getItemKey: (index) => tracks[index]?.id ?? index,
    getScrollElement: () => scrollElementRef.current,
    overscan: 10,
  })

  useEffect(() => {
    if (previousCurrentTrackIdRef.current === currentTrackId) return
    previousCurrentTrackIdRef.current = currentTrackId

    const currentTrackIndex = trackIndexById(tracks, currentTrackId)
    if (currentTrackIndex >= 0) {
      rowVirtualizer.scrollToIndex(currentTrackIndex, { align: 'center' })
    }
  }, [currentTrackId, rowVirtualizer, tracks])

  const handlePlayFromIndex = (index: number) => {
    void setQueueAndPlay(tracks, index)
  }
  const handleCopyPath = async (track: Track) => {
    await copyText(track.path)
  }
  const handleShowInFileManager = async (track: Track) => {
    await tauriLibrary.showInFileManager(track.path)
  }

  if (tracks.length === 0) {
    return (
      <section className="track-table" aria-label={t('track.list')}>
        <LibraryEmptyState hasLibraryTracks={libraryTrackCount > 0} onAddFolder={() => void chooseAndScanDirectory()} />
      </section>
    )
  }

  return (
    <section className="track-table" aria-label={t('track.list')}>
      <div className="track-sort-presets" aria-label={t('track.sort.presets')}>
        <SortPresetButton
          active={sortField === 'trackNumber'}
          direction={sortDirection}
          field="trackNumber"
          icon={<Sparkles size={15} />}
          label={t('track.sort.libraryOrder')}
          onSort={setSort}
        />
        <SortPresetButton
          active={sortField === 'lastPlayed'}
          direction={sortDirection}
          field="lastPlayed"
          icon={<History size={15} />}
          label={t('track.sort.recentlyPlayed')}
          onSort={setSort}
        />
        <SortPresetButton
          active={sortField === 'playCount'}
          direction={sortDirection}
          field="playCount"
          icon={<TrendingUp size={15} />}
          label={t('track.sort.mostPlayed')}
          onSort={setSort}
        />
      </div>
      <div className="track-header" role="row">
        <SortHeaderButton active={sortField === 'trackNumber'} direction={sortDirection} field="trackNumber" label="#" onSort={setSort} />
        <span />
        <SortHeaderButton
          active={sortField === 'title'}
          direction={sortDirection}
          field="title"
          label={t('track.header.title')}
          onSort={setSort}
        />
        <SortHeaderButton
          active={sortField === 'artist'}
          direction={sortDirection}
          field="artist"
          label={t('track.header.artist')}
          onSort={setSort}
        />
        <SortHeaderButton
          active={sortField === 'album'}
          direction={sortDirection}
          field="album"
          label={t('track.header.album')}
          onSort={setSort}
        />
        <span className="duration-header">
          <button
            aria-label={t('track.info.duration')}
            aria-sort={sortField === 'duration' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`track-sort-button icon ${sortField === 'duration' ? 'active' : ''}`}
            type="button"
            onClick={() => setSort('duration')}
          >
            <Clock3 size={16} />
          </button>
        </span>
        <span />
      </div>
      <div className="track-viewport" ref={scrollElementRef}>
        <div className="track-rows" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const track = tracks[virtualRow.index]
            if (!track) return null

            return (
              <div
                className="track-virtual-row"
                key={virtualRow.key}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <TrackRow
                  index={virtualRow.index}
                  isPlaying={currentTrackId === track.id}
                  onAddToQueue={addToQueue}
                  onCopyPath={handleCopyPath}
                  onGetInfo={setInfoTrack}
                  onPlayFromIndex={handlePlayFromIndex}
                  onPlayNext={playNext}
                  onShowInFileManager={handleShowInFileManager}
                  track={track}
                />
              </div>
            )
          })}
        </div>
      </div>
      {infoTrack ? <TrackInfoDialog track={infoTrack} onClose={() => setInfoTrack(null)} /> : null}
    </section>
  )
}
