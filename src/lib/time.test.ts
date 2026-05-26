import { describe, expect, test } from 'vitest'

import { formatDurationMs } from './time'

describe('formatDurationMs', () => {
  test('formats milliseconds as compact minutes and seconds', () => {
    expect(formatDurationMs(222000)).toBe('3:42')
    expect(formatDurationMs(306000)).toBe('5:06')
  })

  test('formats hour-long durations without dropping the hour', () => {
    expect(formatDurationMs(3661000)).toBe('1:01:01')
  })
})

