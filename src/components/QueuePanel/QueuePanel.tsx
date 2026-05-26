import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, ListMusic, RotateCcw, Trash2, X } from 'lucide-react'

import { shouldScrollQueueToCurrent } from '../../lib/queue'
import { useI18n } from '../../lib/i18n'
import { formatDurationMs } from '../../lib/time'
import { usePlayerStore } from '../../stores/playerStore'
import { useUiStore } from '../../stores/uiStore'

export function QueuePanel() {
  const { t } = useI18n()
  const queueOpen = useUiStore((state) => state.queueOpen)
  const closeQueue = useUiStore((state) => state.closeQueue)
  const queue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue)
  const moveQueueTrack = usePlayerStore((state) => state.moveQueueTrack)
  const moveQueueTrackTo = usePlayerStore((state) => state.moveQueueTrackTo)
  const clearPlayedFromQueue = usePlayerStore((state) => state.clearPlayedFromQueue)
  const clearQueue = usePlayerStore((state) => state.clearQueue)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const currentRowRef = useRef<HTMLDivElement | null>(null)
  const previousQueueOpenRef = useRef(false)
  const previousCurrentIndexRef = useRef<number | null>(null)
  const hasPlayedItems = currentIndex !== null && currentIndex > 0

  useEffect(() => {
    const shouldScroll = shouldScrollQueueToCurrent(
      queueOpen,
      previousQueueOpenRef.current,
      previousCurrentIndexRef.current,
      currentIndex,
    )
    previousQueueOpenRef.current = queueOpen
    previousCurrentIndexRef.current = currentIndex

    if (shouldScroll) {
      currentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentIndex, queueOpen])

  if (!queueOpen) return null

  return (
    <aside className="queue-panel" aria-label={t('queue.panel')}>
      <header>
        <div>
          <h2>
            <ListMusic size={18} />
            {t('queue.title')}
          </h2>
          <p>{queue.length > 0 ? t('queue.loaded', { count: queue.length }) : t('queue.none')}</p>
        </div>
        <div className="queue-header-actions">
          {hasPlayedItems ? (
            <button aria-label={t('queue.clearPlayed')} title={t('queue.clearPlayed')} type="button" onClick={() => void clearPlayedFromQueue()}>
              <RotateCcw size={16} />
            </button>
          ) : null}
          {queue.length > 0 ? (
            <button aria-label={t('queue.clear')} type="button" onClick={() => void clearQueue()}>
              <Trash2 size={16} />
            </button>
          ) : null}
          <button aria-label={t('queue.close')} type="button" onClick={closeQueue}>
            <X size={18} />
          </button>
        </div>
      </header>
      {queue.length === 0 ? (
        <p className="queue-empty">{t('queue.empty')}</p>
      ) : (
        <div className="queue-list">
          {queue.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id && currentIndex === index
            return (
              <div
                aria-current={isCurrent ? 'true' : undefined}
                className={`queue-panel-row ${isCurrent ? 'current' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                draggable
                key={`${track.id}-${index}`}
                ref={isCurrent ? currentRowRef : undefined}
                onDragEnd={() => setDraggedIndex(null)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDragStart={(event) => {
                  setDraggedIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', String(index))
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const sourceIndex = draggedIndex ?? Number(event.dataTransfer.getData('text/plain'))
                  setDraggedIndex(null)
                  if (Number.isNaN(sourceIndex)) return
                  void moveQueueTrackTo(sourceIndex, index)
                }}
              >
                <GripVertical className="queue-drag-handle" size={15} aria-hidden="true" />
                <button className="queue-track-button" type="button" onClick={() => void setQueueAndPlay(queue, index)}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{track.title ?? t('common.unknownTitle')}</strong>
                    <small>{track.artist ?? track.album ?? t('common.localFile')}</small>
                  </div>
                  <em>{formatDurationMs(track.durationMs)}</em>
                </button>
                <div className="queue-row-actions">
                  <button aria-label={t('queue.moveUp')} disabled={index === 0} type="button" onClick={() => void moveQueueTrack(index, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={t('queue.moveDown')}
                    disabled={index === queue.length - 1}
                    type="button"
                    onClick={() => void moveQueueTrack(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button aria-label={t('queue.remove')} type="button" onClick={() => void removeFromQueue(index)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
