# Melodist v0.1 Release Checklist

Use this checklist before publishing a v0.1 build. It is intentionally practical: verify with real audio, real OS packaging, and no assumptions from the mock UI.

## Release Principles

- Melodist is local-first and privacy-first.
- No telemetry, analytics, crash reporting, or always-on network requests are allowed in v0.1.
- User data must be stored in the OS app data directory, not the project folder.
- Whisper lyrics generation and translation are v0.2 out-of-scope items and should not block v0.1 unless accidentally exposed as active features.

## Automated Checks

Run from the repository root unless noted:

```bash
node --version
pnpm --version
rustc --version
corepack prepare pnpm@10.13.1 --activate
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke:library
pnpm smoke:verify-library
pnpm build
```

Run Rust checks from `src-tauri`:

```bash
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

For release packaging:

```bash
pnpm tauri build
pnpm release:collect-assets
```

Linux builders need the native audio and WebKitGTK headers used by Tauri and
the audio backend. On Ubuntu 22.04, install:

```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libasound2-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Record the OS, architecture, Node version, pnpm version, and Rust version used for the release candidate.
For signed public builds, configure the platform signing secrets consumed by `.github/workflows/release.yml` before creating a `v*` tag.
The current Windows installer uses the WebView2 download bootstrapper, so
installer-time network access must be documented or validated on a clean
machine that already has WebView2 installed.

## Real Audio Manual Test

Prepare a small local test library outside the repository:

- At least 12 tracks across 3 albums and 3 artists
- Formats: MP3, FLAC, M4A or AAC, OGG or OPUS, WAV if available
- At least one track with embedded cover art
- At least one track without cover art
- At least one track with embedded lyrics, if available
- At least one `.lrc` sidecar file with the same basename as the audio file
- Non-ASCII metadata, for example Chinese, Japanese, Korean, or accented Latin text
- A nested folder structure at least 3 levels deep

You can generate a copyright-free synthetic WAV smoke library with:

```bash
pnpm smoke:library
pnpm smoke:verify-library
```

The generated library is useful for scanner, path, non-ASCII filename, queue, playback, and LRC smoke checks. It does not replace testing with real MP3, FLAC, AAC/M4A, OGG/OPUS, and embedded artwork files before release.

Manual pass:

1. Launch the app with `pnpm tauri dev` or an installed release candidate.
2. Add the test music directory from Settings or the library entry point.
3. Verify scan progress appears and completes without freezing the UI.
4. Confirm tracks appear with title, artist, album, duration, and stable ordering.
5. Search by title, artist, album, and non-ASCII metadata.
6. Start playback by double-clicking a track.
7. Verify play, pause, resume, seek, next, previous, and volume controls.
8. Verify progress time updates while playing and does not jump unexpectedly.
9. Toggle shuffle and repeat modes, then verify queue behavior.
10. Open and close the lyrics panel.
11. Verify embedded lyrics or LRC sidecar lyrics display when available.
12. Click a timestamped lyrics line and confirm playback seeks to that position.
13. Verify cover art displays for tracks with embedded art and fallback UI displays for tracks without art.
14. Quit and relaunch the app.
15. Confirm settings, volume, and known library state persist.
16. Confirm no user data was written inside the repository directory.
17. Drag audio files into the library and verify they scan.
18. Drag a music folder into the library and verify nested supported files scan.
19. Drag a same-name `.lrc` file and verify it is imported or reports a clear failure.
20. Switch audio output devices when available and confirm playback still works after restart.
21. Toggle ReplayGain normalization and confirm it does not break playback.
22. Save or edit LRC lyrics and confirm the sidecar write location is expected by the tester.
23. Monitor network activity during normal playback and browsing; there should be no unexpected network requests.

## Keyboard Manual Test

With a track loaded, verify:

- Space toggles play and pause.
- Left and right arrows seek backward and forward.
- Up and down arrows adjust volume.
- `N` and `P` move to next and previous track.
- `L` toggles the lyrics panel.
- `S` toggles shuffle.
- `R` cycles repeat mode.

If a shortcut conflicts with the OS or focused control, document the behavior before release.

## Platform Release Checks

### macOS

- Build on macOS 14 or newer for the release candidate.
- Verify the app launches on macOS 12 or newer.
- Confirm microphone, network, file, and folder permissions are not requested unexpectedly.
- Verify adding a music folder works through the native file dialog.
- Confirm playback continues when the window is backgrounded.
- Verify the packaged `.dmg` or `.app` opens cleanly after installation.
- If signing or notarization is enabled, verify Gatekeeper accepts the build.

### Windows

- Build and test on Windows 10 or newer.
- Verify installer flow, app launch, and uninstall behavior.
- Verify whether WebView2 is preinstalled or whether the bootstrapper needs network access.
- Confirm paths with spaces and non-ASCII characters scan correctly.
- Verify playback through the default audio device.
- Confirm the app does not require administrator privileges for normal use.
- Check that user data is written under the standard Windows app data location.

### Linux

- Build and test on a glibc 2.31+ distribution.
- Verify required WebKitGTK and system libraries are documented for the target package.
- Confirm scan and playback work with paths containing spaces and non-ASCII characters.
- Verify the app launches from the packaged artifact, not only from the dev server.
- Check user data is written under the standard XDG app data location.

## v0.2 Out Of Scope

Do not hold v0.1 for these unless they are accidentally visible as broken primary UI:

- Whisper local inference for lyrics generation
- LLM-backed translation
- Translation cache management
- Translation provider configuration beyond disabled or placeholder UI

If any v0.2 feature is visible in v0.1, it must be clearly disabled, marked unavailable, or hidden.

## Sign-Off

Record the final release candidate:

- Version:
- Commit or build identifier:
- macOS result:
- Windows result:
- Linux result:
- Known issues:
- Release owner:
- Date:

## Bundle Outputs

On tagged releases, GitHub Actions runs `.github/workflows/release.yml`, stores per-platform workflow artifacts, collects only distributable files such as `.dmg`, Windows installer `.exe`, `.deb`, and `.AppImage`, then publishes those assets to the matching GitHub Release.

For local macOS packaging checks, `pnpm tauri build --ci` should produce:

- `src-tauri/target/release/bundle/macos/Melodist.app`
- `src-tauri/target/release/bundle/dmg/Melodist_0.1.0_aarch64.dmg`

CI also builds Linux `.deb` and `.AppImage` bundles and the Windows NSIS installer
on every push to `main`, so tagged releases should not be the first time those
package formats are exercised.
