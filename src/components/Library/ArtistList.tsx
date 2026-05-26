import { useState } from 'react'
import { Album, ArrowLeft, Clock3, Play } from 'lucide-react'

import { formatDurationMs } from '../../lib/time'
import { useI18n } from '../../lib/i18n'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import type { Track } from '../../types'
import { LibraryEmptyState } from './LibraryEmptyState'

interface ArtistSummary {
  name: string
  albums: string[]
  tracks: Track[]
  durationMs: number
}

const buildArtistSummaries = (tracks: Track[], unknownArtist: string, unknownAlbum: string): ArtistSummary[] => {
  const summaries = tracks.reduce<Record<string, ArtistSummary>>((accumulator, track) => {
    const name = track.artist ?? unknownArtist
    const existing = accumulator[name]
    const album = track.album ?? unknownAlbum
    if (existing) {
      existing.tracks.push(track)
      existing.durationMs += track.durationMs
      if (!existing.albums.includes(album)) existing.albums.push(album)
      return accumulator
    }
    accumulator[name] = {
      name,
      albums: [album],
      tracks: [track],
      durationMs: track.durationMs,
    }
    return accumulator
  }, {})

  return Object.values(summaries).sort((first, second) => first.name.localeCompare(second.name))
}

export function ArtistList() {
  const { t } = useI18n()
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null)
  const tracks = useLibraryStore((state) => state.filteredTracks)
  const libraryTrackCount = useLibraryStore((state) => state.tracks.length)
  const chooseAndScanDirectory = useLibraryStore((state) => state.chooseAndScanDirectory)
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const artists = buildArtistSummaries(tracks, t('common.unknownArtist'), t('common.unknownAlbum'))
  const selectedArtist = artists.find((artist) => artist.name === selectedArtistName) ?? null

  if (selectedArtist) {
    const firstTrack = selectedArtist.tracks[0] ?? null
    return (
      <section className="library-detail-view" aria-label={selectedArtist.name}>
        <button className="detail-back" type="button" onClick={() => setSelectedArtistName(null)}>
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
        <div className="detail-hero artist-detail-hero">
          <div className="artist-avatar large" aria-hidden="true">
            {selectedArtist.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p>{t('app.artists')}</p>
            <h2>{selectedArtist.name}</h2>
            <span>
              {[t('artist.albumCount', { count: selectedArtist.albums.length }), t('artist.trackCount', { count: selectedArtist.tracks.length }), formatDurationMs(selectedArtist.durationMs)].join(' · ')}
            </span>
            <button
              className="primary-action"
              disabled={!firstTrack}
              type="button"
              onClick={() => {
                if (firstTrack) void setQueueAndPlay(selectedArtist.tracks, 0)
              }}
            >
              <Play size={16} fill="currentColor" />
              {t('artist.play', { name: selectedArtist.name })}
            </button>
          </div>
        </div>
        <div className="detail-chip-row">
          {selectedArtist.albums.map((album) => (
            <span key={album}>{album}</span>
          ))}
        </div>
        <div className="detail-track-list">
          {selectedArtist.tracks.map((track, index) => (
            <button key={track.id} type="button" onClick={() => void setQueueAndPlay(selectedArtist.tracks, index)}>
              <span>{index + 1}</span>
              <strong>{track.title ?? t('common.unknownTitle')}</strong>
              <em>{track.album ?? t('common.unknownAlbum')}</em>
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (artists.length === 0) {
    return (
      <section aria-label={t('app.artists')}>
        <LibraryEmptyState
          bodyKey="artist.emptySearchBody"
          hasLibraryTracks={libraryTrackCount > 0}
          titleKey="artist.emptySearchTitle"
          onAddFolder={() => void chooseAndScanDirectory()}
        />
      </section>
    )
  }

  return (
    <section className="artist-list" aria-label={t('app.artists')}>
      {artists.map((artist) => {
        const firstTrack = artist.tracks[0] ?? null
        return (
          <article className="artist-row" key={artist.name} onDoubleClick={() => setSelectedArtistName(artist.name)}>
            <div className="artist-avatar" aria-hidden="true">
              {artist.name.slice(0, 1).toUpperCase()}
            </div>
            <button className="artist-primary artist-detail-trigger" type="button" onClick={() => setSelectedArtistName(artist.name)}>
              <h3>{artist.name}</h3>
              <p>{artist.albums.slice(0, 3).join(' · ')}</p>
            </button>
            <span className="artist-stat">
              <Album size={16} />
              {artist.albums.length}
            </span>
            <span className="artist-stat">
              <Clock3 size={16} />
              {formatDurationMs(artist.durationMs)}
            </span>
            <button
              aria-label={t('album.play', { name: artist.name })}
              disabled={!firstTrack}
              type="button"
              onClick={() => {
                if (firstTrack) void setQueueAndPlay(artist.tracks, 0)
              }}
            >
              <Play size={16} fill="currentColor" />
            </button>
          </article>
        )
      })}
    </section>
  )
}
