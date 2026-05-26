# Figma Build Prompt

Use this prompt if you are asking an AI design assistant inside Figma to rebuild the Stitch design as editable Figma layers.

```text
Prepare the Melodist desktop music player UI for Figma handoff using the imported Stitch screenshots as visual references.

Create a clean Figma file with these pages:
00 Cover
01 Screens
02 Components
03 Variables
04 Redlines
99 Archive / Stitch Source

Use the Melodist tokens from tokens.json. Preserve the dark-only product identity:
background #0f0f0f, surface #1a1a1a, elevated #242424, hover #2e2e2e, subtle border rgba(255,255,255,0.08), primary text rgba(255,255,255,0.92), secondary text rgba(255,255,255,0.55), muted text rgba(255,255,255,0.30), accent #a78bfa, accent dim #7c3aed.

Use a 4px grid. Desktop frames are 1440x900. Sidebar is 220px wide. Player bar is 80px high. Track rows are 52px high. Lyrics panel is 380px wide. Album artwork is 160x160. Player artwork is 48x48. Track artwork is 32x32.

Rebuild the UI as editable Figma frames and components, not flat screenshots.

On 01 Screens, create:
Library / Tracks / Scanning
Library / Albums
Now Playing
Lyrics Panel / Bilingual
Settings

On 02 Components, create and name these components:
App Shell/Sidebar
App Shell/Player Bar
App Shell/Top Toolbar
Navigation/Sidebar Item
Library/Track Row
Library/Album Tile
Lyrics/Lyric Line
Controls/Icon Button
Controls/Primary Button
Controls/Secondary Button
Controls/Segmented Control
Controls/Search Field
Controls/Range Slider
Controls/Toggle
Controls/Select
Settings/Settings Row
Settings/Settings Section
Feedback/Scan Progress
Feedback/Privacy Note

Use auto layout for structural groups:
sidebar nav stack, player bar sections, toolbar, track rows, settings rows, album grid tiles, lyrics stack.

Create variants for default, hover, active, selected, disabled, playing, focused, and pressed states where relevant.

Keep the UI quiet, premium, and native-desktop-like. Do not make it look like a marketing landing page. Do not use light mode. Do not use bright gradients or decorative blobs. Do not put cards inside cards.

For Settings, preserve privacy-first language and mark translation or AI/network features as opt-in.

For Redlines, annotate:
sidebar width 220px
player height 80px
track row height 52px
main content padding 24px
lyrics panel width 380px
album artwork 160px
player artwork 48px
track artwork 32px
standard gaps 4/8/16/24/32px
```

