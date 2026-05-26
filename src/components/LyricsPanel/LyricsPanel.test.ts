import { describe, expect, test } from 'vitest'

import { currentLineIndex, estimatedUntimedLineIndex, hasTimedLyrics } from './lyricsTiming'
import type { LrcLine } from '../../types'

function line(timestampMs: number, text: string): LrcLine {
  return {
    timestampMs,
    text,
    translatedText: null,
    wordTimestamps: null,
  }
}

describe('lyrics timing helpers', () => {
  test('detects real line timing instead of plain embedded lyrics', () => {
    expect(hasTimedLyrics([line(0, 'plain one'), line(0, 'plain two')])).toBe(false)
    expect(hasTimedLyrics([line(0, 'intro'), line(12_000, 'verse')])).toBe(true)
  })

  test('resolves active timed lyric line from playback position', () => {
    const lines = [line(0, 'intro'), line(10_000, 'verse'), line(20_000, 'chorus')]

    expect(currentLineIndex(lines, 9_999)).toBe(0)
    expect(currentLineIndex(lines, 10_000)).toBe(1)
    expect(currentLineIndex(lines, 25_000)).toBe(2)
  })

  test('estimates active untimed lyric line from playback progress', () => {
    expect(estimatedUntimedLineIndex(4, 0, 100_000)).toBe(0)
    expect(estimatedUntimedLineIndex(4, 49_000, 100_000)).toBe(1)
    expect(estimatedUntimedLineIndex(4, 50_000, 100_000)).toBe(2)
    expect(estimatedUntimedLineIndex(4, 100_000, 100_000)).toBe(3)
    expect(estimatedUntimedLineIndex(4, 10_000, 0)).toBe(-1)
  })
})
