---
name: Vigie
description: One supervisor for every local dev server — the landing page.
colors:
  harbor-ink: "oklch(0.21 0.02 262)"
  signal-blue: "oklch(0.6231 0.188 259.8145)"
  signal-blue-deep: "oklch(0.52 0.2 262)"
  deck-white: "oklch(0.985 0.002 250)"
  card-white: "oklch(1 0 0)"
  hairline: "oklch(0.9276 0.0058 264.5313)"
  slate-text: "oklch(0.45 0.02 262)"
  faint-text: "oklch(0.52 0.015 262)"
  night-ground: "oklch(0.2046 0 0)"
  night-card: "oklch(0.2686 0 0)"
  night-band: "oklch(0.165 0.012 262)"
  night-band-dark-mode: "oklch(0.135 0.01 262)"
  status-ok: "oklch(0.64 0.17 150)"
  status-warn: "oklch(0.7 0.15 70)"
  status-bad: "oklch(0.6368 0.2078 25.3313)"
  status-ok-dark-mode: "oklch(0.76 0.17 150)"
  status-warn-dark-mode: "oklch(0.8 0.15 80)"
  syntax-key: "oklch(0.78 0.11 250)"
  syntax-string: "oklch(0.88 0.05 225)"
  syntax-number: "oklch(0.82 0.1 300)"
typography:
  display:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5.6vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 4.6vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  brand:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "ui-monospace, Cascadia Code, SF Mono, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
  caption:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: "6px"
  sm: "8px"
  control: "12px"
  md: "14px"
  lg: "16px"
  xl: "20px"
  frame: "28px"
  band: "44px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.harbor-ink}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "16px 26px"
  button-quiet:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.harbor-ink}"
    rounded: "{rounded.md}"
    padding: "16px 22px"
  nav-bar:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    height: "68px"
  frame:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.frame}"
    padding: "14px"
  band:
    backgroundColor: "{colors.night-band}"
    rounded: "{rounded.band}"
---

# Design System: Vigie

## Overview

**Creative North Star: "The Harbor Master's Desk"**

A calm, bright deck where everything that runs on the machine is laid out in plain view: white cards on a cool deck, one ink for decisions, one signal blue for what matters. The page follows the ekklo.com structure the user chose (floating nav, centered hero over a framed product shot, a Sans/Avec comparison with tilted stacked cards, an auto-advancing feature list beside an illustrated panel, dark glass cards, three steps with the last one dark, tabbed FAQ, a closing dark band), translated into Vigie's own material: ports, status dots, terminals and a lookout's range rings.

Headlines are heavy and tight like a harbor sign; paragraphs are soft and readable. Darkness is used as a material, not a theme: terminals and the closing band are always deep ink, in light and dark mode alike.

**Key Characteristics:**
- Satoshi for every heading, DM Sans for every paragraph; code in the system monospace stack.
- Accent words set in Satoshi Black Italic, Signal Blue — never a script face.
- Double frames: a white outer frame with hairline border holding the product shot or panel.
- Status color (green / amber / red) only ever means server state.

## Colors

Restrained: cool neutrals carry the page, Harbor Ink carries every decision, Signal Blue is rare and pointed.

### Primary
- **Harbor Ink** (oklch(0.21 0.02 262)): headings, primary buttons, dark bands and terminals.
- **Signal Blue** (oklch(0.6231 0.188 259.8145)): accent words, focus rings, active tab, range-ring glow. Same value in light and dark (tweakcn Modern Minimal primary).

### Neutral
- **Deck White** (oklch(0.985 0.002 250)): page ground in light mode.
- **Card White** (oklch(1 0 0)): cards, nav, frames.
- **Hairline** (oklch(0.9276 0.0058 264.5313)): borders and dashed separators.
- **Slate Text** (oklch(0.45 0.02 262)): secondary paragraphs on light grounds.
- **Night Ground / Night Card** (oklch(0.2046 0 0) / oklch(0.2686 0 0)): dark-mode ground and cards (tweakcn Modern Minimal dark).
- **Night Band** (oklch(0.165 0.012 262); oklch(0.135 0.01 262) in dark mode, deeper than the dark ground so it still reads as a darker material, plus a 10% white ring): dark bands, rail cards, step 3 and terminals in both modes.

### Named Rules
**The Status Is Sacred Rule.** Green, amber and red only describe a server's state (running / external or starting / failed). Never decoration, never JSON syntax: terminals use the syntax blues and lilac. The one exception is reproduced log output (HTTP 200 / 401), which keeps the real tool's colors.
**The Signal Deep Rule.** Small text or chips in blue use Signal Deep (oklch(0.52 0.2 262) on light, oklch(0.74 0.14 255) on dark) to clear 4.5:1; plain Signal Blue is for large type, icons and focus.
**The One Signal Rule.** Signal Blue covers less than 10% of any viewport: one accent word per headline, plus focus and active states.

