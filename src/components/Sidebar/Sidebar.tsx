import { Album, Library, Mic2, Music2, Settings, SlidersHorizontal } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { useUiStore, type AppView } from '../../stores/uiStore'

const navItems: Array<{ labelKey: 'app.library' | 'app.albums' | 'app.artists' | 'app.nowPlaying'; icon: typeof Library; view: AppView }> = [
  { labelKey: 'app.library', icon: Library, view: 'library' },
  { labelKey: 'app.albums', icon: Album, view: 'albums' },
  { labelKey: 'app.artists', icon: Mic2, view: 'artists' },
  { labelKey: 'app.nowPlaying', icon: Music2, view: 'nowPlaying' },
]

export function Sidebar() {
  const { t } = useI18n()
  const activeView = useUiStore((state) => state.activeView)
  const setActiveView = useUiStore((state) => state.setActiveView)

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <h1>Melodist</h1>
        <p>{t('sidebar.tagline')}</p>
      </div>
      <nav className="nav-list" aria-label={t('sidebar.mainNavigation')}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              aria-current={activeView === item.view ? 'page' : undefined}
              className={`nav-item ${activeView === item.view ? 'active' : ''}`}
              key={item.labelKey}
              type="button"
              onClick={() => setActiveView(item.view)}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </nav>
      <button
        aria-current={activeView === 'settings' ? 'page' : undefined}
        className={`nav-item settings-link ${activeView === 'settings' ? 'active' : ''}`}
        type="button"
        onClick={() => setActiveView('settings')}
      >
        <Settings size={20} strokeWidth={2} />
        <span>{t('app.settings')}</span>
      </button>
      <div className="sidebar-status">
        <SlidersHorizontal size={16} />
        <span>{t('sidebar.private')}</span>
      </div>
    </aside>
  )
}
