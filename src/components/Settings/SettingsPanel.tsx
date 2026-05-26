import { Database, FileAudio2, Folder, Globe2, HardDrive, Keyboard, Languages, Plus, ShieldCheck, Trash2, Waves } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { tauriSettings } from '../../lib/tauri'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { errorMessage, useToastStore } from '../../stores/toastStore'
import type { AppLanguage } from '../../types'

const supportedFormats = ['MP3', 'FLAC', 'M4A', 'AAC', 'OGG', 'OPUS', 'WAV', 'AIFF', 'APE', 'WV']

const shortcutRows = [
  { keys: ['Space'], labelKey: 'settings.shortcutPlayPause' },
  { keys: ['←', '→'], labelKey: 'settings.shortcutSeek' },
  { keys: ['↑', '↓'], labelKey: 'settings.shortcutVolume' },
  { keys: ['N', 'P'], labelKey: 'settings.shortcutNextPrevious' },
  { keys: ['M'], labelKey: 'settings.shortcutMute' },
  { keys: ['L'], labelKey: 'settings.shortcutLyrics' },
  { keys: ['S'], labelKey: 'settings.shortcutShuffle' },
  { keys: ['R'], labelKey: 'settings.shortcutCycleRepeat' },
] as const

function SettingsSwitch({ enabled }: { enabled: boolean }) {
  return <span aria-hidden="true" className={`switch ${enabled ? 'on' : ''}`} />
}

