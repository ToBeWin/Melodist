# Melodist Figma Handoff

This handoff package turns the Stitch output into a Figma-ready structure for the Melodist desktop app.

## Figma File

Created Figma file:

- `Melodist UI Handoff`
- https://www.figma.com/design/Qv8mEPRqkgKxbVaUmbrltp

Because the connected Figma account is on a Starter plan with a 3-page limit, the automated setup uses a compact page structure:

1. `01 Screens`
2. `02 Components & Variables`
3. `99 Archive / Stitch Source`

## Source Assets

Use these files as visual references:

| Stitch screen | File | Status | Notes |
| --- | --- | --- | --- |
| Library / Tracks | `stitch_melodist_desktop_interface_design/library_tracks/screen.png` | Usable | 2560 x 2882 RGBA |
| Settings | `stitch_melodist_desktop_interface_design/settings/screen.png` | Usable | 2560 x 4330 RGBA |
| Component System Overview | `stitch_melodist_desktop_interface_design/component_system_overview/screen.png` | Usable | 1600 x 1280 RGB |
| Library / Albums | `stitch_melodist_desktop_interface_design/library_albums/screen.png` | Broken export | Contains `<FIFE Image failed to fetch>` |
| Lyrics Panel | `stitch_melodist_desktop_interface_design/lyrics_panel/screen.png` | Broken export | Contains `<FIFE Image failed to fetch>` |
| Now Playing | `stitch_melodist_desktop_interface_design/now_playing/screen.png` | Broken export | Contains `<FIFE Image failed to fetch>` |

Re-export the broken screens from Stitch before final Figma assembly.

## Recommended Figma Pages

Create these pages in this order:

1. `00 Cover`
2. `01 Screens`
3. `02 Components`
4. `03 Variables`
5. `04 Redlines`
6. `99 Archive / Stitch Source`

## Frame Names

On `01 Screens`, use these top-level frame names:

- `Library / Tracks / Scanning`
- `Library / Albums`
- `Now Playing`
- `Lyrics Panel / Bilingual`
- `Settings`

On `99 Archive / Stitch Source`, place the original Stitch screenshots as locked reference images:

- `Stitch Reference / Library Tracks`
- `Stitch Reference / Settings`
- `Stitch Reference / Component System`
- `Stitch Reference / Albums - Missing`
- `Stitch Reference / Lyrics - Missing`
- `Stitch Reference / Now Playing - Missing`

## Component Naming

Use slash-based Figma component names:

- `App Shell/Sidebar`
- `App Shell/Player Bar`
- `App Shell/Top Toolbar`
- `Navigation/Sidebar Item`
- `Navigation/Sidebar Item/Collapsed`
- `Library/Track Row`
- `Library/Track Row/Playing`
- `Library/Track Row/Selected`
- `Library/Album Tile`
- `Lyrics/Lyric Line`
- `Lyrics/Lyric Line/Current`
- `Lyrics/Lyric Line/Bilingual`
- `Controls/Icon Button`
- `Controls/Primary Button`
- `Controls/Secondary Button`
- `Controls/Segmented Control`
- `Controls/Search Field`
- `Controls/Range Slider`
- `Controls/Toggle`
- `Controls/Select`
- `Settings/Settings Row`
- `Settings/Settings Section`
- `Feedback/Scan Progress`
- `Feedback/Privacy Note`

## Layout Rules

- Base grid: 4px.
- Desktop reference frame: 1440 x 900.
- Sidebar width: 220px.
- Player bar height: 80px.
- Track row height: 52px.
- Main content padding: 24px.
- Standard internal gap: 8px.
- Section gap: 24px or 32px.
- Lyrics panel width: 380px.
- Album tile artwork: 160 x 160px.

Use auto layout for all repeated or structured UI:

- Sidebar nav stack
- Player bar sections
- Track rows
- Settings rows
- Album grid cards
- Lyrics line stack

Avoid nested cards. Sections should be unframed or use a single panel only where the UI needs containment.

## Visual Notes

The Stitch design currently leans slightly toward Material-style purple and high panel borders. For final Figma handoff, align it back to the AGENTS.md product direction:

- Dark-only.
- Quiet, premium, native desktop feeling.
- Violet accent is functional, not decorative.
- No marketing hero layout.
- No light mode.
- No oversized type in operational UI.
- No visible onboarding copy inside the main interface.

## Handoff Checklist

- [ ] Create variables from `tokens.json`.
- [ ] Create text styles from `tokens.json`.
- [ ] Place original Stitch screenshots on `99 Archive / Stitch Source`.
- [ ] Re-export missing Stitch screens for Albums, Lyrics, and Now Playing.
- [ ] Rebuild main screens as editable Figma frames, not flat screenshots.
- [ ] Convert repeated UI into named components.
- [ ] Apply 4px grid spacing consistently.
- [ ] Verify player bar is exactly 80px high.
- [ ] Verify sidebar is exactly 220px wide.
- [ ] Verify track rows are exactly 52px high.
- [ ] Add redlines for spacing, row height, sidebar width, player height, and lyrics panel width.
- [ ] Add component variants for default, hover, active, selected, disabled, and playing states.
- [ ] Keep all network/AI features marked opt-in in Settings.
