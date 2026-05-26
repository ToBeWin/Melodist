# Component Inventory

## Foundations

Create Figma variables from `tokens.json` before rebuilding components.

Recommended variable collections:

- `Color / Dark`
- `Typography`
- `Spacing`
- `Radius`
- `Size`
- `Motion`

## App Shell

### `App Shell/Sidebar`

Properties:

- `state`: `expanded | collapsed`
- `activeItem`: `home | library | playlists | recent | settings | albums | artists`

Specs:

- Width: 220px expanded, 56px collapsed.
- Background: `color.bg.surface`.
- Right border: `color.border.subtle`.
- Brand area: 24px top padding, 16px horizontal padding.
- Nav stack gap: 4px.

### `App Shell/Player Bar`

Properties:

- `status`: `stopped | loading | playing | paused`
- `lyricsOpen`: `true | false`
- `queueOpen`: `true | false`

Specs:

- Height: 80px.
- Position: bottom fixed in implementation.
- Background: `color.bg.surface`.
- Top border: `color.border.subtle`.
- Left: artwork 48px, title, artist.
- Center: shuffle, previous, play/pause, next, repeat, progress.
- Right: queue, lyrics, volume.

## Navigation

### `Navigation/Sidebar Item`

Variants:

- `state`: `default | hover | active | disabled`
- `collapsed`: `true | false`

Specs:

- Height: 40px.
- Horizontal padding: 8px expanded.
- Radius: 4px.
- Active indicator: 2px left accent.

## Library

### `Library/Track Row`

Variants:

- `state`: `default | hover | selected | playing`
- `cover`: `image | placeholder`

Specs:

- Height: 52px.
- Cover: 32px.
- Track number/time: mono.
- Selected state: subtle accent fill plus 2px left border.

### `Library/Album Tile`

Variants:

- `state`: `default | hover | selected`

Specs:

- Artwork: 160 x 160px.
- Radius: 8px.
- Text stack below artwork, not inside a decorative card.

## Lyrics

### `Lyrics/Lyric Line`

Variants:

- `state`: `past | current | future`
- `translation`: `none | translated | bilingual`

Specs:

- Current line: accent color, 18px, medium.
- Past line: muted.
- Future line: secondary.
- Bilingual translation: 13px secondary below original.

## Controls

### `Controls/Icon Button`

Variants:

- `state`: `default | hover | active | disabled`
- `selected`: `true | false`
- `size`: `sm | md | lg`

### `Controls/Primary Button`

Variants:

- `state`: `default | hover | pressed | disabled`
- `icon`: `none | leading`

Specs:

- Height: 32px.
- Compact: 28px.
- Radius: 8px.

### `Controls/Search Field`

Variants:

- `state`: `default | focused | filled | disabled`

Specs:

- Height: 40px in toolbar.
- Icon: 16px.
- Radius: pill or 8px depending final screen.

### `Controls/Range Slider`

Variants:

- `kind`: `progress | volume`
- `thumbVisible`: `true | false`

Specs:

- Track height: 4px.
- Thumb: 12px, visible on hover/focus.

## Settings

### `Settings/Settings Section`

Specs:

- Max content width: 760px.
- Section heading: 18px title.
- Section gap: 32px.

### `Settings/Settings Row`

Variants:

- `control`: `toggle | select | button | radio | text`

Specs:

- Minimum height: 64px.
- Label and helper text on left.
- Control on right.

