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
