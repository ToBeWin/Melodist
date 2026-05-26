import { FileAudio2, FolderPlus, Play, ShieldCheck } from 'lucide-react'

import { useI18n } from '../../lib/i18n'

interface LibraryEmptyStateProps {
  bodyKey?: 'track.emptySearchBody' | 'album.emptySearchBody' | 'artist.emptySearchBody'
  hasLibraryTracks: boolean
  onAddFolder: () => void
  titleKey?: 'track.emptySearchTitle' | 'album.emptySearchTitle' | 'artist.emptySearchTitle'
}

export function LibraryEmptyState({
  bodyKey = 'track.emptySearchBody',
  hasLibraryTracks,
  onAddFolder,
  titleKey = 'track.emptySearchTitle',
}: LibraryEmptyStateProps) {
  const { t } = useI18n()

  if (hasLibraryTracks) {
    return (
      <div className="track-empty compact" role="status">
        <h3>{t(titleKey)}</h3>
        <p>{t(bodyKey)}</p>
      </div>
    )
  }

  return (
    <div className="track-empty onboarding" role="status">
      <div className="onboarding-mark" aria-hidden="true">
        <FileAudio2 size={26} />
      </div>
      <h3>{t('track.emptyTitle')}</h3>
      <p>{t('track.emptyBody')}</p>
      <button className="primary-action" type="button" onClick={onAddFolder}>
        <FolderPlus size={16} />
        {t('track.onboardingAddFolder')}
      </button>
      <div className="onboarding-grid">
        <div>
          <FileAudio2 size={17} />
          <span>{t('track.onboardingFormats')}</span>
        </div>
        <div>
          <Play size={17} />
          <span>{t('track.onboardingPlayback')}</span>
        </div>
        <div>
          <ShieldCheck size={17} />
          <span>{t('track.onboardingPrivate')}</span>
        </div>
      </div>
    </div>
  )
}
