import { describe, expect, test } from 'vitest'

import { filterTracksByLibrarySearch, parseLibrarySearchQuery } from './librarySearch'
import type { Track } from '../types'

function track(overrides: Partial<Track>): Track {
  return {
    id: overrides.id ?? overrides.path ?? 'track',
    path: overrides.path ?? '/music/unknown.flac',
    title: overrides.title ?? null,
    artist: overrides.artist ?? null,
    album: overrides.album ?? null,
    albumArtist: overrides.albumArtist ?? null,
    trackNumber: null,
    discNumber: null,
    year: null,
    genre: overrides.genre ?? null,
    durationMs: 0,
    sampleRate: 0,
    bitDepth: null,
    bitrate: null,
    fileSize: 0,
    hasCover: false,
    coverCachePath: null,
    dateAdded: 0,
    dateModified: 0,
    playCount: 0,
    lastPlayed: null,
  }
}

const library = [
  track({
    id: 'one',
    path: '/music/Miles Davis/Kind of Blue/So What.flac',
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    albumArtist: 'Miles Davis',
    genre: 'Jazz',
  }),
  track({
    id: 'two',
    path: '/music/tobewin/music/神都洛阳赋.mp3',
    title: '神都洛阳赋',
    artist: 'tobewin',
    album: 'music',
    genre: 'Electronic',
  }),
]

describe('parseLibrarySearchQuery', () => {
  test('parses field-qualified and quoted terms', () => {
    expect(parseLibrarySearchQuery('artist:"Miles Davis" album:blue so')).toEqual({
      terms: ['so'],
      fieldTerms: [
        { field: 'artist', value: 'miles davis' },
        { field: 'album', value: 'blue' },
      ],
    })
  })

  test('treats unknown field prefixes as plain terms', () => {
    expect(parseLibrarySearchQuery('mood:late')).toEqual({
      terms: ['mood:late'],
      fieldTerms: [],
    })
  })
})

describe('filterTracksByLibrarySearch', () => {
  test('keeps plain search across all common metadata fields', () => {
    expect(filterTracksByLibrarySearch(library, 'jazz').map((item) => item.id)).toEqual(['one'])
    expect(filterTracksByLibrarySearch(library, '洛阳').map((item) => item.id)).toEqual(['two'])
  })

  test('supports field-qualified library search', () => {
    expect(filterTracksByLibrarySearch(library, 'artist:tobewin album:music').map((item) => item.id)).toEqual(['two'])
    expect(filterTracksByLibrarySearch(library, 'artist:tobewin album:blue').map((item) => item.id)).toEqual([])
  })

  test('supports quoted field values with spaces', () => {
    expect(filterTracksByLibrarySearch(library, 'artist:"Miles Davis" title:"So What"').map((item) => item.id)).toEqual(['one'])
  })
})
