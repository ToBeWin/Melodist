import { X } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { formatDurationMs } from '../../lib/time'
import type { Track } from '../../types'

interface TrackInfoDialogProps {
  onClose: () => void
  track: Track
}

function fileNameFromPath(path: string) {
  return path.split(/[/\\]/).pop() ?? path
}

function formatFileSize(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`
}

function formatDate(timestamp: number) {
  if (timestamp <= 0) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
}

function formatBitrate(bitrate: number | null) {
  if (!bitrate) return null
  return `${Math.round(bitrate / 1000)} kbps`
}

function formatSampleRate(sampleRate: number) {
  return sampleRate > 0 ? `${(sampleRate / 1000).toFixed(1)} kHz` : null
}

function MetadataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function TrackInfoDialog({ onClose, track }: TrackInfoDialogProps) {
  const { t } = useI18n()
  const title = track.title ?? fileNameFromPath(track.path)
  const trackNumber =
    track.trackNumber === null && track.discNumber === null
      ? null
      : [track.discNumber, track.trackNumber].filter(Boolean).join(' / ')

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={t('track.info.title')}
        aria-modal="true"
        className="track-info-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>{t('track.info.title')}</p>
            <h2>{title}</h2>
          </div>
          <button aria-label={t('track.info.close')} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <dl>
          <MetadataRow label={t('track.info.artist')} value={track.artist} />
          <MetadataRow label={t('track.info.album')} value={track.album} />
          <MetadataRow label={t('track.info.genre')} value={track.genre} />
          <MetadataRow label={t('track.info.trackNumber')} value={trackNumber} />
          <MetadataRow label={t('track.info.duration')} value={formatDurationMs(track.durationMs)} />
          <MetadataRow label={t('track.info.sampleRate')} value={formatSampleRate(track.sampleRate)} />
          <MetadataRow label={t('track.info.bitDepth')} value={track.bitDepth ? `${track.bitDepth}-bit` : null} />
          <MetadataRow label={t('track.info.bitrate')} value={formatBitrate(track.bitrate)} />
          <MetadataRow label={t('track.info.fileSize')} value={formatFileSize(track.fileSize)} />
          <MetadataRow label={t('track.info.playCount')} value={track.playCount} />
          <MetadataRow label={t('track.info.lastPlayed')} value={formatDate(track.lastPlayed ?? 0)} />
          <MetadataRow label={t('track.info.added')} value={formatDate(track.dateAdded)} />
          <MetadataRow label={t('track.info.path')} value={track.path} />
        </dl>
      </section>
    </div>
  )
}
