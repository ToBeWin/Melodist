import { useSettingsStore } from '../stores/settingsStore'
import type { AppLanguage } from '../types'

type TranslationKey =
  | 'album.play'
  | 'album.emptySearchBody'
  | 'album.emptySearchTitle'
  | 'album.trackCount'
  | 'app.addFolder'
  | 'app.albums'
  | 'app.artists'
  | 'app.clearSearch'
  | 'app.dropImportBody'
  | 'app.dropImportTitle'
  | 'app.library'
  | 'app.nowPlaying'
  | 'app.refresh'
  | 'app.search'
  | 'app.searchHelp'
  | 'app.searchStats'
  | 'app.searchStatsFiltered'
  | 'app.searchSyntaxShort'
  | 'app.settings'
  | 'app.scanning'
  | 'app.scanProgress'
  | 'app.libraryView'
  | 'app.tracks'
  | 'artist.albumCount'
  | 'artist.emptySearchBody'
  | 'artist.emptySearchTitle'
  | 'artist.play'
  | 'artist.trackCount'
  | 'common.back'
  | 'common.default'
  | 'common.details'
  | 'common.dismissNotification'
  | 'common.localFile'
  | 'common.systemDefault'
  | 'common.unknown'
  | 'common.unknownAlbum'
  | 'common.unknownArtist'
  | 'common.unknownTitle'
  | 'lyrics.bilingual'
  | 'lyrics.close'
  | 'lyrics.displayMode'
  | 'lyrics.empty'
  | 'lyrics.loading'
  | 'lyrics.loadFailed'
  | 'lyrics.local'
  | 'lyrics.noTrack'
  | 'lyrics.noteEstimated'
  | 'lyrics.noteUntimed'
  | 'lyrics.offset'
  | 'lyrics.offsetDecrease'
  | 'lyrics.offsetIncrease'
  | 'lyrics.offsetReset'
  | 'lyrics.original'
  | 'lyrics.panel'
  | 'lyrics.saveLrc'
  | 'lyrics.saveLrcComplete'
  | 'lyrics.saveLrcFailed'
  | 'lyrics.saveLrcHint'
  | 'lyrics.seekEstimatedLine'
  | 'lyrics.source.embedded'
  | 'lyrics.source.estimated'
  | 'lyrics.source.generated'
  | 'lyrics.source.lrcFile'
  | 'lyrics.source.manual'
  | 'lyrics.source.timed'
  | 'lyrics.source.untimed'
  | 'lyrics.toggle'
  | 'lyrics.translation'
  | 'library.importBusyBody'
  | 'library.importBusyTitle'
  | 'library.importCompleteTitle'
  | 'library.importFailedTitle'
  | 'library.importIssueTitle'
  | 'library.dropUnavailableTitle'
  | 'library.loadFailedTitle'
  | 'library.scanCompleteTitle'
  | 'library.scanFailedTitle'
  | 'library.scanIssueTitle'
  | 'library.scanResultFailed'
  | 'library.scanResultFirstIssue'
  | 'library.scanResultSummary'
  | 'library.watchFailedTitle'
  | 'now.album'
  | 'now.audioMetadata'
  | 'now.bitrate'
  | 'now.bitDepthUnknown'
  | 'now.duration'
  | 'now.file'
  | 'now.format'
  | 'now.genre'
  | 'now.noTrackBody'
  | 'now.noTrackTitle'
  | 'now.playbackContext'
  | 'now.plays'
  | 'now.ready'
  | 'now.source'
  | 'now.status'
  | 'now.upcoming'
  | 'player.addFolderHint'
  | 'player.error.audioOutput'
  | 'player.error.nextTrack'
  | 'player.error.playback'
  | 'player.error.playbackControl'
  | 'player.error.previousTrack'
  | 'player.error.queuePlayback'
  | 'player.error.queueRecovery'
  | 'player.error.queueUpdate'
  | 'player.error.repeatUpdate'
  | 'player.error.sessionRestore'
  | 'player.error.seek'
  | 'player.error.shuffleUpdate'
  | 'player.error.volumeUpdate'
  | 'player.lyrics'
  | 'player.next'
  | 'player.pause'
  | 'player.play'
  | 'player.previous'
  | 'player.progress'
  | 'player.repeat'
  | 'player.shuffle'
  | 'player.status.loading'
  | 'player.status.paused'
  | 'player.status.playing'
  | 'player.status.stopped'
  | 'player.mute'
  | 'player.unmute'
  | 'player.volume'
  | 'player.recovery.currentTrack'
  | 'player.recovery.skippingTitle'
  | 'player.recovery.skippingBody'
  | 'queue.close'
  | 'queue.clear'
  | 'queue.clearPlayed'
  | 'queue.empty'
  | 'queue.loaded'
  | 'queue.moveDown'
  | 'queue.moveUp'
  | 'queue.none'
  | 'queue.panel'
  | 'queue.remove'
  | 'queue.title'
  | 'settings.aiHiddenBody'
  | 'settings.aiHiddenTitle'
  | 'settings.audioDevice'
  | 'settings.audioProcessingBody'
  | 'settings.audioProcessingTitle'
  | 'settings.clearCoverCache'
  | 'settings.coverCacheCleared'
  | 'settings.coverCacheDir'
  | 'settings.dataCenterBody'
  | 'settings.dataCenterTitle'
  | 'settings.libraryDatabase'
  | 'settings.directoryBody'
  | 'settings.interfaceBody'
  | 'settings.interfaceTitle'
  | 'settings.language'
  | 'settings.languageChinese'
  | 'settings.languageEnglish'
  | 'settings.lyricsMetadataBody'
  | 'settings.lyricsMetadataTitle'
  | 'settings.lyricsSourcesBody'
  | 'settings.lyricsSourcesTitle'
  | 'settings.managedDirectories'
  | 'settings.networkDefault'
  | 'settings.networkEnrichmentBody'
  | 'settings.networkEnrichmentTitle'
  | 'settings.outputDevice'
  | 'settings.offline'
  | 'settings.openDataDirectory'
  | 'settings.privacyBody'
  | 'settings.privacyTitle'
  | 'settings.removeDirectory'
  | 'settings.replayGainBody'
  | 'settings.replayGainTitle'
  | 'settings.shortcutCycleRepeat'
  | 'settings.shortcutLyrics'
  | 'settings.shortcutMute'
  | 'settings.shortcutNextPrevious'
  | 'settings.shortcutPlayPause'
  | 'settings.shortcutSeek'
  | 'settings.shortcutShuffle'
  | 'settings.shortcutVolume'
  | 'settings.shortcutsBody'
  | 'settings.shortcutsTitle'
  | 'settings.supportedFormatsBody'
  | 'settings.supportedFormatsTitle'
  | 'settings.telemetry'
  | 'settings.telemetryNever'
  | 'settings.userData'
  | 'settings.settingsFile'
  | 'settings.userDataLocation'
  | 'sidebar.private'
  | 'sidebar.mainNavigation'
  | 'sidebar.tagline'
  | 'track.actions.copiedPath'
  | 'track.actions.addToQueue'
  | 'track.actions.copyPath'
  | 'track.actions.getInfo'
  | 'track.actions.more'
  | 'track.actions.playNext'
  | 'track.actions.playFromHere'
  | 'track.actions.queued'
  | 'track.actions.showInFileManager'
  | 'track.activity.played'
  | 'track.activity.plays'
  | 'track.activity.unplayed'
  | 'track.info.added'
  | 'track.info.album'
  | 'track.info.artist'
  | 'track.info.audio'
  | 'track.info.bitDepth'
  | 'track.info.bitrate'
  | 'track.info.close'
  | 'track.info.duration'
  | 'track.info.file'
  | 'track.info.fileSize'
  | 'track.info.genre'
  | 'track.info.path'
  | 'track.info.lastPlayed'
  | 'track.info.playCount'
  | 'track.info.sampleRate'
  | 'track.info.title'
  | 'track.info.trackNumber'
  | 'track.emptyBody'
  | 'track.emptySearchBody'
  | 'track.emptySearchTitle'
  | 'track.emptyTitle'
  | 'track.onboardingAddFolder'
  | 'track.onboardingFormats'
  | 'track.onboardingPlayback'
  | 'track.onboardingPrivate'
  | 'track.header.added'
  | 'track.header.album'
  | 'track.header.artist'
  | 'track.header.title'
  | 'track.list'
  | 'track.sort.ascending'
  | 'track.sort.ascendingShort'
  | 'track.sort.descending'
  | 'track.sort.descendingShort'
  | 'track.sort.libraryOrder'
  | 'track.sort.mostPlayed'
  | 'track.sort.presets'
  | 'track.sort.recentlyPlayed'

