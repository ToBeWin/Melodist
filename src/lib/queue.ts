export function currentIndexAfterQueueMove(currentIndex: number | null, sourceIndex: number, targetIndex: number) {
  if (currentIndex === null || sourceIndex === targetIndex) return currentIndex
  if (sourceIndex === currentIndex) return targetIndex
  if (sourceIndex < currentIndex && targetIndex >= currentIndex) return currentIndex - 1
  if (sourceIndex > currentIndex && targetIndex <= currentIndex) return currentIndex + 1
  return currentIndex
}

export function shouldAutoSkipOutputError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('failed to open audio output file') || normalized.includes('failed to decode audio output file')
}

export function queueRecoveryAfterPlaybackFailure<T>(queue: T[], currentIndex: number | null) {
  if (currentIndex === null || currentIndex < 0 || currentIndex >= queue.length) return null

  const recoveredQueue = queue.filter((_, index) => index !== currentIndex)
  if (recoveredQueue.length === 0) return null

  return {
    currentIndex: Math.min(currentIndex, recoveredQueue.length - 1),
    queue: recoveredQueue,
  }
}

export function queueAfterClearingPlayed<T>(queue: T[], currentIndex: number | null) {
  if (currentIndex === null || currentIndex <= 0) {
    return { currentIndex, queue }
  }

  return {
    currentIndex: 0,
    queue: queue.slice(currentIndex),
  }
}

export function queueAfterRemovingIndex<T>(
  queue: T[],
  currentIndex: number | null,
  removeIndex: number,
  currentTrack: T | null,
) {
  if (removeIndex < 0 || removeIndex >= queue.length) {
    return { currentIndex, queue }
  }

  const nextQueue = queue.filter((_, index) => index !== removeIndex)
  if (nextQueue.length === 0) {
    return currentTrack
      ? { currentIndex: 0, queue: [currentTrack] }
      : { currentIndex: null, queue: [] }
  }

  if (currentIndex === null) {
    return { currentIndex: null, queue: nextQueue }
  }

  if (removeIndex === currentIndex) {
    return { currentIndex: Math.min(removeIndex, nextQueue.length - 1), queue: nextQueue }
  }

  return {
    currentIndex: removeIndex < currentIndex ? currentIndex - 1 : currentIndex,
    queue: nextQueue,
  }
}

export function queueAfterAppendingTrack<T>(
  queue: T[],
  currentIndex: number | null,
  currentTrack: T | null,
  track: T,
) {
  if (queue.length > 0) {
    return { currentIndex, queue: [...queue, track] }
  }

  if (currentTrack) {
    return { currentIndex: 0, queue: [currentTrack, track] }
  }

  return { currentIndex: null, queue: [track] }
}

export function shouldPersistPlayerStateTransition(
  previousTrackPath: string | null,
  nextTrackPath: string | null,
  previousIndex: number | null,
  nextIndex: number | null,
) {
  return previousTrackPath !== nextTrackPath || previousIndex !== nextIndex
}

export function shouldScrollQueueToCurrent(
  queueOpen: boolean,
  wasQueueOpen: boolean,
  previousIndex: number | null,
  currentIndex: number | null,
) {
  return queueOpen && currentIndex !== null && (!wasQueueOpen || previousIndex !== currentIndex)
}
