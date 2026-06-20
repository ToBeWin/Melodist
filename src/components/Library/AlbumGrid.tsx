import { useState } from 'react'
import { ArrowLeft, Play } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { toAssetUrl } from '../../lib/tauri'
import { buildAlbums, useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import type { Album } from '../../types'
import { formatDurationMs } from '../../lib/time'
import { LibraryEmptyState } from './LibraryEmptyState'

interface AlbumTileProps {
  album: Album
  onOpen: () => void
}

function AlbumArtwork({ album }: { album: Album }) {
  const coverUrl = toAssetUrl(album.coverCachePath ?? album.tracks.find((track) => track.coverCachePath)?.coverCachePath)

  return (
    <div className={`album-artwork ${coverUrl ? 'with-cover' : ''}`}>
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
        <span>{album.name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  )
}

function AlbumTile({ album, onOpen }: AlbumTileProps) {
  const { t, language } = useI18n()
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const firstTrack = album.tracks[0] ?? null
  const unit = album.trackCount === 1 ? 'track' : 'tracks'

  return (
    <article className="album-tile">
      <button
        aria-label={t('album.play', { name: album.name })}
        className="album-play-target"
        disabled={!firstTrack}
        type="button"
        onClick={() => {
          if (firstTrack) void setQueueAndPlay(album.tracks, 0)
        }}
      >
        <AlbumArtwork album={album} />
        <span className="album-play-icon">
          <Play size={18} fill="currentColor" />
        </span>
      </button>
      <button className="album-copy album-detail-trigger" type="button" onClick={onOpen}>
        <h3>{album.name}</h3>
        <p>{album.artist ?? t('common.unknownArtist')}</p>
        <span>
          {[album.year, t('album.trackCount', { count: album.trackCount, unit })].filter(Boolean).join(language === 'zh-CN' ? ' · ' : ' · ')}
        </span>
      </button>
    </article>
  )
}

function AlbumDetail({ album, onBack }: { album: Album; onBack: () => void }) {
  const { t } = useI18n()
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const firstTrack = album.tracks[0] ?? null
  const durationMs = album.tracks.reduce((total, track) => total + track.durationMs, 0)

  return (
    <section className="library-detail-view" aria-label={album.name}>
      <button className="detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>
      <div className="detail-hero">
        <AlbumArtwork album={album} />
        <div>
          <p>{t('app.albums')}</p>
          <h2>{album.name}</h2>
          <span>{[album.artist ?? t('common.unknownArtist'), t('album.trackCount', { count: album.trackCount, unit: 'tracks' }), formatDurationMs(durationMs)].join(' · ')}</span>
          <button
            className="primary-action"
            disabled={!firstTrack}
            type="button"
            onClick={() => {
              if (firstTrack) void setQueueAndPlay(album.tracks, 0)
            }}
          >
            <Play size={16} fill="currentColor" />
            {t('album.play', { name: album.name })}
          </button>
        </div>
      </div>
      <div className="detail-track-list">
        {album.tracks.map((track, index) => (
          <button key={track.id} type="button" onClick={() => void setQueueAndPlay(album.tracks, index)}>
            <span>{track.trackNumber ?? index + 1}</span>
            <strong>{track.title ?? t('common.unknownTitle')}</strong>
            <em>{formatDurationMs(track.durationMs)}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

export function AlbumGrid() {
  const { t } = useI18n()
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null)
  const tracks = useLibraryStore((state) => state.filteredTracks)
  const libraryTrackCount = useLibraryStore((state) => state.tracks.length)
  const chooseAndScanDirectory = useLibraryStore((state) => state.chooseAndScanDirectory)
  const albums = buildAlbums(tracks)
  const selectedAlbum = albums.find((album) => `${album.artist ?? 'unknown'}-${album.name}` === selectedAlbumKey) ?? null

  if (selectedAlbum) {
    return <AlbumDetail album={selectedAlbum} onBack={() => setSelectedAlbumKey(null)} />
  }

  if (albums.length === 0) {
    return (
      <section aria-label={t('app.albums')}>
        <LibraryEmptyState
          bodyKey="album.emptySearchBody"
          hasLibraryTracks={libraryTrackCount > 0}
          titleKey="album.emptySearchTitle"
          onAddFolder={() => void chooseAndScanDirectory()}
        />
      </section>
    )
  }

  return (
    <section className="album-grid" aria-label={t('app.albums')}>
      {albums.map((album) => {
        const key = `${album.artist ?? 'unknown'}-${album.name}`
        return <AlbumTile album={album} key={key} onOpen={() => setSelectedAlbumKey(key)} />
      })}
    </section>
  )
}
