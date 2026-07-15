# Tectonic Stone Design System — Career Agent Web

**Date:** 2026-07-15  
**Status:** Approved for planning  
**Scope:** `apps/web` — design tokens, primitive components, `/design` gallery, and landing page restyle

## Goal

Establish **Tectonic Stone** (Digital Geology & Obsidian Minimalism) as the visual foundation for Career Agent’s web UI. First deliverable: a full design-system kit inside Next.js, with the coming-soon landing (`/`) as the first product surface.

## Design philosophy (from brief)

- UI is a single carved mineral mass — no floating glass cards, no soft roundness.
- **Plates** overlap; **fault lines** divide sections.
- Palette is dark stone; accent light comes from **magma** / gilded veins.
- Typography is engraved (inner-shadow / carved gradient).
- Motion has mass: thud, slow pulse, deliberate 700ms easing — never bounce.

## Decisions locked

| Decision | Choice |
|----------|--------|
| Scope | Full kit: tokens + primitives + `/design` gallery + landing |
| Display font | Cinzel |
| Body font | Space Grotesk |
| Docs surface | In-app `/design` route (no Storybook for v1) |
| Landing CTA | Magma “Enter” — inactive product path; scrolls to footer “quarrying in progress” note |
| Asset strategy | CSS-only grain / topo / basalt patterns (no photo masks in v1) |

## Architecture

```
apps/web/src/
  app/
    layout.tsx          # Cinzel + Space Grotesk, global stone body
    globals.css         # tokens, grain, transitions, keyframes
    page.tsx            # landing composition
    design/page.tsx     # exhaustive component gallery
  components/tectonic/
    MonolithPlate.tsx
    MagmaButton.tsx
    FaultLine.tsx
    StatusVein.tsx
    EngravedHeading.tsx
    MonolithFooter.tsx
    index.ts            # barrel export
```

Layers:

1. **Tokens** — CSS variables + Tailwind `@theme` mapping  
2. **Primitives** — reusable tectonic components  
3. **Gallery** — `/design` variants for visual QA  
4. **Product** — `/` lands on the kit

`apps/web` still holds no secrets; API health check remains client-side against `NEXT_PUBLIC_API_BASE_URL`.

## Design tokens

### Color

| Token | Hex | Role |
|-------|-----|------|
| `--obsidian` | `#050505` | Deep background / button fill |
| `--basalt` | `#1A1C1E` | Primary plate surface |
| `--granite` | `#2D3033` | Secondary panels / footer |
| `--magma` | `#FF4800` | Primary CTA border / glow |
| `--gilded` | `#D4AF37` | High-end labels / borders |
| `--ash` | `#E0E0E0` | Primary text |

Derived: ash highlight at 10% opacity (plate edge light); fault stroke ash at 20% opacity; topo lines magma at 5% opacity; grain overlay at ~12% opacity.

### Typography

- Headings: Cinzel, engraved effect (`text-shadow` etch + darker-top linear gradient via `background-clip: text` where appropriate)
- Body / UI: Space Grotesk, regular/medium
- Default corners: `rounded-none` everywhere in the tectonic system

### Motion

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`, duration `700ms`
- Load: thud (translate + short shake), not fade
- MagmaButton: inset magma heat on hover; instant brighten on active
- StatusVein: slow deep-orange pulse when `ok`
- Respect `prefers-reduced-motion: reduce` (disable thud/shake/pulse; keep opacity swaps if needed for state)

## Component contracts

### `MonolithPlate`

- Base: basalt or granite fill, heavy shadow `20px 20px 40px rgba(0,0,0,0.8)`
- Top-right 45° chamfer via `clip-path`
- Border: 1px top + left only, ash at 10% opacity
- No transparency / glass

### `MagmaButton`

- Default: obsidian fill, 2px magma border
- Hover: inset glow `rgba(255,72,0,0.4)`
- Active: brighten fill toward magma
- Disabled: muted border, no pulse
- Polymorphic: `button` or `Link`

### `FaultLine`

- Jagged SVG path (not `<hr>`)
- Stroke ash @ 20% opacity
- Optional tiny label slot

### `StatusVein`

- Props: `status: "checking" | "ok" | "down"`
- Visual: carved label + vein indicator (magma pulse when ok; cooled ash when down; gilded when checking)
- Replaces the current rounded pill status chip

### `EngravedHeading`

- Levels `h1`–`h3`
- Cinzel + etched / carved treatment

### `MonolithFooter`

- ~50vh granite block
- Minimal tiny ash text
- Includes link to `/design` and “quarrying in progress” note for CTA scroll target

## Landing composition (`/`)

1. Full-bleed obsidian plane with grain + topographic overlay  
2. Brand: **Career Agent** (EngravedHeading) as hero-level signal  
3. One supporting sentence (existing product intent: personal job-application assistant; human submits)  
4. Overlapping MonolithPlate with MagmaButton “Enter” + StatusVein (API health)  
5. FaultLine  
6. MonolithFooter  

First viewport: brand, one headline line, one short sentence, one CTA group, status — no stats/cards clutter.

## `/design` gallery

Ordered sections:

1. Color swatches + type samples  
2. MonolithPlate tones / chamfer  
3. MagmaButton states  
4. FaultLine  
5. StatusVein all three statuses  
6. EngravedHeading scale  
7. Footer fragment  
8. Motion notes + reduced-motion behavior  

No auth gate in v1 (dev-facing).

## Out of scope (explicit)

- Storybook or separate docs package  
- Photo / marble `background-clip` masks  
- Full scroll-parallax engine  
- Form inputs, tables, nav chrome (defer to product modules)  
- Dark/light theme toggle (Tectonic Stone is dark-only)  
- Changing API or auth behavior  

## Success criteria

- Landing and gallery match the mineral brief: weight, sharp cuts, magma accents, engraved type  
- Later modules can import from `components/tectonic` without reinventing surfaces  
- `prefers-reduced-motion` does not leave broken or stuck animations  
- Existing API health check behavior preserved with new StatusVein UI  

## Implementation notes

- Follow repo convention: web is UI-only; no secrets in `apps/web`  
- Prefer Tailwind v4 `@theme` for token exposure; complex effects (grain, etched text, fault SVG, keyframes) in `globals.css`  
- Keep components small and composable; barrel export for clean imports  
