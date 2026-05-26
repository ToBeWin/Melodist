import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const outputDir = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'melodist-smoke-library'))

const tracks = [
  ['Aria Vale', 'Nocturne Signals', '01 Night Drive.wav', 440],
  ['Aria Vale', 'Nocturne Signals', '02 Glass Rain.wav', 554],
  ['Aria Vale', 'Nocturne Signals', '03 Signal Bloom.wav', 622],
  ['Aria Vale', 'Nocturne Signals', '04 Static Horizon.wav', 740],
  ['MetaPure Ensemble', 'Local First', '01 Private by Default.wav', 659],
  ['MetaPure Ensemble', 'Local First', '02 Cache Waltz.wav', 784],
  ['MetaPure Ensemble', 'Local First', '03 Offline Prelude.wav', 330],
  ['MetaPure Ensemble', 'Local First', '04 No Telemetry.wav', 494],
  ['夜行者', '霓虹档案', '01 城市低鸣.wav', 523],
  ['夜行者', '霓虹档案', '02 紫色信号.wav', 698],
  ['夜行者', '霓虹档案', '03 本地回声.wav', 587],
  ['夜行者', '霓虹档案', '04 私密星图.wav', 880],
]

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function createWavBuffer(frequency) {
  const sampleRate = 44_100
  const durationSeconds = 1
  const channels = 1
  const bitsPerSample = 16
  const sampleCount = sampleRate * durationSeconds
  const dataSize = sampleCount * channels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true)
  view.setUint16(32, channels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const value = Math.sin((sample / sampleRate) * frequency * Math.PI * 2) * 0.18
    view.setInt16(44 + sample * 2, Math.round(value * 32767), true)
  }

  return Buffer.from(buffer)
}

async function main() {
  for (const [artist, album, filename, frequency] of tracks) {
    const directory = path.join(outputDir, artist, album)
    await mkdir(directory, { recursive: true })
    const audioPath = path.join(directory, filename)
    await writeFile(audioPath, createWavBuffer(frequency))
  }

  await writeFile(
    path.join(outputDir, 'Aria Vale', 'Nocturne Signals', '01 Night Drive.lrc'),
    '[00:00.00]Night drive, take me home\n[00:00.50]Every signal turns to violet\n',
  )

  await writeFile(
    path.join(outputDir, 'README.txt'),
    'Synthetic WAV smoke library for Melodist release testing. These tones are generated locally and contain no copyrighted audio.\n',
  )

  console.log(outputDir)
}

await main()
