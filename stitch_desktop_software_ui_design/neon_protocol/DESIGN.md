---
name: Neon Protocol
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
  on-surface-variant: '#e5bcc5'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#ac878f'
  outline-variant: '#5c3f46'
  surface-tint: '#ffb1c4'
  primary: '#ffb1c4'
  on-primary: '#65002e'
  primary-container: '#ff4a8d'
  on-primary-container: '#590028'
  inverse-primary: '#ba005b'
  secondary: '#ffffff'
  on-secondary: '#00382b'
  secondary-container: '#24ffcd'
  on-secondary-container: '#00725a'
  tertiary: '#dfb7ff'
  on-tertiary: '#4b007e'
  tertiary-container: '#ba6bff'
  on-tertiary-container: '#41006f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd9e1'
  primary-fixed-dim: '#ffb1c4'
  on-primary-fixed: '#3f001a'
  on-primary-fixed-variant: '#8f0044'
  secondary-fixed: '#24ffcd'
  secondary-fixed-dim: '#00e0b3'
  on-secondary-fixed: '#002118'
  on-secondary-fixed-variant: '#00513f'
  tertiary-fixed: '#f1daff'
  tertiary-fixed-dim: '#dfb7ff'
  on-tertiary-fixed: '#2d004f'
  on-tertiary-fixed-variant: '#6b00b0'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Space Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Mono
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: Space Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  code-snippet:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1280px
---

## Brand & Style
The design system embodies a "High Tech, Low Life" cyberpunk aesthetic, blending 80s retro-futurism with modern digital precision. It targets a tech-literate, developer-centric audience that appreciates hacker culture and terminal-inspired interfaces.

The design style is **Retro / Vaporwave** mixed with **Cyberpunk Brutalism**. Key characteristics include:
- **Digital Decay:** The use of scanlines, chromatic aberration, and pixelated motifs.
- **Luminous Contrast:** High-saturation neon accents against an obsidian-dark void.
- **Terminal Heritage:** Monospaced typography and rigid grid structures that evoke command-line interfaces.
- **Active State Glow:** Elements should feel "energized" when interacted with, utilizing outer glows and flickering transitions.

## Colors
This design system utilizes a high-contrast palette optimized for OLED displays and low-light environments.

- **Primary (Neon Pink):** Used for critical actions, branding, and high-priority status indicators.
- **Secondary (Mint Green):** Used for success states, data visualization, and secondary navigational elements.
- **Background:** A deep, near-black (#0D0D0D) to provide maximum "pop" for the neon accents.
- **Functional Accents:** A deep violet (#9D00FF) is used for tertiary depth and subtle gradients.
- **Glow Effects:** All primary and secondary colors should utilize a 5-10px Gaussian blur "bloom" effect on hover or active states to simulate gas-discharge lighting.

## Typography
The typography is strictly monospaced to reinforce the technical, terminal-like narrative of the design system.

- **Headlines:** Use Bold weights with tight letter-spacing. For display purposes, use an "interlaced" look by applying a subtle horizontal line pattern overlay.
- **Body:** Standard weight for maximum legibility. Ensure line height is generous (1.6) to offset the inherent density of monospaced fonts.
- **Labels:** Always uppercase with wide tracking to differentiate from body text and provide a "data-tag" appearance.
- **Responsiveness:** Scale headlines down by approximately 25% on mobile devices to prevent excessive line-breaking.

## Layout & Spacing
The layout follows a **Fixed Grid** model based on a 4px baseline to maintain "pixel-perfect" alignment.

- **Grid:** 12-column system for desktop; 4-column system for mobile.
- **Gutters:** Fixed at 16px to maintain a tight, industrial feel.
- **Borders:** Layout sections should be separated by 1px solid lines rather than whitespace alone, mimicking a blueprint or technical schematic.
- **Scanlines:** A global overlay of 2px height horizontal lines (opacity 3-5%) should be applied to the entire viewport to simulate a CRT display.

## Elevation & Depth
In this design system, depth is not conveyed through natural shadows, but through **Tonal Layers** and **Luminous Borders**.

- **Z-Axis:** Higher elevation is indicated by brighter border colors and increased interior saturation.
- **Borders:** Use 1px or 2px solid borders. For elevated cards, use the Primary Pink or Secondary Mint as the border color.
- **Outer Glows:** Instead of drop shadows, use `box-shadow` with 0px offset and a spread/blur of the element's accent color (e.g., `0 0 10px #FF007F`).
- **Overlays:** Use semi-transparent black (#0D0D0D at 80% opacity) for modals, keeping the scanline effect visible underneath.

## Shapes
The shape language is strictly **Sharp**. 

- **Corners:** 0px border-radius across all components (buttons, inputs, cards).
- **Cut-outs:** For a more "cyber" feel, use CSS `clip-path` to create 45-degree chamfered corners (dog-eared corners) on primary call-to-action buttons.
- **Decorations:** Use 4x4 pixel squares at the corners of containers to simulate "mounting brackets."

## Components
- **Buttons:** Sharp edges, 1px solid borders. Primary buttons use a Pink background with Black text. On hover, they "glitch" (a rapid 2px horizontal shift) and gain a Mint Green outer glow.
- **Inputs:** Dark background with a Mint Green bottom border. The cursor should be a solid Mint Green block that blinks.
- **Chips:** Small, uppercase labels with a 1px Mint Green border. Used for status tags like `[SYSTEM_OK]` or `[ACCESS_DENIED]`.
- **Cards:** Background color #1A1A1A with a Pink top-border (2px). Any images inside cards should have a subtle duotone filter (Pink/Black).
- **Progress Bars:** Segmented into "bits" (rectangles) rather than a continuous smooth fill, filling from left to right in Mint Green.
- **Lists:** Each item is separated by a 1px dashed line. Hovering over a list item changes the text color to Neon Pink.