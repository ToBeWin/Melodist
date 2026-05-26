import { describe, expect, test } from 'vitest'

import { scanFailureDetails, scanResultMessage } from './scanResult'
import type { ScanResult } from '../types'

const result = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  added: 2,
  updated: 1,
  removed: 0,
  failed: 0,
  importedLyrics: 1,
  failures: [],
  importedDirectories: [],
  ...overrides,
})

describe('scan result formatting', () => {
  test('includes imported lyric count in localized summary', () => {
    expect(scanResultMessage('en', result())).toBe('2 added, 1 updated, 0 removed, 1 lyrics imported')
    expect(scanResultMessage('zh-CN', result())).toBe('新增 2，更新 1，移除 0，导入歌词 1')
  })

  test('formats failure details for expanded toasts', () => {
    expect(
      scanFailureDetails(
        result({
          failed: 2,
          failures: [
            { path: '/music/a.lrc', reason: 'No same-name audio file was found for this LRC' },
            { path: '/music/b.mp3', reason: 'Unsupported audio format' },
          ],
        }),
      ),
    ).toEqual([
      '/music/a.lrc - No same-name audio file was found for this LRC',
      '/music/b.mp3 - Unsupported audio format',
    ])
  })
})
