import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Save, X } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { formatDurationMs } from '../../lib/time'
import { useLyricsStore } from '../../stores/lyricsStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { LrcLine } from '../../types'
import { currentLineIndex, estimatedUntimedLineIndex, estimatedUntimedTimestamp, hasTimedLyrics } from './lyricsTiming'

const lyricsModes = [
  { labelKey: 'lyrics.original', value: 'original' },
  { labelKey: 'lyrics.bilingual', value: 'bilingual' },
  { labelKey: 'lyrics.translation', value: 'translated' },
] as const

const lyricsSourceKeys = {
  embedded: 'lyrics.source.embedded',
  generated: 'lyrics.source.generated',
  lrc_file: 'lyrics.source.lrcFile',
  manual: 'lyrics.source.manual',
} as const

function lineText(line: LrcLine, mode: 'original' | 'translated' | 'bilingual') {
  if (mode === 'translated') return line.translatedText ?? line.text
  return line.text
}

function formatLrcTimestamp(timestampMs: number) {
  const totalCentiseconds = Math.round(timestampMs / 10)
  const minutes = Math.floor(totalCentiseconds / 6000)
  const seconds = Math.floor((totalCentiseconds % 6000) / 100)
  const centiseconds = totalCentiseconds % 100
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`
}

function lrcTextFromLines(lines: LrcLine[]) {
  return lines
    .filter((line) => line.timestampMs > 0 || line.text.trim())
    .map((line) => `${formatLrcTimestamp(line.timestampMs)}${line.text}`)
    .join('\n')
}

export function LyricsPanel() {
  const { t } = useI18n()
  const lineRefs = useRef<Array<HTMLElement | null>>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorText, setEditorText] = useState('')
  const lyricsOpen = usePlayerStore((state) => state.lyricsOpen)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const positionMs = usePlayerStore((state) => state.positionMs)
  const toggleLyrics = usePlayerStore((state) => state.toggleLyrics)
  const seek = usePlayerStore((state) => state.seek)
  const lyricsData = useLyricsStore((state) => state.data)
  const lyricsError = useLyricsStore((state) => state.error)
  const isLoading = useLyricsStore((state) => state.isLoading)
  const lyricsDisplayMode = useSettingsStore((state) => state.lyricsDisplayMode)
  const lyricsOffsetMs = useSettingsStore((state) => state.lyricsOffsetMs)
  const setLyricsDisplayMode = useSettingsStore((state) => state.setLyricsDisplayMode)
  const setLyricsOffsetMs = useSettingsStore((state) => state.setLyricsOffsetMs)
  const saveLrcForTrack = useLyricsStore((state) => state.saveLrcForTrack)

  const lines = useMemo(() => lyricsData?.lines ?? [], [lyricsData])
  const timedLyrics = hasTimedLyrics(lines)
  const durationMs = currentTrack?.durationMs ?? 0
  const estimatedLyrics = !timedLyrics && lines.length > 0 && durationMs > 0
  const adjustedPositionMs = Math.max(0, positionMs + lyricsOffsetMs)
  const activeIndex = timedLyrics
    ? currentLineIndex(lines, adjustedPositionMs)
    : estimatedUntimedLineIndex(lines.length, adjustedPositionMs, durationMs)
  const canSwitchTranslation = Boolean(lyricsData?.hasTranslation)
  const displayMode = canSwitchTranslation ? lyricsDisplayMode : 'original'
  const sourceLabel = useMemo(() => {
    if (!lyricsData) return t('lyrics.local')
    const source = t(lyricsSourceKeys[lyricsData.source])
    if (estimatedLyrics) return t('lyrics.source.estimated', { source })
    return timedLyrics ? t('lyrics.source.timed', { source }) : t('lyrics.source.untimed', { source })
  }, [estimatedLyrics, lyricsData, t, timedLyrics])

  useEffect(() => {
    if (!lyricsOpen || activeIndex < 0) return
    const line = lineRefs.current[activeIndex]
    line?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIndex, currentTrack?.id, lines.length, lyricsOpen])

  if (!lyricsOpen) return null

  return (
    <aside className="lyrics-panel" aria-label={t('lyrics.panel')}>
      <header>
        <div>
          <h2>{currentTrack?.title ?? t('now.noTrackTitle')}</h2>
          <p>{sourceLabel}</p>
        </div>
        <button aria-label={t('lyrics.close')} type="button" onClick={toggleLyrics}>
          <X size={18} />
        </button>
      </header>
      {canSwitchTranslation ? (
        <div className="lyrics-mode" role="group" aria-label={t('lyrics.displayMode')}>
          {lyricsModes.map((mode) => (
            <button
              className={displayMode === mode.value ? 'active' : ''}
              key={mode.value}
              type="button"
              onClick={() => void setLyricsDisplayMode(mode.value)}
            >
              {t(mode.labelKey)}
            </button>
          ))}
        </div>
      ) : null}
      {currentTrack ? (
        <div className="lyrics-tools">
          <div className="lyrics-offset-control" role="group" aria-label={t('lyrics.offset', { offset: lyricsOffsetMs })}>
            <button aria-label={t('lyrics.offsetDecrease')} type="button" onClick={() => void setLyricsOffsetMs(lyricsOffsetMs - 250)}>
              <Minus size={14} />
            </button>
            <button type="button" onClick={() => void setLyricsOffsetMs(0)}>
              {lyricsOffsetMs === 0 ? t('lyrics.offsetReset') : t('lyrics.offset', { offset: lyricsOffsetMs })}
            </button>
            <button aria-label={t('lyrics.offsetIncrease')} type="button" onClick={() => void setLyricsOffsetMs(lyricsOffsetMs + 250)}>
              <Plus size={14} />
            </button>
          </div>
          <button
            className="lyrics-save-button"
            type="button"
            onClick={() => {
              setEditorText(lrcTextFromLines(lines))
              setEditorOpen((open) => !open)
            }}
          >
            <Save size={14} />
            {t('lyrics.saveLrc')}
          </button>
        </div>
      ) : null}
      {editorOpen && currentTrack ? (
        <form
          className="lyrics-editor"
          onSubmit={(event) => {
            event.preventDefault()
            void saveLrcForTrack(currentTrack, editorText)
          }}
        >
          <p>{t('lyrics.saveLrcHint')}</p>
          <textarea value={editorText} onChange={(event) => setEditorText(event.currentTarget.value)} />
          <button type="submit">
            <Save size={14} />
            {t('lyrics.saveLrc')}
          </button>
        </form>
      ) : null}
      {currentTrack ? (
        <div
          className={`lyric-lines ${canSwitchTranslation ? '' : 'without-mode'} ${timedLyrics ? 'timed' : 'untimed'} ${estimatedLyrics ? 'estimated' : ''}`}
        >
          {isLoading ? <p className="lyrics-empty">{t('lyrics.loading')}</p> : null}
          {!isLoading && lyricsError ? <p className="lyrics-empty">{lyricsError}</p> : null}
          {!isLoading && !lyricsError && lines.length === 0 ? (
            <p className="lyrics-empty">{t('lyrics.empty')}</p>
          ) : null}
          {!isLoading && !lyricsError && lines.length > 0 && !timedLyrics ? (
            <p className="lyrics-note">{t(estimatedLyrics ? 'lyrics.noteEstimated' : 'lyrics.noteUntimed')}</p>
          ) : null}
          {lines.map((line, index) => {
            const isCurrent = index === activeIndex
            const isPast = activeIndex >= 0 && index < activeIndex
            const className = `lyric-line ${isCurrent ? 'current' : isPast ? 'past' : 'future'}`
            const content = (
              <>
                {timedLyrics ? <span>{formatDurationMs(line.timestampMs)}</span> : null}
                <div>
                  <p>{lineText(line, displayMode)}</p>
                  {displayMode === 'bilingual' && line.translatedText ? <small>{line.translatedText}</small> : null}
                </div>
              </>
            )

            return timedLyrics ? (
              <button
                className={className}
                key={`${line.timestampMs}-${index}`}
                ref={(element) => {
                  lineRefs.current[index] = element
                }}
                type="button"
                onClick={() => void seek(Math.max(0, line.timestampMs - lyricsOffsetMs))}
              >
                {content}
              </button>
            ) : (
              <button
                aria-label={t('lyrics.seekEstimatedLine')}
                className={`${className} plain`}
                disabled={!estimatedLyrics}
                key={`${line.timestampMs}-${index}`}
                ref={(element) => {
                  lineRefs.current[index] = element
                }}
                type="button"
                onClick={() => {
                  const timestamp = estimatedUntimedTimestamp(index, lines.length, durationMs)
                  if (timestamp !== null) void seek(Math.max(0, timestamp - lyricsOffsetMs))
                }}
              >
                {content}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="lyrics-empty">{t('lyrics.noTrack')}</p>
      )}
    </aside>
  )
}
