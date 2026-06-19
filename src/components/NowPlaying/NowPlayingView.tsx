import { Disc3, ListMusic, Pause, Play, Radio, Volume2 } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { toAssetUrl } from '../../lib/tauri'
import { formatDurationMs } from '../../lib/time'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import type { Track } from '../../types'

const statusLabelKeys = {
  loading: 'player.status.loading',
  paused: 'player.status.paused',
  playing: 'player.status.playing',
  stopped: 'player.status.stopped',
} as const

function formatFileSize(bytes: number) {
  const megabytes = bytes / 1024 / 1024
  return `${megabytes.toFixed(1)} MB`
}

function formatAudioRate(track: Track, bitDepthUnknown: string) {
  const khz = (track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)
  const depth = track.bitDepth ? `${track.bitDepth}-bit` : bitDepthUnknown
  return `${khz} kHz · ${depth}`
}

export function NowPlayingView() {
  const { t } = useI18n()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const status = usePlayerStore((state) => state.status)
  const play = usePlayerStore((state) => state.play)
  const pause = usePlayerStore((state) => state.pause)
  const playerQueue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const tracks = useLibraryStore((state) => state.filteredTracks)
  const queueSource = playerQueue.length > 0 ? playerQueue : tracks
  const isPlaying = status === 'playing'
  const coverUrl = toAssetUrl(currentTrack?.coverCachePath)

  if (!currentTrack) {
    return (
      <section className="now-playing-view" aria-label={t('app.nowPlaying')}>
        <div className="track-empty now-playing-empty">
          <h3>{t('now.noTrackTitle')}</h3>
          <p>{t('now.noTrackBody')}</p>
        </div>
      </section>
    )
  }

  const queue =
    currentIndex === null
      ? queueSource.filter((track) => track.id !== currentTrack.id).slice(0, 4)
      : queueSource.slice(currentIndex + 1, currentIndex + 5)
  const playQueueTrack = (track: Track) => {
    const queueIndex = queueSource.findIndex((queueTrack) => queueTrack.id === track.id)
    if (queueIndex < 0) return
    void setQueueAndPlay(queueSource, queueIndex)
  }

  return (
    <section className="now-playing-view" aria-label={t('app.nowPlaying')}>
      <div className={`now-playing-artwork ${coverUrl ? 'with-cover' : ''}`}>
        {coverUrl ? (
          <img
            alt=""
            src={coverUrl}
            onLoad={(event) => {
              event.currentTarget.style.display = ''
            }}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="now-artwork-disc" />
        )}
      </div>
      <div className="now-playing-detail">
        <div className="now-title-row">
          <div>
            <h2>{currentTrack.title ?? t('common.unknownTitle')}</h2>
            <p>{currentTrack.artist ?? t('common.unknownArtist')}</p>
          </div>
          <button
            aria-label={isPlaying ? t('player.pause') : t('player.play')}
            className="now-play-button"
            type="button"
            onClick={() => {
              if (status === 'playing' || status === 'paused') {
                void pause()
                return
              }
              void play(currentTrack)
            }}
          >
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
        </div>
        <div className="metadata-grid" aria-label={t('now.audioMetadata')}>
          <div>
            <span>{t('now.album')}</span>
            <strong>{currentTrack.album ?? t('common.unknownAlbum')}</strong>
          </div>
          <div>
            <span>{t('now.format')}</span>
            <strong>{formatAudioRate(currentTrack, t('now.bitDepthUnknown'))}</strong>
          </div>
          <div>
            <span>{t('now.bitrate')}</span>
            <strong>{currentTrack.bitrate ? `${Math.round(currentTrack.bitrate / 1000)} kbps` : t('common.unknown')}</strong>
          </div>
          <div>
            <span>{t('now.duration')}</span>
            <strong>{formatDurationMs(currentTrack.durationMs)}</strong>
          </div>
          <div>
            <span>{t('now.genre')}</span>
            <strong>{currentTrack.genre ?? t('common.unknown')}</strong>
          </div>
          <div>
            <span>{t('now.file')}</span>
            <strong>{formatFileSize(currentTrack.fileSize)}</strong>
          </div>
        </div>
        <div className="waveform-panel" aria-label={t('now.audioMetadata')}>
          {Array.from({ length: 56 }, (_, index) => (
            <span key={index} style={{ height: `${18 + ((index * 17) % 48)}px` }} />
          ))}
        </div>
        <div className="queue-preview">
          <header>
            <h3>
              <ListMusic size={18} />
              {t('queue.title')}
            </h3>
            <span>{t('now.upcoming', { count: queue.length })}</span>
          </header>
          {queue.map((track, index) => (
            <button
              className="queue-row"
              key={track.id}
              type="button"
              onClick={() => playQueueTrack(track)}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{track.title ?? t('common.unknownTitle')}</strong>
                <small>{track.artist ?? t('common.unknownArtist')}</small>
              </div>
              <em>{formatDurationMs(track.durationMs)}</em>
            </button>
          ))}
        </div>
      </div>
      <aside className="listening-context" aria-label={t('now.playbackContext')}>
        <div>
          <Radio size={18} />
          <span>{t('now.status')}</span>
          <strong>{t(statusLabelKeys[status])}</strong>
        </div>
        <div>
          <Disc3 size={18} />
          <span>{t('now.plays')}</span>
          <strong>{currentTrack.playCount}</strong>
        </div>
        <div>
          <Volume2 size={18} />
          <span>{t('now.source')}</span>
          <strong>{t('common.localFile')}</strong>
        </div>
      </aside>
    </section>
  )
}
