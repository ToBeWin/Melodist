import type { LrcLine } from '../../types'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function currentLineIndex(lines: LrcLine[], positionMs: number) {
  return lines.reduce((currentIndex, line, index) => (line.timestampMs <= positionMs ? index : currentIndex), -1)
}

export function estimatedUntimedLineIndex(lineCount: number, positionMs: number, durationMs: number) {
  if (lineCount <= 0 || durationMs <= 0) return -1
  if (positionMs <= 0) return 0
  if (positionMs >= durationMs) return lineCount - 1
  return clamp(Math.floor((positionMs / durationMs) * lineCount), 0, lineCount - 1)
}

export function estimatedUntimedTimestamp(index: number, lineCount: number, durationMs: number) {
  if (lineCount <= 0 || durationMs <= 0) return null
  if (lineCount === 1) return 0
  return Math.round((clamp(index, 0, lineCount - 1) / (lineCount - 1)) * durationMs)
}

export function hasTimedLyrics(lines: LrcLine[]) {
  return lines.some((line, index) => line.timestampMs > 0 || (index > 0 && line.timestampMs !== lines[index - 1].timestampMs))
}
