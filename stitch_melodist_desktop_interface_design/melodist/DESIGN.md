---
name: Melodist
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#cac4d4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#948e9d'
  outline-variant: '#494552'
  surface-tint: '#cebdff'
  primary: '#cebdff'
  on-primary: '#381385'
  primary-container: '#a78bfa'
  on-primary-container: '#3c1989'
  inverse-primary: '#674bb5'
  secondary: '#d2bbff'
  on-secondary: '#3f008e'
  secondary-container: '#6001d1'
  on-secondary-container: '#c9aeff'
  tertiary: '#dbc839'
  on-tertiary: '#373100'
  tertiary-container: '#af9e00'
  on-tertiary-container: '#3b3500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e8ddff'
  primary-fixed-dim: '#cebdff'
  on-primary-fixed: '#21005e'
  on-primary-fixed-variant: '#4f319c'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#f8e454'
  tertiary-fixed-dim: '#dbc839'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#504700'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  title-lyrics:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-primary:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-secondary:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  metadata-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar_width: 220px
  player_height: 80px
  row_height: 52px
  gutter: 16px
  margin_window: 24px
  stack_tight: 4px
  stack_base: 8px
  stack_loose: 16px
---

## Brand & Style

The design system is engineered to transform the music player into an ambient, unobtrusive object within the desktop environment. The visual identity is anchored in a **Modern Corporate** style with a leaning toward **Minimalism**, prioritizing the music's metadata and artwork over the interface itself.

The personality is "Quietly Premium." It avoids the loud, saturated gradients common in streaming services, opting instead for deep neutrals and a singular, sophisticated accent. The interface should feel native to macOS, Windows, and Linux—utilizing precision-engineered spacing and subtle depth rather than flashy visual effects. The emotional response is one of calm, focus, and utility.

## Colors

This design system utilizes a "Dark-Only" palette to reduce ocular strain and maintain an ambient presence on the desktop.

- **Foundations:** The `#0f0f0f` base provides a deep, near-black canvas that allows album artwork to pop without high-contrast glare. 
- **Layering:** Hierarchy is established through incremental lightness: `Base` -> `Surface` -> `Elevated`.
- **Interaction:** Hover states use a lightened neutral (`#2e2e2e`) to provide immediate tactile feedback.
- **Accents:** The Violet accent (`#a78bfa`) is reserved strictly for active states, playback progress, and primary actions to ensure it remains a point of focus rather than a decorative element.

## Typography

The typography strategy leverages the high legibility of **Inter** for standard UI elements and **Geist** for labels to achieve a modern, technical feel. **JetBrains Mono** (mapping to the mono system stack) is used for technical metadata like bitrates, file paths, or timestamps.

- **Scale:** The 15px primary size ensures comfortable reading on high-density desktop monitors.
- **Metadata:** Use 11px uppercase labels for category headers or technical specs to differentiate them from actionable content.
- **Lyrics:** Titles and lyrics utilize the 18px tier with tighter tracking to feel "editorial" yet clear.

## Layout & Spacing

This design system uses a **Fixed-Fluid** hybrid layout tailored for desktop windows.

- **Structure:** A fixed 220px sidebar on the left and a fixed 80px player bar at the bottom. The main content area is fluid, utilizing a flexible grid that scales based on the window width.
- **Density:** Table rows are strictly 52px high to maintain a high information density suitable for large music libraries.
- **Grid:** Use a 4px baseline grid for all internal component spacing (padding/margins). Larger gaps between sections should follow a 16px/24px/32px progression.
- **Responsive:** On narrower window widths, the sidebar should collapse into an icon-only rail (64px) to preserve space for the song table.

## Elevation & Depth

The design system avoids traditional drop shadows to maintain a "flat-native" aesthetic. Depth is communicated through **Tonal Layering** and **Low-Contrast Outlines**.

- **Surface Tiering:** The background (`#0f0f0f`) is the lowest level. Content cards and the sidebar sit on `Surface` (`#1a1a1a`). Modals or floating menus sit on `Elevated` (`#242424`).
- **Borders:** Every surface transition must be defined by a 1px border using `border_subtle`. For interactive elements like input fields or active buttons, use `border_strong`.
- **Glass Effects:** Optional backdrop-blur (20px) may be applied only to the Sidebar or Player Bar when content scrolls underneath, using a semi-transparent version of the `Surface` color.

## Shapes

The shape language is disciplined and geometric, reflecting a "Soft" desktop aesthetic.

- **Album Artwork:** Strictly 160x160px with a 8px (`rounded-lg`) corner radius.
- **Buttons & Inputs:** Use a 4px (`base`) radius to maintain a professional, sharp look.
- **Selection States:** Items in a list (songs/folders) use a 4px radius for their hover/active backgrounds.
- **Context Menus:** Use 6px or 8px corners to distinguish floating utility windows from the main UI structure.

## Components

### Buttons & Sliders
- **Primary Button:** Violet background, 13px bold text, 4px radius. 32px height for standard, 28px for compact.
- **Sliders (Volume/Progress):** 4px thick track (Muted Text color), Violet thumb and active fill. The thumb only appears on hover for an "ambient" feel.

### Lists & Tables
- **Song Rows:** 52px height. Hover state uses `surface_hover`. Active/Selected state uses a subtle violet tint or a 2px left-border accent.
- **Columns:** Alignment is critical. Track number (Mono, right-aligned), Title (Primary, left), Artist/Album (Secondary, left), Duration (Mono, right).

### Sidebar
- **Navigation:** 13px text, 24px icons. Use `text_secondary` for inactive and `text_primary` with a violet icon for active.

### Cards
- **Album Card:** 160px square artwork. Title sits directly below (Primary text), Artist below title (Secondary text, 13px). No border on the artwork itself; let the `border_subtle` of the container define the space.

### Input Fields
- **Search:** `surface_elevated` background, no shadow, `border_subtle`. 13px text with a 16px magnifying glass icon.