type TranslationParams = Record<string, string | number>

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'album.play': 'Play {name}',
    'album.emptySearchBody': 'No albums match the current search. Try title:, artist:, album:, or clear the search.',
    'album.emptySearchTitle': 'No matching albums',
    'album.trackCount': '{count} {unit}',
    'app.addFolder': 'Add Folder',
    'app.albums': 'Albums',
    'app.artists': 'Artists',
    'app.clearSearch': 'Clear search',
    'app.dropImportBody': 'Add audio files or folders to your local library.',
    'app.dropImportTitle': 'Drop to import music',
    'app.library': 'Library',
    'app.nowPlaying': 'Now Playing',
    'app.refresh': 'Refresh',
    'app.search': 'Search library...',
    'app.searchHelp': 'Search by keyword or use fields like artist:, album:, title:, genre:, path:',
    'app.searchStats': '{total} tracks in library',
    'app.searchStatsFiltered': '{count} of {total} tracks',
    'app.searchSyntaxShort': 'Fields: artist: album: title: genre: path:',
    'app.settings': 'Settings',
    'app.scanning': 'Scanning {scanned} / {total} tracks...',
    'app.scanProgress': 'Library scan progress',
    'app.libraryView': 'Library view',
    'app.tracks': 'Tracks',
    'artist.albumCount': '{count} albums',
    'artist.emptySearchBody': 'No artists match the current search. Try artist: or clear the search.',
    'artist.emptySearchTitle': 'No matching artists',
    'artist.play': 'Play {name}',
    'artist.trackCount': '{count} tracks',
    'common.back': 'Back',
    'common.default': 'default',
    'common.details': 'Details',
    'common.dismissNotification': 'Dismiss notification',
    'common.localFile': 'Local file',
    'common.systemDefault': 'System default',
    'common.unknown': 'Unknown',
    'common.unknownAlbum': 'Unknown Album',
    'common.unknownArtist': 'Unknown Artist',
    'common.unknownTitle': 'Unknown Title',
    'lyrics.bilingual': 'Bilingual',
    'lyrics.close': 'Close lyrics',
    'lyrics.displayMode': 'Lyrics display mode',
    'lyrics.empty': 'No embedded lyrics or matching .lrc file found.',
    'lyrics.loading': 'Loading local lyrics...',
    'lyrics.loadFailed': 'Failed to load lyrics',
    'lyrics.local': 'Local lyrics',
    'lyrics.noTrack': 'Play a local track to load embedded lyrics or a same-name .lrc file.',
    'lyrics.noteEstimated': 'This embedded lyric has no timestamps, so Melodist is estimating the active line from playback progress. Add a same-name .lrc file for precise sync.',
    'lyrics.noteUntimed': 'This embedded lyric has no timestamps. Add a same-name .lrc file for synced playback.',
    'lyrics.offset': 'Lyric offset {offset} ms',
    'lyrics.offsetDecrease': 'Lyrics earlier',
    'lyrics.offsetIncrease': 'Lyrics later',
    'lyrics.offsetReset': 'Reset offset',
    'lyrics.original': 'Original',
    'lyrics.panel': 'Lyrics panel',
    'lyrics.saveLrc': 'Save LRC',
    'lyrics.saveLrcComplete': 'LRC saved',
    'lyrics.saveLrcFailed': 'Failed to save lyrics',
    'lyrics.saveLrcHint': 'Paste timestamped LRC text here. Saving writes a same-name .lrc file beside the track.',
    'lyrics.seekEstimatedLine': 'Seek to estimated lyric position',
    'lyrics.source.embedded': 'embedded',
    'lyrics.source.estimated': 'estimated {source} lyrics',
    'lyrics.source.generated': 'generated',
    'lyrics.source.lrcFile': 'LRC file',
    'lyrics.source.manual': 'manual',
    'lyrics.source.timed': '{source} lyrics',
    'lyrics.source.untimed': 'untimed {source} lyrics',
    'lyrics.toggle': 'Toggle lyrics',
    'lyrics.translation': 'Translation',
    'library.importBusyBody': 'Wait for the current scan to finish before dropping more files.',
    'library.importBusyTitle': 'Library import already running',
    'library.importCompleteTitle': 'Dropped import complete',
    'library.importFailedTitle': 'Dropped import failed',
    'library.importIssueTitle': 'Dropped import completed with issues',
    'library.dropUnavailableTitle': 'File drop unavailable',
    'library.loadFailedTitle': 'Library load failed',
    'library.scanCompleteTitle': 'Library scan complete',
    'library.scanFailedTitle': 'Library scan failed',
    'library.scanIssueTitle': 'Scan completed with issues',
    'library.scanResultFailed': '{base}, {failed} failed',
    'library.scanResultFirstIssue': '{base}, {failed} failed. First issue: {path} ({reason})',
    'library.scanResultSummary': '{added} added, {updated} updated, {removed} removed, {lyrics} lyrics imported',
    'library.watchFailedTitle': 'Library auto-refresh failed',
    'now.album': 'Album',
    'now.audioMetadata': 'Audio metadata',
    'now.bitrate': 'Bitrate',
    'now.bitDepthUnknown': 'Bit depth unknown',
    'now.duration': 'Duration',
    'now.file': 'File',
    'now.format': 'Format',
    'now.genre': 'Genre',
    'now.noTrackBody': 'Add a music folder, then double-click a track to start playback.',
    'now.noTrackTitle': 'No track selected',
    'now.playbackContext': 'Playback context',
    'now.plays': 'Plays',
    'now.ready': 'Ready',
    'now.source': 'Source',
    'now.status': 'Status',
    'now.upcoming': '{count} upcoming',
    'player.addFolderHint': 'Add a folder and play a local file',
    'player.error.audioOutput': 'Audio output failed',
    'player.error.nextTrack': 'Next track failed',
    'player.error.playback': 'Playback failed',
    'player.error.playbackControl': 'Playback control failed',
    'player.error.previousTrack': 'Previous track failed',
    'player.error.queuePlayback': 'Queue playback failed',
    'player.error.queueRecovery': 'Queue recovery failed',
    'player.error.queueUpdate': 'Queue update failed',
    'player.error.repeatUpdate': 'Repeat update failed',
    'player.error.sessionRestore': 'Playback restore failed',
    'player.error.seek': 'Seek failed',
    'player.error.shuffleUpdate': 'Shuffle update failed',
    'player.error.volumeUpdate': 'Volume update failed',
    'player.lyrics': 'Lyrics',
    'player.next': 'Next track',
    'player.pause': 'Pause',
    'player.play': 'Play',
    'player.previous': 'Previous track',
    'player.progress': 'Playback progress',
    'player.repeat': 'Repeat: {mode}',
    'player.shuffle': 'Shuffle',
    'player.status.loading': 'Loading',
    'player.status.paused': 'Paused',
    'player.status.playing': 'Playing',
    'player.status.stopped': 'Ready',
    'player.mute': 'Mute',
    'player.unmute': 'Unmute',
    'player.volume': 'Volume',
    'player.recovery.currentTrack': 'Current track',
    'player.recovery.skippingTitle': 'Skipping unavailable track',
    'player.recovery.skippingBody': '{title} could not be played. Trying the next queue item.',
    'queue.close': 'Close queue',
    'queue.clear': 'Clear queue',
    'queue.clearPlayed': 'Clear played',
    'queue.empty': 'Double-click a track, album, or artist to build a play queue.',
    'queue.loaded': '{count} tracks loaded',
    'queue.moveDown': 'Move down',
    'queue.moveUp': 'Move up',
    'queue.none': 'No active queue',
    'queue.panel': 'Play queue',
    'queue.remove': 'Remove from queue',
    'queue.title': 'Queue',
    'settings.aiHiddenBody': 'Planned for v0.2 and hidden from the v0.1 release surface.',
    'settings.aiHiddenTitle': 'AI lyrics and translation',
    'settings.audioDevice': 'Audio output device',
    'settings.audioProcessingBody': 'Playback output and local normalization.',
    'settings.audioProcessingTitle': 'Audio Processing',
    'settings.clearCoverCache': 'Clear cover cache',
    'settings.coverCacheCleared': 'Cleared {count} cached covers',
    'settings.coverCacheDir': 'Cover cache',
    'settings.dataCenterBody': 'Inspect and manage the files Melodist keeps on this device.',
    'settings.dataCenterTitle': 'Data & Privacy Center',
    'settings.directoryBody': 'Folders scanned into the local library database.',
    'settings.interfaceBody': 'Language and application presentation.',
    'settings.interfaceTitle': 'Interface',
    'settings.language': 'Language',
    'settings.languageChinese': '简体中文',
    'settings.languageEnglish': 'English',
    'settings.lyricsMetadataBody': 'Embedded lyrics and matching LRC sidecars stay local.',
    'settings.lyricsMetadataTitle': 'Lyrics & Metadata',
    'settings.lyricsSourcesBody': 'Embedded tags and same-name .lrc files are enabled for v0.1.',
    'settings.lyricsSourcesTitle': 'Lyrics sources',
    'settings.managedDirectories': 'Managed Directories',
    'settings.networkDefault': 'Network default',
    'settings.networkEnrichmentBody': 'Disabled for the first public release.',
    'settings.networkEnrichmentTitle': 'Network enrichment',
    'settings.libraryDatabase': 'Library database',
    'settings.outputDevice': 'Output device',
    'settings.offline': 'Offline',
    'settings.openDataDirectory': 'Open data folder',
    'settings.privacyBody': 'No telemetry, analytics, or network access in v0.1.',
    'settings.privacyTitle': 'Privacy & Network',
    'settings.removeDirectory': 'Remove {directory}',
    'settings.replayGainBody': 'Apply track gain tags during playback.',
    'settings.replayGainTitle': 'ReplayGain normalization',
    'settings.shortcutCycleRepeat': 'Cycle repeat mode',
    'settings.shortcutLyrics': 'Toggle lyrics',
    'settings.shortcutMute': 'Mute or restore volume',
    'settings.shortcutNextPrevious': 'Next / previous track',
    'settings.shortcutPlayPause': 'Play or pause',
    'settings.shortcutSeek': 'Seek 10 seconds',
    'settings.shortcutShuffle': 'Toggle shuffle',
    'settings.shortcutVolume': 'Adjust volume',
    'settings.shortcutsBody': 'Window shortcuts stay local to Melodist and are ignored while typing.',
    'settings.shortcutsTitle': 'Keyboard shortcuts',
    'settings.supportedFormatsBody': 'Melodist scans local music only and ignores unsupported files without uploading anything.',
    'settings.supportedFormatsTitle': 'Supported audio formats',
    'settings.telemetry': 'Telemetry',
    'settings.telemetryNever': 'Never collected',
    'settings.userData': 'User data',
    'settings.settingsFile': 'Settings file',
    'settings.userDataLocation': 'OS app data directory',
    'sidebar.private': 'Private by default',
    'sidebar.mainNavigation': 'Main navigation',
    'sidebar.tagline': 'Local Music Player',
    'track.actions.copiedPath': 'Copied path',
    'track.actions.addToQueue': 'Add to queue',
    'track.actions.copyPath': 'Copy path',
    'track.actions.getInfo': 'Get info',
    'track.actions.more': 'More actions for {title}',
    'track.actions.playNext': 'Play next',
    'track.actions.playFromHere': 'Play from here',
    'track.actions.queued': 'Queued',
    'track.actions.showInFileManager': 'Show in file manager',
    'track.activity.played': 'Played',
    'track.activity.plays': '{count} plays',
    'track.activity.unplayed': 'Not played yet',
    'track.info.added': 'Added',
    'track.info.album': 'Album',
    'track.info.artist': 'Artist',
    'track.info.audio': 'Audio',
    'track.info.bitDepth': 'Bit depth',
    'track.info.bitrate': 'Bitrate',
    'track.info.close': 'Close track info',
    'track.info.duration': 'Duration',
    'track.info.file': 'File',
    'track.info.fileSize': 'File size',
    'track.info.genre': 'Genre',
    'track.info.path': 'Path',
    'track.info.lastPlayed': 'Last played',
    'track.info.playCount': 'Play count',
    'track.info.sampleRate': 'Sample rate',
    'track.info.title': 'Track info',
    'track.info.trackNumber': 'Track',
    'track.emptyBody': 'Add a music folder, or drop audio files and music folders into the window.',
    'track.emptySearchBody': 'No local tracks match the current search or sort filter.',
    'track.emptySearchTitle': 'No matching tracks',
    'track.emptyTitle': 'No tracks found',
    'track.onboardingAddFolder': 'Add your first music folder',
    'track.onboardingFormats': 'MP3, FLAC, M4A, AAC, OGG, OPUS, WAV, AIFF, APE, and WV are supported.',
    'track.onboardingPlayback': 'Double-click any track to play; Melodist builds the queue from the current view.',
    'track.onboardingPrivate': 'Your library database, covers, lyrics, and settings stay in this device’s app data folder.',
    'track.header.added': 'Added',
    'track.header.album': 'Album',
    'track.header.artist': 'Artist',
    'track.header.title': 'Title',
    'track.list': 'Track list',
    'track.sort.ascending': 'sorted ascending',
    'track.sort.ascendingShort': 'Asc',
    'track.sort.descending': 'sorted descending',
    'track.sort.descendingShort': 'Desc',
    'track.sort.libraryOrder': 'Library order',
    'track.sort.mostPlayed': 'Most played',
    'track.sort.presets': 'Track sort presets',
    'track.sort.recentlyPlayed': 'Recently played',
  },
  'zh-CN': {
    'album.play': '播放 {name}',
    'album.emptySearchBody': '当前搜索下没有匹配的专辑。可以试试 title:、artist:、album:，或清空搜索。',
    'album.emptySearchTitle': '没有匹配的专辑',
    'album.trackCount': '{count} 首',
    'app.addFolder': '添加文件夹',
    'app.albums': '专辑',
    'app.artists': '艺术家',
    'app.clearSearch': '清空搜索',
    'app.dropImportBody': '可导入音频文件，或包含音乐的文件夹。',
    'app.dropImportTitle': '松手导入音乐',
    'app.library': '曲库',
    'app.nowPlaying': '正在播放',
    'app.refresh': '刷新',
    'app.search': '搜索曲库...',
    'app.searchHelp': '按关键词搜索，或使用 artist:、album:、title:、genre:、path: 等字段',
    'app.searchStats': '曲库共 {total} 首',
    'app.searchStatsFiltered': '显示 {count} / {total} 首',
    'app.searchSyntaxShort': '字段：artist: album: title: genre: path:',
    'app.settings': '设置',
    'app.scanning': '正在扫描 {scanned} / {total} 首...',
    'app.scanProgress': '曲库扫描进度',
    'app.libraryView': '曲库视图',
    'app.tracks': '歌曲',
    'artist.albumCount': '{count} 张专辑',
    'artist.emptySearchBody': '当前搜索下没有匹配的艺术家。可以试试 artist:，或清空搜索。',
    'artist.emptySearchTitle': '没有匹配的艺术家',
    'artist.play': '播放 {name}',
    'artist.trackCount': '{count} 首歌曲',
    'common.back': '返回',
    'common.default': '默认',
    'common.details': '详情',
    'common.dismissNotification': '关闭通知',
    'common.localFile': '本地文件',
    'common.systemDefault': '系统默认',
    'common.unknown': '未知',
    'common.unknownAlbum': '未知专辑',
    'common.unknownArtist': '未知艺术家',
    'common.unknownTitle': '未知标题',
    'lyrics.bilingual': '双语',
    'lyrics.close': '关闭歌词',
    'lyrics.displayMode': '歌词显示模式',
    'lyrics.empty': '未找到嵌入歌词或同名 .lrc 文件。',
    'lyrics.loading': '正在加载本地歌词...',
    'lyrics.loadFailed': '歌词加载失败',
    'lyrics.local': '本地歌词',
    'lyrics.noTrack': '播放一首本地歌曲以加载嵌入歌词或同名 .lrc 文件。',
    'lyrics.noteEstimated': '这份嵌入歌词没有时间戳，Melodist 正按播放进度估算当前行。添加同名 .lrc 文件后可获得精准同步。',
    'lyrics.noteUntimed': '这份嵌入歌词没有时间戳。添加同名 .lrc 文件即可同步滚动。',
    'lyrics.offset': '歌词偏移 {offset} 毫秒',
    'lyrics.offsetDecrease': '歌词提前',
    'lyrics.offsetIncrease': '歌词延后',
    'lyrics.offsetReset': '重置偏移',
    'lyrics.original': '原文',
    'lyrics.panel': '歌词面板',
    'lyrics.saveLrc': '保存 LRC',
    'lyrics.saveLrcComplete': 'LRC 已保存',
    'lyrics.saveLrcFailed': '歌词保存失败',
    'lyrics.saveLrcHint': '在这里粘贴带时间戳的 LRC 文本。保存后会在歌曲旁写入同名 .lrc 文件。',
    'lyrics.seekEstimatedLine': '跳转到估算歌词位置',
    'lyrics.source.embedded': '嵌入',
    'lyrics.source.estimated': '估算同步{source}歌词',
    'lyrics.source.generated': '生成',
    'lyrics.source.lrcFile': 'LRC 文件',
    'lyrics.source.manual': '手动',
    'lyrics.source.timed': '{source}歌词',
    'lyrics.source.untimed': '无时间戳{source}歌词',
    'lyrics.toggle': '切换歌词',
    'lyrics.translation': '译文',
    'library.importBusyBody': '请等待当前扫描完成后，再拖入更多文件。',
    'library.importBusyTitle': '曲库正在导入',
    'library.importCompleteTitle': '拖拽导入完成',
    'library.importFailedTitle': '拖拽导入失败',
    'library.importIssueTitle': '拖拽导入完成，但有部分问题',
    'library.dropUnavailableTitle': '文件拖拽不可用',
    'library.loadFailedTitle': '曲库加载失败',
    'library.scanCompleteTitle': '曲库扫描完成',
    'library.scanFailedTitle': '曲库扫描失败',
    'library.scanIssueTitle': '扫描完成，但有部分问题',
    'library.scanResultFailed': '{base}，{failed} 个失败',
    'library.scanResultFirstIssue': '{base}，{failed} 个失败。首个问题：{path}（{reason}）',
    'library.scanResultSummary': '新增 {added}，更新 {updated}，移除 {removed}，导入歌词 {lyrics}',
    'library.watchFailedTitle': '曲库自动刷新失败',
    'now.album': '专辑',
    'now.audioMetadata': '音频元数据',
    'now.bitrate': '码率',
    'now.bitDepthUnknown': '位深未知',
    'now.duration': '时长',
    'now.file': '文件',
    'now.format': '格式',
    'now.genre': '流派',
    'now.noTrackBody': '添加音乐文件夹，然后双击歌曲开始播放。',
    'now.noTrackTitle': '未选择歌曲',
    'now.playbackContext': '播放上下文',
    'now.plays': '播放次数',
    'now.ready': '就绪',
    'now.source': '来源',
    'now.status': '状态',
    'now.upcoming': '接下来 {count} 首',
    'player.addFolderHint': '添加文件夹并播放本地文件',
    'player.error.audioOutput': '音频输出失败',
    'player.error.nextTrack': '下一首失败',
    'player.error.playback': '播放失败',
    'player.error.playbackControl': '播放控制失败',
    'player.error.previousTrack': '上一首失败',
    'player.error.queuePlayback': '队列播放失败',
    'player.error.queueRecovery': '队列恢复失败',
    'player.error.queueUpdate': '队列更新失败',
    'player.error.repeatUpdate': '循环模式更新失败',
    'player.error.sessionRestore': '播放会话恢复失败',
    'player.error.seek': '跳转失败',
    'player.error.shuffleUpdate': '随机播放更新失败',
    'player.error.volumeUpdate': '音量更新失败',
    'player.lyrics': '歌词',
    'player.next': '下一首',
    'player.pause': '暂停',
    'player.play': '播放',
    'player.previous': '上一首',
    'player.progress': '播放进度',
    'player.repeat': '循环：{mode}',
    'player.shuffle': '随机播放',
    'player.status.loading': '加载中',
    'player.status.paused': '已暂停',
    'player.status.playing': '播放中',
    'player.status.stopped': '就绪',
    'player.mute': '静音',
    'player.unmute': '取消静音',
    'player.volume': '音量',
    'player.recovery.currentTrack': '当前歌曲',
    'player.recovery.skippingTitle': '正在跳过不可播放的歌曲',
    'player.recovery.skippingBody': '{title} 无法播放，正在尝试队列中的下一首。',
    'queue.close': '关闭队列',
    'queue.clear': '清空队列',
    'queue.clearPlayed': '清除已播放',
    'queue.empty': '双击歌曲、专辑或艺术家即可建立播放队列。',
    'queue.loaded': '已加载 {count} 首',
    'queue.moveDown': '下移',
    'queue.moveUp': '上移',
    'queue.none': '暂无播放队列',
    'queue.panel': '播放队列',
    'queue.remove': '从队列移除',
    'queue.title': '队列',
    'settings.aiHiddenBody': '计划在 v0.2 提供，并从 v0.1 发布界面隐藏。',
    'settings.aiHiddenTitle': 'AI 歌词与翻译',
    'settings.audioDevice': '音频输出设备',
    'settings.audioProcessingBody': '播放输出与本地音量标准化。',
    'settings.audioProcessingTitle': '音频处理',
    'settings.clearCoverCache': '清空封面缓存',
    'settings.coverCacheCleared': '已清理 {count} 个封面缓存',
    'settings.coverCacheDir': '封面缓存',
    'settings.dataCenterBody': '查看并管理 Melodist 保存在这台设备上的文件。',
    'settings.dataCenterTitle': '数据与隐私中心',
    'settings.directoryBody': '已扫描进本地曲库数据库的文件夹。',
    'settings.interfaceBody': '语言与应用显示偏好。',
    'settings.interfaceTitle': '界面',
    'settings.language': '语言',
    'settings.languageChinese': '简体中文',
    'settings.languageEnglish': 'English',
    'settings.lyricsMetadataBody': '嵌入歌词和同名 LRC 文件都保留在本地。',
    'settings.lyricsMetadataTitle': '歌词与元数据',
    'settings.lyricsSourcesBody': 'v0.1 已启用嵌入标签和同名 .lrc 文件。',
    'settings.lyricsSourcesTitle': '歌词来源',
    'settings.managedDirectories': '管理目录',
    'settings.networkDefault': '网络默认',
    'settings.networkEnrichmentBody': '首个公开版本中保持禁用。',
    'settings.networkEnrichmentTitle': '网络增强',
    'settings.libraryDatabase': '曲库数据库',
    'settings.outputDevice': '输出设备',
    'settings.offline': '离线',
    'settings.openDataDirectory': '打开数据文件夹',
    'settings.privacyBody': 'v0.1 不包含遥测、分析或网络访问。',
    'settings.privacyTitle': '隐私与网络',
    'settings.removeDirectory': '移除 {directory}',
    'settings.replayGainBody': '播放时应用曲目增益标签。',
    'settings.replayGainTitle': 'ReplayGain 标准化',
    'settings.shortcutCycleRepeat': '切换循环模式',
    'settings.shortcutLyrics': '打开/关闭歌词',
    'settings.shortcutMute': '静音或恢复音量',
    'settings.shortcutNextPrevious': '下一首 / 上一首',
    'settings.shortcutPlayPause': '播放或暂停',
    'settings.shortcutSeek': '快退/快进 10 秒',
    'settings.shortcutShuffle': '切换随机播放',
    'settings.shortcutVolume': '调节音量',
    'settings.shortcutsBody': '窗口快捷键只在 Melodist 内生效，输入文字时会自动忽略。',
    'settings.shortcutsTitle': '键盘快捷键',
    'settings.supportedFormatsBody': 'Melodist 只扫描本地音乐文件；不支持的文件会被忽略，不会上传任何内容。',
    'settings.supportedFormatsTitle': '支持的音频格式',
    'settings.telemetry': '遥测',
    'settings.telemetryNever': '永不收集',
    'settings.userData': '用户数据',
    'settings.settingsFile': '设置文件',
    'settings.userDataLocation': '系统应用数据目录',
    'sidebar.private': '默认私密',
    'sidebar.mainNavigation': '主导航',
    'sidebar.tagline': '本地音乐播放器',
    'track.actions.copiedPath': '已复制路径',
    'track.actions.addToQueue': '加入队列',
    'track.actions.copyPath': '复制路径',
    'track.actions.getInfo': '查看信息',
    'track.actions.more': '{title} 的更多操作',
    'track.actions.playNext': '下一首播放',
    'track.actions.playFromHere': '从这里播放',
    'track.actions.queued': '已加入队列',
    'track.actions.showInFileManager': '在文件管理器中显示',
    'track.activity.played': '已播放',
    'track.activity.plays': '播放 {count} 次',
    'track.activity.unplayed': '尚未播放',
    'track.info.added': '添加时间',
    'track.info.album': '专辑',
    'track.info.artist': '艺术家',
    'track.info.audio': '音频',
    'track.info.bitDepth': '位深',
    'track.info.bitrate': '码率',
    'track.info.close': '关闭歌曲信息',
    'track.info.duration': '时长',
    'track.info.file': '文件',
    'track.info.fileSize': '文件大小',
    'track.info.genre': '流派',
    'track.info.path': '路径',
    'track.info.lastPlayed': '上次播放',
    'track.info.playCount': '播放次数',
    'track.info.sampleRate': '采样率',
    'track.info.title': '歌曲信息',
    'track.info.trackNumber': '曲目',
    'track.emptyBody': '添加音乐文件夹，或直接把音频文件和音乐文件夹拖进窗口。',
    'track.emptySearchBody': '当前搜索或筛选条件下没有匹配的本地歌曲。',
    'track.emptySearchTitle': '没有匹配的歌曲',
    'track.emptyTitle': '没有找到歌曲',
    'track.onboardingAddFolder': '添加第一个音乐文件夹',
    'track.onboardingFormats': '支持 MP3、FLAC、M4A、AAC、OGG、OPUS、WAV、AIFF、APE 和 WV。',
    'track.onboardingPlayback': '双击任意歌曲即可播放；Melodist 会按当前视图建立播放队列。',
    'track.onboardingPrivate': '曲库数据库、封面、歌词和设置都会保存在这台设备的应用数据目录。',
    'track.header.added': '添加时间',
    'track.header.album': '专辑',
    'track.header.artist': '艺术家',
    'track.header.title': '标题',
    'track.list': '歌曲列表',
    'track.sort.ascending': '升序排列',
    'track.sort.ascendingShort': '升序',
    'track.sort.descending': '降序排列',
    'track.sort.descendingShort': '降序',
    'track.sort.libraryOrder': '曲库顺序',
    'track.sort.mostPlayed': '最常播放',
    'track.sort.presets': '歌曲排序预设',
    'track.sort.recentlyPlayed': '最近播放',
  },
}

export function interpolate(template: string, params: TranslationParams = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

export function translate(language: AppLanguage, key: TranslationKey, params?: TranslationParams) {
  const dictionary = translations[language] ?? translations.en
  return interpolate(dictionary[key] ?? translations.en[key], params)
}

export function useI18n() {
  const language = useSettingsStore((state) => state.appLanguage)
  return {
    language,
    t: (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
  }
}
