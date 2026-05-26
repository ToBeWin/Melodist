import { describe, expect, test } from 'vitest'

import {
  currentIndexAfterQueueMove,
  queueAfterAppendingTrack,
  queueAfterClearingPlayed,
  queueAfterRemovingIndex,
  queueRecoveryAfterPlaybackFailure,
  shouldPersistPlayerStateTransition,
  shouldScrollQueueToCurrent,
  shouldAutoSkipOutputError,
} from './queue'

describe('currentIndexAfterQueueMove', () => {
  test('keeps the current track selected when another item moves across it', () => {
    expect(currentIndexAfterQueueMove(2, 0, 3)).toBe(1)
    expect(currentIndexAfterQueueMove(2, 3, 0)).toBe(3)
  })

  test('moves the current index when the current track itself is dragged', () => {
    expect(currentIndexAfterQueueMove(2, 2, 0)).toBe(0)
    expect(currentIndexAfterQueueMove(2, 2, 3)).toBe(3)
  })

  test('leaves the current index unchanged when moves do not cross it', () => {
    expect(currentIndexAfterQueueMove(2, 0, 1)).toBe(2)
    expect(currentIndexAfterQueueMove(2, 3, 4)).toBe(2)
    expect(currentIndexAfterQueueMove(null, 0, 1)).toBeNull()
  })
})

describe('shouldAutoSkipOutputError', () => {
  test('only treats source file failures as auto-skippable', () => {
    expect(shouldAutoSkipOutputError('Failed to open audio output file: missing')).toBe(true)
    expect(shouldAutoSkipOutputError('Failed to decode audio output file: invalid data')).toBe(true)
    expect(shouldAutoSkipOutputError('No audio output device is available')).toBe(false)
    expect(shouldAutoSkipOutputError('Failed to create audio sink')).toBe(false)
  })
})

describe('queueRecoveryAfterPlaybackFailure', () => {
  test('removes the failed track and keeps the next item selected', () => {
    expect(queueRecoveryAfterPlaybackFailure(['a', 'bad', 'c'], 1)).toEqual({
      currentIndex: 1,
      queue: ['a', 'c'],
    })
  })

  test('falls back to the previous index when the failed track was last', () => {
    expect(queueRecoveryAfterPlaybackFailure(['a', 'bad'], 1)).toEqual({
      currentIndex: 0,
      queue: ['a'],
    })
  })

  test('cannot recover when there is no remaining queue item', () => {
    expect(queueRecoveryAfterPlaybackFailure(['bad'], 0)).toBeNull()
    expect(queueRecoveryAfterPlaybackFailure(['a'], null)).toBeNull()
  })
})

describe('queueAfterClearingPlayed', () => {
  test('drops items before the current track and resets current index to zero', () => {
    expect(queueAfterClearingPlayed(['a', 'b', 'c', 'd'], 2)).toEqual({
      currentIndex: 0,
      queue: ['c', 'd'],
    })
  })

  test('does nothing when no played items exist', () => {
    expect(queueAfterClearingPlayed(['a', 'b'], 0)).toEqual({
      currentIndex: 0,
      queue: ['a', 'b'],
    })
    expect(queueAfterClearingPlayed(['a', 'b'], null)).toEqual({
      currentIndex: null,
      queue: ['a', 'b'],
    })
  })
})

describe('queueAfterRemovingIndex', () => {
  test('keeps the currently playing track as queue anchor when removing the only row', () => {
    expect(queueAfterRemovingIndex(['a'], 0, 0, 'a')).toEqual({
      currentIndex: 0,
      queue: ['a'],
    })
  })

  test('selects the next available row when removing the current queue item', () => {
    expect(queueAfterRemovingIndex(['a', 'b', 'c'], 1, 1, 'b')).toEqual({
      currentIndex: 1,
      queue: ['a', 'c'],
    })
  })

  test('adjusts current index when removing a row before the current item', () => {
    expect(queueAfterRemovingIndex(['a', 'b', 'c'], 2, 0, 'c')).toEqual({
      currentIndex: 1,
      queue: ['b', 'c'],
    })
  })
})

describe('queueAfterAppendingTrack', () => {
  test('appends to an existing queue without changing current index', () => {
    expect(queueAfterAppendingTrack(['a'], 0, 'a', 'b')).toEqual({
      currentIndex: 0,
      queue: ['a', 'b'],
    })
  })

  test('rebuilds a queue anchor from the current track when queue state is empty', () => {
    expect(queueAfterAppendingTrack([], null, 'a', 'b')).toEqual({
      currentIndex: 0,
      queue: ['a', 'b'],
    })
  })
})

describe('shouldPersistPlayerStateTransition', () => {
  test('persists when backend state moves to another queue item', () => {
    expect(shouldPersistPlayerStateTransition('/a.flac', '/b.flac', 0, 1)).toBe(true)
    expect(shouldPersistPlayerStateTransition('/a.flac', '/a.flac', 0, 1)).toBe(true)
  })

  test('ignores repeated state events for the same queue item', () => {
    expect(shouldPersistPlayerStateTransition('/a.flac', '/a.flac', 0, 0)).toBe(false)
    expect(shouldPersistPlayerStateTransition(null, null, null, null)).toBe(false)
  })
})

describe('shouldScrollQueueToCurrent', () => {
  test('scrolls when the queue panel opens with a current item', () => {
    expect(shouldScrollQueueToCurrent(true, false, null, 4)).toBe(true)
  })

  test('scrolls when the current queue index changes while open', () => {
    expect(shouldScrollQueueToCurrent(true, true, 4, 5)).toBe(true)
  })

  test('does not scroll for repeated events or closed panel state', () => {
    expect(shouldScrollQueueToCurrent(true, true, 4, 4)).toBe(false)
    expect(shouldScrollQueueToCurrent(false, true, 4, 5)).toBe(false)
    expect(shouldScrollQueueToCurrent(true, true, 4, null)).toBe(false)
  })
})
