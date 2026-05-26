import { access, readdir, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const libraryDir = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'melodist-smoke-library'))

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath))
    } else {
      files.push(entryPath)
    }
  }
  return files
}

async function main() {
  await access(libraryDir)
  const files = await walk(libraryDir)
  const wavFiles = files.filter((file) => file.toLowerCase().endsWith('.wav'))
  const lrcFiles = files.filter((file) => file.toLowerCase().endsWith('.lrc'))
  const hasUnicodePath = files.some((file) => Array.from(file).some((character) => character.charCodeAt(0) > 127))
  const lrcText = await readFile(path.join(libraryDir, 'Aria Vale', 'Nocturne Signals', '01 Night Drive.lrc'), 'utf8')

  if (wavFiles.length !== 12) {
    throw new Error(`Expected 12 WAV files, found ${wavFiles.length}`)
  }
  if (lrcFiles.length < 1 || !lrcText.includes('[00:00.50]')) {
    throw new Error('Expected at least one timestamped LRC sidecar')
  }
  if (!hasUnicodePath) {
    throw new Error('Expected at least one non-ASCII path')
  }

  for (const wavFile of wavFiles) {
    const metadata = await stat(wavFile)
    if (metadata.size <= 44) {
      throw new Error(`WAV file is too small: ${wavFile}`)
    }
  }

  console.log(`Smoke library verified: ${libraryDir}`)
}

await main()
