import { translate } from './i18n'
import type { AppLanguage, ScanResult } from '../types'

export function scanResultMessage(language: AppLanguage, result: ScanResult) {
  const base = translate(language, 'library.scanResultSummary', {
    added: result.added,
    updated: result.updated,
    removed: result.removed,
    lyrics: result.importedLyrics,
  })
  if (result.failed === 0) return base
  const sample = result.failures[0]
  return sample
    ? translate(language, 'library.scanResultFirstIssue', {
        base,
        failed: result.failed,
        path: sample.path,
        reason: sample.reason,
      })
    : translate(language, 'library.scanResultFailed', { base, failed: result.failed })
}

export function scanFailureDetails(result: ScanResult) {
  return result.failures.map((failure) => `${failure.path} - ${failure.reason}`)
}