## Typography

**Display Font:** Satoshi (self-hosted variable, 300–900, roman + italic)
**Body Font:** DM Sans (next/font/google)
**Label/Mono Font:** system monospace stack, for code and port numbers only

**Character:** Satoshi's geometric, slightly mechanical forms read like signage at a port; DM Sans keeps long explanations calm.

### Hierarchy
- **Display** (800, clamp(2.6rem, 5.6vw, 4.6rem), 0.98, -0.04em): the hero headline only.
- **Headline** (800, clamp(2.2rem, 4.6vw, 3.75rem), 1.02, -0.035em): section titles, centered or left per composition.
- **Brand** (900, 1.375rem): the Vigie wordmark next to the logo.
- **Title** (700, 1.25rem, 1.25): card and step titles.
- **UI** (Satoshi 700, 1.0625rem): buttons, column titles, step chips.
- **Lede** (400, 1.125rem, 1.6, max 62ch): section intros.
- **Body / Small** (400, 1rem / 0.9375rem): lists, card copy, nav links.
- **Code** (system mono, 0.875rem, 1.7): terminals and commands only.
- **Caption** (500, 0.8125rem): chips, timestamps, tags.

Tokens live in `globals.css` as `--text-caption`, `--text-code`, `--text-small`, `--text-ui`, `--text-title`, `--text-brand` (Tailwind `text-*`), alongside Tailwind's `text-base` and `text-lg`. No literal pixel sizes in components.

### Named Rules
**The Italic Signal Rule.** The accent word of a headline is Satoshi Black Italic in Signal Blue. One per headline, never two.

## Layout

Centered 1200px container (max-w 75rem) with 20px gutters on mobile, 32px from 768px. Section rhythm: 128px vertical on desktop, 88px on mobile, more space above a heading than below it. Hero and closing band are centered; feature sections alternate a text column with an illustrated panel (5/7 split) and collapse to one column below 1024px. Horizontal card rails scroll with snap on touch and arrow buttons on desktop.

## Elevation & Depth

Layered paper: white surfaces float on the deck with a soft, offset shadow; nothing glows except range rings inside dark bands.

### Shadow Vocabulary
- **Card rest** (`0 1px 2px oklch(0.2 0.02 262 / 0.04), 0 12px 32px -16px oklch(0.2 0.02 262 / 0.18)`): cards, nav, frames.
- **Button ink** (`0 1px 0 oklch(1 0 0 / 0.12) inset, 0 10px 24px -10px oklch(0.21 0.02 262 / 0.6)`): primary buttons.

## Shapes

Generous, consistent rounding on one scale: 44px for the closing band, 28px for frames, panels and dark cards, 20px for the nav and selected list cards, 16px for vignettes and inner window edges, 14px for buttons, 12px for small controls, 8px for chips and pointers, pills for status chips and tabs. Dashed hairlines separate list rows and FAQ items. Range rings (concentric circles) are the only ornament.

## Components

### Buttons
- **Primary:** Harbor Ink fill, white label, 14px radius, inset highlight + ink shadow; icon at the end. In dark mode it inverts to Card White with ink label.
- **Quiet:** white fill, hairline border; hover deepens the border.

### Chips / Tabs
- Pill segmented control on a Hairline-tinted track; the active pill is Card White with card-rest shadow.

### Cards / Containers
- 16–28px radius per the Shapes scale, Card White, hairline border, card-rest shadow, 16–28px padding. Dark variant uses Night Band with an inner hairline at 8% white.

### Navigation
- Floating white bar, 20px radius, 16px from the top, sticky; links in DM Sans 500; theme toggle and two buttons on the right; a full-width sheet on mobile.

### Product Frame (signature)
- White outer frame (28px radius, 14px padding) holding a real screenshot of the Vigie window; light screenshot in light mode, dark screenshot in dark mode.

## Do's and Don'ts

### Do:
- **Do** show the real Vigie window and real CLI output; demo data is labeled as such.
- **Do** keep terminals and the closing band in Night Band in both themes.
- **Do** keep one accent word per headline in Satoshi Black Italic, Signal Blue.

### Don't:
- **Don't** use a script or handwritten face anywhere.
- **Don't** show testimonials, user counts, ratings, customer logos or any social proof.
- **Don't** use green, amber or red for anything but server state.
- **Don't** load any font family other than Satoshi and DM Sans.
