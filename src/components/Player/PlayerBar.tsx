import { useState, type PointerEvent } from 'react'
import { ListMusic, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { toAssetUrl } from '../../lib/tauri'
import { formatDurationMs } from '../../lib/time'
import { usePlayerStore } from '../../stores/playerStore'
import { useUiStore } from '../../stores/uiStore'
import type { Track } from '../../types'

function fileNameFromPath(path: string) {
  return path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || path
}

function trackSubtitle(track: Track | null, addFolderHint: string) {
  if (!track) return addFolderHint
  if (track.artist && track.album) return `${track.artist} · ${track.album}`
  if (track.artist) return track.artist
  if (track.album) return track.album
  return fileNameFromPath(track.path)
}

export function PlayerBar() {
  const { t } = useI18n()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const status = usePlayerStore((state) => state.status)
  const positionMs = usePlayerStore((state) => state.positionMs)
  const volume = usePlayerStore((state) => state.volume)
  const shuffle = usePlayerStore((state) => state.shuffle)
  const repeat = usePlayerStore((state) => state.repeat)
  const lyricsOpen = usePlayerStore((state) => state.lyricsOpen)
  const play = usePlayerStore((state) => state.play)
  const pause = usePlayerStore((state) => state.pause)
  const nextTrack = usePlayerStore((state) => state.nextTrack)
  const previousTrack = usePlayerStore((state) => state.previousTrack)
  const seek = usePlayerStore((state) => state.seek)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const toggleMute = usePlayerStore((state) => state.toggleMute)
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle)
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat)
  const toggleLyrics = usePlayerStore((state) => state.toggleLyrics)
  const closeLyrics = usePlayerStore((state) => state.closeLyrics)
  const queueOpen = useUiStore((state) => state.queueOpen)
  const setActiveView = useUiStore((state) => state.setActiveView)
  const toggleQueue = useUiStore((state) => state.toggleQueue)
  const [draftSeek, setDraftSeek] = useState<{ positionMs: number; trackId: string } | null>(null)
  const [hoverSeek, setHoverSeek] = useState<{ positionMs: number; leftPercent: number } | null>(null)
  const isPlaying = status === 'playing'
  const coverUrl = toAssetUrl(currentTrack?.coverCachePath)
  const durationMs = currentTrack?.durationMs ?? 0
  const draftPositionMs = draftSeek && draftSeek.trackId === currentTrack?.id ? draftSeek.positionMs : null
  const displayedPositionMs = Math.min(draftPositionMs ?? positionMs, durationMs)
  const volumeLabel = volume > 0 ? t('player.mute') : t('player.unmute')

  const handlePrimaryPlayback = () => {
    if (!currentTrack) return
    if (status === 'playing' || status === 'paused') {
      void pause()
      return
    }
    void play(currentTrack)
  }
  const handleToggleQueue = () => {
    if (!queueOpen) {
      closeLyrics()
    }
    toggleQueue()
  }
  const commitSeek = (position: number) => {
    const nextPosition = Math.min(Math.max(0, position), durationMs)
    setDraftSeek(null)
    if (!currentTrack) return
    void seek(nextPosition)
  }
  const updateHoverSeek = (event: PointerEvent<HTMLInputElement>) => {
    if (!currentTrack || durationMs <= 0) {
      setHoverSeek(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1)
    setHoverSeek({
      positionMs: Math.round(durationMs * ratio),
      leftPercent: ratio * 100,
    })
  }

  return (
    <footer className="player-bar">
      <div className="player-track">
        <button
          aria-label={t('app.nowPlaying')}
          className={`player-artwork ${coverUrl ? 'with-cover' : ''}`}
          disabled={!currentTrack}
          type="button"
          onClick={() => setActiveView('nowPlaying')}
        >
          {coverUrl ? (
            <img
              alt=""
              src={coverUrl}
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
        </button>
        <div>
          <p>{currentTrack?.title ?? t('now.noTrackTitle')}</p>
          <span>{trackSubtitle(currentTrack, t('player.addFolderHint'))}</span>
        </div>
      </div>
      <div className="transport">
        <div className="transport-buttons">
          <button aria-pressed={shuffle} aria-label={t('player.shuffle')} className={shuffle ? 'active' : ''} type="button" onClick={() => void toggleShuffle()}>
            <Shuffle size={18} />
          </button>
          <button aria-label={t('player.previous')} disabled={!currentTrack} type="button" onClick={() => void previousTrack()}>
            <SkipBack size={18} />
          </button>
          <button
            aria-label={isPlaying ? t('player.pause') : t('player.play')}
            className="play-button"
            disabled={!currentTrack}
            type="button"
            onClick={handlePrimaryPlayback}
          >
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button aria-label={t('player.next')} disabled={!currentTrack} type="button" onClick={() => void nextTrack()}>
            <SkipForward size={18} />
          </button>
          <button aria-label={t('player.repeat', { mode: repeat })} className={repeat !== 'none' ? 'active' : ''} type="button" onClick={() => void cycleRepeat()}>
            <Repeat size={18} />
          </button>
        </div>
        <div className="progress-line">
          <span>{formatDurationMs(displayedPositionMs)}</span>
          <div className="progress-control">
            {hoverSeek ? (
              <span className="progress-tooltip" style={{ left: `${hoverSeek.leftPercent}%` }}>
                {formatDurationMs(hoverSeek.positionMs)}
              </span>
            ) : null}
            <input
              aria-label={t('player.progress')}
              disabled={!currentTrack}
              max={durationMs}
              min={0}
              title={hoverSeek ? formatDurationMs(hoverSeek.positionMs) : undefined}
              type="range"
              value={displayedPositionMs}
              onBlur={(event) => {
                setHoverSeek(null)
                if (draftPositionMs !== null) commitSeek(Number(event.currentTarget.value))
              }}
              onChange={(event) => {
                if (!currentTrack) return
                setDraftSeek({ positionMs: Number(event.currentTarget.value), trackId: currentTrack.id })
              }}
              onKeyUp={(event) => {
                if (draftPositionMs !== null) commitSeek(Number(event.currentTarget.value))
              }}
              onPointerLeave={() => setHoverSeek(null)}
              onPointerMove={updateHoverSeek}
              onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
            />
          </div>
          <span>{formatDurationMs(durationMs)}</span>
        </div>
      </div>
      <div className="player-tools">
        <button aria-pressed={queueOpen} aria-label={t('queue.title')} className={queueOpen ? 'active' : ''} type="button" onClick={handleToggleQueue}>
          <ListMusic size={18} />
        </button>
        <button aria-pressed={lyricsOpen} aria-label={t('lyrics.toggle')} className={lyricsOpen ? 'active' : ''} type="button" onClick={toggleLyrics}>
          {t('player.lyrics')}
        </button>
        <button aria-label={volumeLabel} title={volumeLabel} type="button" onClick={() => void toggleMute()}>
          {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <input
          aria-label={t('player.volume')}
          max={1}
          min={0}
          step={0.01}
          type="range"
          value={volume}
          onChange={(event) => void setVolume(Number(event.currentTarget.value))}
        />
      </div>
    </footer>
  )
}
