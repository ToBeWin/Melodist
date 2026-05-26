import type { Track } from '../types'

type LibrarySearchField = 'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'path'

interface FieldSearchTerm {
  field: LibrarySearchField
  value: string
}

export interface ParsedLibrarySearchQuery {
  fieldTerms: FieldSearchTerm[]
  terms: string[]
}

const fieldAliases: Record<string, LibrarySearchField> = {
  album: 'album',
  albumartist: 'albumArtist',
  albumArtist: 'albumArtist',
  aa: 'albumArtist',
  ar: 'artist',
  artist: 'artist',
  file: 'path',
  folder: 'path',
  genre: 'genre',
  name: 'title',
  path: 'path',
  t: 'title',
  title: 'title',
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function normalizeFieldName(value: string) {
  return value.replace(/[-_\s]/g, '')
}

function tokenizeSearchQuery(query: string) {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false

  for (const character of query.trim()) {
    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (/\s/.test(character) && !inQuotes) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
      continue
    }
    current += character
  }

  if (current.trim()) tokens.push(current.trim())
  return tokens
}

export function parseLibrarySearchQuery(query: string): ParsedLibrarySearchQuery {
  return tokenizeSearchQuery(query).reduce<ParsedLibrarySearchQuery>(
    (parsed, token) => {
      const separatorIndex = token.indexOf(':')
      if (separatorIndex <= 0) {
        parsed.terms.push(normalizeSearchValue(token))
        return parsed
      }

      const field = fieldAliases[normalizeFieldName(token.slice(0, separatorIndex))]
      const value = normalizeSearchValue(token.slice(separatorIndex + 1))
      if (!field || !value) {
        parsed.terms.push(normalizeSearchValue(token))
        return parsed
      }

      parsed.fieldTerms.push({ field, value })
      return parsed
    },
    { fieldTerms: [], terms: [] },
  )
}

function trackValues(track: Track, field: LibrarySearchField) {
  switch (field) {
    case 'title':
      return [track.title]
    case 'artist':
      return [track.artist, track.albumArtist]
    case 'album':
      return [track.album]
    case 'albumArtist':
      return [track.albumArtist]
    case 'genre':
      return [track.genre]
    case 'path':
      return [track.path]
  }
}

function searchableTrackValues(track: Track) {
  return [track.title, track.artist, track.albumArtist, track.album, track.genre, track.path]
}

function valuesContain(values: Array<string | null>, query: string) {
  return values.some((value) => value?.toLowerCase().includes(query))
}

export function trackMatchesLibrarySearch(track: Track, query: ParsedLibrarySearchQuery) {
  return (
    query.terms.every((term) => valuesContain(searchableTrackValues(track), term)) &&
    query.fieldTerms.every((term) => valuesContain(trackValues(track, term.field), term.value))
  )
}

export function filterTracksByLibrarySearch(tracks: Track[], query: string) {
  const parsed = parseLibrarySearchQuery(query)
  if (parsed.terms.length === 0 && parsed.fieldTerms.length === 0) return tracks
  return tracks.filter((track) => trackMatchesLibrarySearch(track, parsed))
}
