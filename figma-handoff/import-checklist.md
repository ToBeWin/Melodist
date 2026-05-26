# Import Checklist

## Before Import

- Re-export broken Stitch screens:
  - `library_albums/screen.png`
  - `lyrics_panel/screen.png`
  - `now_playing/screen.png`
- Keep the original screenshots as references only.
- Use editable Figma layers for final screens.

## Figma Setup

1. Create a new Figma design file named `Melodist UI Handoff`.
2. Create pages from `README.md`.
3. Create variables from `tokens.json`.
4. Create text styles:
   - `Display / 24 Semibold`
   - `Title / 18 Semibold`
   - `Body / 15 Regular`
   - `Label / 13 Regular`
   - `Metadata / 11 Semibold`
   - `Mono / 12 Regular`
   - `Lyrics / Current 18 Medium`
5. Import Stitch screenshots onto `99 Archive / Stitch Source`.
6. Lock source screenshot frames.
7. Rebuild `01 Screens` using components from `02 Components`.

## QA Pass

- All screen frames use 1440 x 900 unless intentionally taller for scroll documentation.
- All dimensions align to the 4px grid.
- Player bar remains visible and 80px high.
- Sidebar remains 220px wide.
- Track rows remain 52px high.
- Tables are dense enough for large music libraries.
- Violet accent only appears for active, playback, and primary action states.
- No light-mode tokens or frames are introduced.
- No raw `Stitch`/generator labels remain in final screens.