export function SettingsPanel() {
  const { t } = useI18n()
  const pushToast = useToastStore((state) => state.pushToast)
  const appLanguage = useSettingsStore((state) => state.appLanguage)
  const directories = useSettingsStore((state) => state.musicDirectories)
  const replayGainEnabled = useSettingsStore((state) => state.replayGainEnabled)
  const audioOutputDevice = useSettingsStore((state) => state.audioOutputDevice)
  const audioOutputDevices = useSettingsStore((state) => state.audioOutputDevices)
  const dataLocations = useSettingsStore((state) => state.dataLocations)
  const removeMusicDirectory = useSettingsStore((state) => state.removeMusicDirectory)
  const chooseAndScanDirectory = useLibraryStore((state) => state.chooseAndScanDirectory)
  const toggleReplayGain = useSettingsStore((state) => state.toggleReplayGain)
  const setAppLanguage = useSettingsStore((state) => state.setAppLanguage)
  const setAudioOutputDevice = useSettingsStore((state) => state.setAudioOutputDevice)
  const openDataDirectory = async () => {
    try {
      await tauriSettings.openAppDataDir()
    } catch (error) {
      pushToast({ title: t('settings.dataCenterTitle'), message: errorMessage(error), tone: 'error' })
    }
  }
  const clearCoverCache = async () => {
    try {
      const count = await tauriSettings.clearCoverCache()
      pushToast({ title: t('settings.clearCoverCache'), message: t('settings.coverCacheCleared', { count }), tone: 'success' })
    } catch (error) {
      pushToast({ title: t('settings.clearCoverCache'), message: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <section className="settings-page" aria-label={t('app.settings')}>
      <div className="settings-section">
        <header>
          <Languages size={20} />
          <div>
            <h2>{t('settings.interfaceTitle')}</h2>
            <p>{t('settings.interfaceBody')}</p>
          </div>
        </header>
        <div className="settings-row">
          <div>
            <strong>{t('settings.language')}</strong>
            <p>{appLanguage === 'zh-CN' ? t('settings.languageChinese') : t('settings.languageEnglish')}</p>
          </div>
          <select
            aria-label={t('settings.language')}
            className="settings-select"
            value={appLanguage}
            onChange={(event) => void setAppLanguage(event.currentTarget.value as AppLanguage)}
          >
            <option value="en">{t('settings.languageEnglish')}</option>
            <option value="zh-CN">{t('settings.languageChinese')}</option>
          </select>
        </div>
      </div>
      <div className="settings-section">
        <header>
          <Folder size={20} />
          <div>
            <h2>{t('settings.managedDirectories')}</h2>
            <p>{t('settings.directoryBody')}</p>
          </div>
          <button className="secondary-action" type="button" onClick={() => void chooseAndScanDirectory()}>
            <Plus size={16} />
            {t('app.addFolder')}
          </button>
        </header>
        <div className="directory-list">
          {directories.map((directory) => (
            <div className="directory-row" key={directory}>
              <HardDrive size={18} />
              <span>{directory}</span>
              <button aria-label={t('settings.removeDirectory', { directory })} type="button" onClick={() => void removeMusicDirectory(directory)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section settings-two-column">
        <section>
          <header>
            <FileAudio2 size={20} />
            <div>
              <h2>{t('settings.supportedFormatsTitle')}</h2>
              <p>{t('settings.supportedFormatsBody')}</p>
            </div>
          </header>
          <div className="format-pill-grid" aria-label={t('settings.supportedFormatsTitle')}>
            {supportedFormats.map((format) => (
              <span key={format}>{format}</span>
            ))}
          </div>
        </section>

        <section>
          <header>
            <Keyboard size={20} />
            <div>
              <h2>{t('settings.shortcutsTitle')}</h2>
              <p>{t('settings.shortcutsBody')}</p>
            </div>
          </header>
          <div className="shortcut-grid">
            {shortcutRows.map((shortcut) => (
              <div className="shortcut-row" key={shortcut.labelKey}>
                <span>{t(shortcut.labelKey)}</span>
                <div>
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="settings-section settings-two-column">
        <section>
          <header>
            <Waves size={20} />
            <div>
              <h2>{t('settings.audioProcessingTitle')}</h2>
              <p>{t('settings.audioProcessingBody')}</p>
            </div>
          </header>
          <button className="settings-row button-row" type="button" onClick={() => void toggleReplayGain()}>
            <div>
              <strong>{t('settings.replayGainTitle')}</strong>
              <p>{t('settings.replayGainBody')}</p>
            </div>
            <SettingsSwitch enabled={replayGainEnabled} />
          </button>
          <div className="settings-row">
            <div>
              <strong>{t('settings.outputDevice')}</strong>
              <p>{audioOutputDevice ?? t('common.systemDefault')}</p>
            </div>
            <select
              aria-label={t('settings.audioDevice')}
              className="settings-select"
              value={audioOutputDevice ?? ''}
              onChange={(event) => void setAudioOutputDevice(event.currentTarget.value || null)}
            >
              <option value="">{t('common.systemDefault')}</option>
              {audioOutputDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.isDefault ? ` (${t('common.default')})` : ''}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <header>
            <Languages size={20} />
            <div>
              <h2>{t('settings.lyricsMetadataTitle')}</h2>
              <p>{t('settings.lyricsMetadataBody')}</p>
            </div>
          </header>
          <div className="settings-row">
            <div>
              <strong>{t('settings.lyricsSourcesTitle')}</strong>
              <p>{t('settings.lyricsSourcesBody')}</p>
            </div>
            <SettingsSwitch enabled />
          </div>
          <div className="settings-row">
            <div>
              <strong>{t('settings.aiHiddenTitle')}</strong>
              <p>{t('settings.aiHiddenBody')}</p>
            </div>
            <SettingsSwitch enabled={false} />
          </div>
        </section>
      </div>

      <div className="settings-section privacy-section">
        <header>
          <ShieldCheck size={20} />
          <div>
            <h2>{t('settings.privacyTitle')}</h2>
            <p>{t('settings.privacyBody')}</p>
          </div>
        </header>
        <div className="settings-row">
          <div>
            <strong>{t('settings.networkEnrichmentTitle')}</strong>
            <p>{t('settings.networkEnrichmentBody')}</p>
          </div>
          <SettingsSwitch enabled={false} />
        </div>
        <div className="privacy-grid">
          <div>
            <Globe2 size={18} />
            <strong>{t('settings.networkDefault')}</strong>
            <p>{t('settings.offline')}</p>
          </div>
          <div>
            <ShieldCheck size={18} />
            <strong>{t('settings.telemetry')}</strong>
            <p>{t('settings.telemetryNever')}</p>
          </div>
          <div>
            <HardDrive size={18} />
            <strong>{t('settings.userData')}</strong>
            <p>{t('settings.userDataLocation')}</p>
          </div>
        </div>
      </div>
      <div className="settings-section data-center-section">
        <header>
          <Database size={20} />
          <div>
            <h2>{t('settings.dataCenterTitle')}</h2>
            <p>{t('settings.dataCenterBody')}</p>
          </div>
          <button className="secondary-action" type="button" onClick={() => void openDataDirectory()}>
            <Folder size={16} />
            {t('settings.openDataDirectory')}
          </button>
        </header>
        <div className="data-path-grid">
          <div>
            <strong>{t('settings.userData')}</strong>
            <code>{dataLocations?.appDataDir ?? t('settings.userDataLocation')}</code>
          </div>
          <div>
            <strong>{t('settings.settingsFile')}</strong>
            <code>{dataLocations?.settingsPath ?? 'settings.json'}</code>
          </div>
          <div>
            <strong>{t('settings.libraryDatabase')}</strong>
            <code>{dataLocations?.libraryDatabasePath ?? 'library.sqlite3'}</code>
          </div>
          <div>
            <strong>{t('settings.coverCacheDir')}</strong>
            <code>{dataLocations?.coverCacheDir ?? 'cover-cache'}</code>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>{t('settings.clearCoverCache')}</strong>
            <p>{t('settings.coverCacheDir')}</p>
          </div>
          <button className="secondary-action danger-action" type="button" onClick={() => void clearCoverCache()}>
            <Trash2 size={16} />
            {t('settings.clearCoverCache')}
          </button>
        </div>
      </div>
    </section>
  )
}
