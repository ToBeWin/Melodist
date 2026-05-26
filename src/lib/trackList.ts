export function trackIndexById<T extends { id: string }>(tracks: T[], currentTrackId: string | null) {
  if (!currentTrackId) return -1
  return tracks.findIndex((track) => track.id === currentTrackId)
}
