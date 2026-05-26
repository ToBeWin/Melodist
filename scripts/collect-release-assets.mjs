import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const sourceDir = path.resolve(process.argv[2] ?? defaultSourceDir())
const outputDir = path.resolve(process.argv[3] ?? path.join(os.tmpdir(), 'melodist-release-assets'))

const releaseAssetRules = [
  { directory: 'appimage', suffixes: ['.AppImage'] },
  { directory: 'deb', suffixes: ['.deb'] },
  { directory: 'dmg', suffixes: ['.dmg'] },
  { directory: 'msi', suffixes: ['.msi'] },
  { directory: 'nsis', suffixes: ['.exe'] },
  { directory: 'rpm', suffixes: ['.rpm'] },
]

function defaultSourceDir() {
  return path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle')
}

function isReleaseAsset(filePath) {
  const basename = path.basename(filePath)
  const segments = path.relative(sourceDir, filePath).split(path.sep)
  return releaseAssetRules.some((rule) => {
    const inBundleDirectory = segments.includes(rule.directory)
    const hasReleaseSuffix = rule.suffixes.some((suffix) => basename.endsWith(suffix))
    return inBundleDirectory && hasReleaseSuffix
  })
}

function safeAssetName(filePath) {
  const relativePath = path.relative(sourceDir, filePath)
  return relativePath.split(path.sep).join('-').replaceAll(' ', '_')
}

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
  const sourceStats = await stat(sourceDir)
  if (!sourceStats.isDirectory()) {
    throw new Error(`Release artifact source is not a directory: ${sourceDir}`)
  }

  const files = await walk(sourceDir)
  const assets = files.filter(isReleaseAsset)
  if (assets.length === 0) {
    throw new Error(`No release assets found in ${sourceDir}`)
  }

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })

  const copied = []
  for (const asset of assets) {
    const target = path.join(outputDir, safeAssetName(asset))
    await copyFile(asset, target)
    copied.push(target)
  }

  console.log(`Collected ${copied.length} release asset(s):`)
  for (const asset of copied) {
    console.log(asset)
  }
}

await main()
