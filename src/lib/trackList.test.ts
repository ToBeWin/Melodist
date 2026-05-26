import { describe, expect, test } from 'vitest'

import { trackIndexById } from './trackList'

describe('trackIndexById', () => {
  test('finds the track index by id', () => {
    expect(trackIndexById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b')).toBe(1)
  })

  test('returns -1 when no current track is available or visible', () => {
    expect(trackIndexById([{ id: 'a' }], null)).toBe(-1)
    expect(trackIndexById([{ id: 'a' }], 'missing')).toBe(-1)
  })
})
