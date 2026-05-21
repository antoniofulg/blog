---
name: Antonio Fulgencio Blog
description: Editorial-technical reading surface for long-form posts about React, TypeScript, Bun, and TanStack.
colors:
  background: "#F5F8FC"
  surface: "#EAECEE"
  muted: "#DDE0E3"
  card: "#FFFFFF"
  code-bg: "#272D34"
  foreground: "#272D34"
  foreground-secondary: "#3F4750"
  foreground-muted: "#666666"
  foreground-inverse: "#FAFAFA"
  foreground-code: "#C8D1DC"
  accent: "#097098"
  accent-hover: "#0A5E7E"
  accent-light: "#E0F3FA"
  border: "#C2C8CE"
  border-strong: "#A8B0B8"
  success: "#41AD4E"
  warning: "#E3946A"
  error: "#EE5F50"
  callout-tip: "#E8F7E9"
  callout-info: "#E5F5FB"
  callout-warn: "#FDF0EA"
  callout-error: "#FDE9E7"
  tag-react: "#097098"
  tag-typescript: "#B377E3"
  tag-bun: "#E39C03"
  tag-tanstack: "#EE5F50"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.foreground-inverse}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    width: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  tag-badge:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  post-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  callout-info:
    backgroundColor: "{colors.callout-info}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  callout-tip:
    backgroundColor: "{colors.callout-tip}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  callout-warn:
    backgroundColor: "{colors.callout-warn}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  callout-error:
    backgroundColor: "{colors.callout-error}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  code-block:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.foreground-code}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
---

# Design System: Antonio Fulgencio Blog

## 1. Overview

**Creative North Star: "The Engineer's Notebook"**

A reading surface that feels like a working engineer's bound notebook: ruled, lightly cool, full of precise marks rather than decoration. The grid is felt but never drawn. Type is the architecture; color is a small set of deliberate marks on a calm page. Code blocks sit in the layout with the same weight as a paragraph — they are part of the argument, not an interruption.

The page assumes the reader came to think. Nothing competes with the prose: no sidebars on post pages, no related-grid distraction, no engagement bait. The author's voice is "patient, precise, generous"; the surface matches it. Light theme is the writer's daylight desk; dark theme is the same notebook under a desk lamp at 11pm. Neither is the "real" theme.

This system explicitly rejects: Medium-style SaaS blog gloss (stock heroes, AI gradients, clap counters), Dev.to community noise (sidebars, reaction bars, follow buttons), portfolio brutalism (neon-on-black, ASCII, deliberately broken layout), and corporate engineering-blog anonymity (all-caps eyebrows, perfect grid with no fingerprint).

**Key Characteristics:**
- Tonal layering, not shadow drama: depth comes from stepping `background → surface → muted → card`, not from box-shadows.
- One steady accent — **Workshop Cyan** — used sparingly on links, focus, tags, and primary action only.
- Inter for everything readable; JetBrains Mono for everything executable. No third typeface.
- Generous body line-height (1.7) and 65–75ch measure on long-form prose.
- Quiet borders (1px, `border` token) do the structural work that shadows would in a softer system.
- Restrained motion: `transition-colors` and `transition-shadow` only. No parallax, no choreography, no springs.

## 2. Colors: The Workshop Palette

The palette has one voice and many quiet supports. Cool-tinted neutrals (every neutral leans toward the accent's hue family, never pure gray) carry 90%+ of the surface. The accent is the only saturated color the reader meets on a typical page; everything else is a structural neutral or a callout-state color that appears only when warranted.

### Primary

- **Workshop Cyan** (`#097098` light / `#69C3FF` dark): The single brand voice. Used for links inline in prose, primary button background, focus rings, the Terminal mark in the header lockup, and the `react` tag. Never used as a background fill on large areas. In dark mode it brightens to a teal-leaning blue to maintain comfortable contrast against the deep navy ground.
- **Workshop Cyan — Hover** (`#0A5E7E` light / `#8BD3FF` dark): Single-step darker (light) or brighter (dark) on hover. The transition is `transition-colors`, never a glow.
- **Workshop Cyan — Wash** (`#E0F3FA` light / `#1A2A3D` dark): A breath of the accent for tag-badge fills and `callout-info`. Saturated enough to read as "of the brand", dim enough to never compete with prose.

### Secondary

The system has no secondary accent. The state colors below carry intent; they are not used as decorative secondaries.

### Tertiary — Tag Colors (Topic Coding Only)

Used on post-list tag chips and never on prose. Each maps one ecosystem to one hue so the reader can scan a list of posts and find what they want.

- **React Cyan** (`#097098` light / `#69C3FF` dark): Shared with the primary accent; this is intentional — React is the house technology.
- **TypeScript Violet** (`#B377E3` light / `#B78AFF` dark): The TS topic.
- **Bun Amber** (`#E39C03` light / `#EACD61` dark): The Bun topic.
- **TanStack Coral** (`#EE5F50` light / `#E35535` dark): The TanStack-family topic. Shares its hue with `error`; tag context disambiguates.

### Neutral — Tonal Surface Stack

A four-step tonal ladder. Depth is layering, not lifting.

- **Sky Paper** (`#F5F8FC` light / `#1C2433` dark) — `background`: The page ground.
- **Mist** (`#EAECEE` light / `#171D2A` dark) — `surface`: Header strip, secondary panels, ghost-button rests.
- **Stone** (`#DDE0E3` light / `#232D3E` dark) — `muted`: Active toolbar buttons, code language chips, the post-card image placeholder.
- **Card White** (`#FFFFFF` light / `#1E2838` dark) — `card`: The "lifted" tier. Used on PostCard, modals, inputs.
- **Ink** (`#272D34` light / `#C8D1DC` dark) — `foreground`: Body text and headings.
- **Slate** (`#3F4750` light / `#8196B5` dark) — `foreground-secondary`: Secondary prose, link rests, descriptions.
- **Graphite** (`#666666` light / `#8FA5C0` dark) — `foreground-muted`: Captions, metadata, timestamps.
- **Pencil Line** (`#C2C8CE` light / `#151B27` dark) — `border`: The 1px ruled line that does most of the structural work.
- **Heavier Pencil** (`#A8B0B8` light / `#2A3545` dark) — `border-strong`: For interactive borders (inputs on focus, dividers in dense layouts).
- **Ink Block** (`#272D34` light / `#141A26` dark) — `code-bg`: The code-block ground. Dark in both themes by design.

### State Colors (Callouts Only)

State colors live exclusively in callouts, form validation, and small status indicators. They are never used decoratively.

- **Tip Green** (`#41AD4E` light / `#3CEC85` dark) — `success`: Callout-tip icon, success states.
- **Caution Amber** (`#E3946A` light / `#FF955C` dark) — `warning`: Callout-warn icon.
- **Alert Coral** (`#EE5F50` light / `#E35535` dark) — `error`: Callout-error icon, form errors. Shares hue with TanStack tag (different context, no collision in practice).

Callout backgrounds (`callout-tip`, `callout-info`, `callout-warn`, `callout-error`) are dim tints of these hues, sized to sit gently inside flowing prose.

### Named Rules

**The Workshop Cyan Rule.** Workshop Cyan is the only saturated color a reader meets on a typical page. It appears on links, focus rings, the primary button, and the React tag. It does not fill large areas, does not gradient, and does not appear on hero backgrounds. Its rarity is what makes it read as "the brand".

**The Tonal-Step Rule.** Depth is achieved by stepping through `background → surface → muted → card`, in that order. Shadows are a separate, optional tool used only on PostCard hover. A panel that needs to sit "above" the page steps one neutral lighter (light theme) or one neutral darker (dark theme). Never both.

**The Pencil-Line Rule.** Borders are 1px and use `border` (or `border-strong` for interactive emphasis). Any border heavier than 1px on a card or list item is a defect, not a design choice. Side-stripe colored borders (`border-left: 3px solid …`) are forbidden everywhere; see the absolute bans.

## 3. Typography

**Display Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Inter (same family — single-family system)
**Code Font:** JetBrains Mono (with `ui-monospace, monospace` fallback)

**Character:** Inter at every level — single-family discipline. Hierarchy is built from weight, scale, and tracking, never from font swapping. JetBrains Mono earns its place only inside `<pre><code>` and inline `<code>`. The pairing reads as engineer-precise without being terminal-cosplay.

### Hierarchy

- **Display** (700, `clamp(2rem, 4.5vw, 3rem)`, 1.15, tracking `-0.02em`): Post title at the top of a post, hero headlines on landing pages. Used sparingly — one per page maximum.
- **Headline** (700, 1.5rem / 24px, 1.25, tracking `-0.01em`): Second-tier headings (`<h2>` within posts), section titles on the home page.
- **Title** (700, 1.125rem / 18px, 1.35): PostCard titles, callout titles, in-page subsection headings (`<h3>`).
- **Body** (400, 1rem / 16px, 1.7): Prose body. Long-form measure capped at **65–75ch** on `<article>` containers. Line-height is intentionally generous — the body type is reading type, not UI type.
- **Label** (500, 0.875rem / 14px, 1.4): Buttons, badges, navigation, dates, metadata. The UI voice of the system.
- **Caption / Muted** (400, 0.75rem / 12px, 1.4): Timestamps on PostCards, code-block language chips, footer text.
- **Code** (400, 0.875rem / 14px, JetBrains Mono, 1.625): Inline and block code. Inline code uses the same family with a `bg-muted` tint and `rounded-sm`; block code lives in `code-block` with dark `code-bg` regardless of theme.

### Named Rules

**The Single-Family Rule.** Inter carries every readable character on the site. Adding a third typeface (display serif, accent script, etc.) is a brief-level decision and must be justified by PRODUCT.md, not introduced at the component level.

**The 65-Character Rule.** Long-form prose lives between 65 and 75 characters per line. The `<article>` container enforces this with `max-w-prose` or an equivalent measure. Posts that exceed 75ch get harder to read in both languages; pt-br's longer average word makes 70ch the practical sweet spot.

**The Monospace-Earned Rule.** JetBrains Mono is for executable text only — code, kbd, file paths. It does not appear in headings, captions, eyebrows, or anywhere "to look technical". The blog is technical; the type doesn't need to perform it.

## 4. Elevation

The system is **flat-by-default with tonal layering**. Depth is achieved by stepping through the neutral stack (`background → surface → muted → card`), not by shadowing. Shadows are reserved for one specific behavior: signaling interactivity on PostCard hover.

### Shadow Vocabulary

- **PostCard Hover** (`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` — Tailwind `shadow-md`): Applied on `hover` to PostCard only. Transition is `transition-shadow`. This is the only place shadow appears in the system.

No `shadow-sm`, no `shadow-lg`, no `shadow-xl` anywhere in the codebase. If a design proposal calls for them, propose tonal stepping or a 1px border instead.

### Named Rules

**The Flat-By-Default Rule.** Surfaces sit flat at rest. The only sanctioned shadow is the PostCard hover lift, and only because it answers a real affordance question ("is this clickable?"). Any other shadow needs a written justification.

**The Layer-Don't-Lift Rule.** When a panel needs to feel separate from its parent, step it one tonal level (lighter in light theme, lighter in dark theme too — the dark-theme `card` is lighter than `background`, deliberately). Don't reach for a shadow.

## 5. Components

Component character is **restrained and structural**. Quiet borders, generous padding, no decoration. Hover is a tonal step or a `transition-colors` to the next foreground/background pair; never a glow, never a scale, never a bounce.

### Buttons

- **Shape:** `rounded-md` (8px). Pill-shaped buttons are reserved for tag-badges; they do not appear as action buttons.
- **Primary** (`button-primary`): `bg-accent` (`#097098`) with `text-foreground-inverse` (`#FAFAFA`). Padding `0 20px`, height `44px`. Used for the single most important action on a page (e.g. Newsletter subscribe). One primary per surface, maximum.
  - Hover: `bg-accent-hover` (`#0A5E7E`). Transition: `transition-colors` ~150ms.
  - Focus: visible 2px focus ring using `accent` at 60% opacity, offset 2px.
- **Ghost** (`button-ghost`): `bg-surface` with `text-foreground`. Square `40×40px` for icon-only header utilities (theme toggle, language toggle, mobile menu trigger). `rounded-md`.
  - Hover: `bg-muted`. Transition: `transition-colors`.
- **Secondary / Tertiary:** Not currently in the system. If introduced, follow the ghost shape with a 1px `border-strong` outline; do not add a third color.

### Tag Badges

- **Style:** `bg-accent-light` (`#E0F3FA`) with `text-accent` (`#097098`), `rounded-full`, `padding: 6px 12px`, `text-xs font-medium` (label-scale typography).
- **Topic variants** (when used on post lists): swap `bg-*-light` and `text-*` to the topic color (React / TypeScript / Bun / TanStack). The shape stays identical; only hue changes.
- **State:** non-interactive by default. If made clickable as a filter, add `transition-colors` and an `aria-pressed` state.

### Post Card

- **Corner Style:** `rounded-lg` (12px).
- **Background:** `bg-card` (`#FFFFFF` / `#1E2838`).
- **Border:** 1px solid `border`.
- **Shadow Strategy:** flat at rest; `shadow-md` on hover via `transition-shadow`. See Elevation.
- **Internal Padding:** `p-5` (20px) on the text region. The image well above is fixed `h-48` (192px) and uses `bg-muted` as a placeholder ground.
- **Title color shift:** title gains `text-accent` on group-hover via `group-hover:text-accent`. The accent fade is the affordance.

### Callout

A flowing block inside prose that pauses the reader. The single most distinctive in-content component on the site.

- **Shape:** `rounded-lg` (12px), `p-4` (16px), `flex gap-3`.
- **Background:** one of four state tints (`callout-tip`, `callout-info`, `callout-warn`, `callout-error`).
- **Icon:** Lucide icon (`CheckCircle`, `Info`, `AlertTriangle`, `XCircle`) at `h-5 w-5`, tinted with the matching state color.
- **Typography:** `text-sm leading-relaxed` for the body, optional `text-sm font-semibold` title.
- **No border.** The tint is the boundary. Adding a 1px border to a callout breaks the "soft pause" feel.

### Code Block (signature component)

The single most weighted in-prose element. Treated as a peer to paragraphs, not as a digression.

- **Shape:** `rounded-lg` (12px) with 1px `border`.
- **Background:** `bg-code-bg` (`#272D34` light / `#141A26` dark) — always dark, in both themes. This is deliberate. Code reads better on a dark ground for the reading audience, and the dark slab gives the prose stretches around it visual rhythm.
- **Header strip (optional):** when `filename` is present, a 1px-bordered strip shows the filename (left, `text-foreground-muted`) and a language chip (right, `bg-muted` pill, `text-xs`).
- **Body:** `pre.overflow-x-auto p-4` with JetBrains Mono at 14px, line-height 1.625, `text-foreground-code` (`#C8D1DC`).
- **Copy button:** absolutely positioned top-right, `h-8 w-8`, `bg-muted` icon button. Switches Copy → Check icon with `text-success` on success, auto-revert after 2s.

### Inputs / Fields

- **Style:** `bg-card`, 1px `border`, `rounded-md` (8px). Height `44px`. Padding `0 14px`. Body-scale typography.
- **Focus:** border swaps to `border-strong` plus a 2px focus ring (`ring-accent` at 60% opacity), offset 2px. No glow.
- **Error:** border becomes `error`, with helper text below in `text-error text-sm`.
- **Placeholder:** `text-foreground-muted`. Never an example of valid data — placeholders are hints, not specimens.

### Navigation

- **Header:** sticky-top, `h-16`, `bg-background`, 1px `border-b border-border`. Padding `px-6 lg:px-20`.
- **Logo lockout:** `Terminal` Lucide icon in `text-accent` + author name in `font-heading text-lg font-bold`. The Terminal mark is the only place the brand mark appears.
- **Nav links:** `text-sm font-medium text-foreground-secondary` at rest; `text-accent` on hover. `transition-colors`. No underline, no pill background.
- **Utility cluster** (right side): theme toggle, language toggle, mobile-menu trigger. All ghost buttons.
- **Mobile menu:** full-screen `fixed inset-0` overlay with `bg-background`, list items separated by 1px `border-b`. No animation on open; menu appears.

### Author Card

- **Shape:** `rounded-lg`, `bg-card`, 1px `border`, padding `p-4` to `p-5`.
- **Layout:** small avatar (rounded), name in `font-heading font-bold`, role/bio in `text-sm text-foreground-secondary`.
- **Behavior:** flat, no hover state. This is an information surface, not a CTA.

### Table of Contents (TOC)

- **Style:** vertical list with a 2px left border per item using `border-l-2`. **This is the single sanctioned use of a colored left border in the system** — and only because TOC items map to anchor positions, where the rail is functional, not decorative. Color shifts (`border-accent` for the active item, `border-border` for inactive) on `transition-colors`.

### WIP Banner

- **Style:** full-width strip across the top of the layout while in pre-launch. `bg-accent` with `text-foreground-inverse`. Dismissible. `rounded` (4px on the close button only).
- **Behavior:** appears on first visit, dismiss persists via local state.

## 6. Do's and Don'ts

### Do

- **Do** use Workshop Cyan (`#097098`) as the only saturated color on a typical page — links, primary button, focus rings, the Terminal mark.
- **Do** lead with type. Hierarchy is built with Inter weight contrast (400 / 500 / 700) and scale steps ≥1.25; never reach for a second display family.
- **Do** cap body prose at 65–75ch on every long-form layout. Test in pt-br first; if it works there, it works in en.
- **Do** layer with tonal steps (`background → surface → muted → card`) when something needs to feel separate from its parent.
- **Do** keep code blocks dark in both light and dark themes. The dark slab is part of the rhythm.
- **Do** respect `prefers-reduced-motion`. Every `transition-colors` and `transition-shadow` must degrade to instant.
- **Do** use real `<pre><code>` for code, real `<h1>`–`<h3>` for hierarchy, real `<button>` for buttons. Semantic HTML is the accessibility floor.
- **Do** use callouts to surface tradeoffs and caveats the author wants the reader to slow down on. They are pedagogical, not decorative.
- **Do** keep visible focus rings on every interactive element.

### Don't

- **Don't** ship anything that resembles a Medium-style SaaS blog post: centered hero title, AI-gradient banner, stock photo, clap counter, reading-time chip. PRODUCT.md rejects this by name.
- **Don't** ship anything that resembles Dev.to / Hashnode chrome: sidebars on post pages, reaction bars, follow buttons, related-post grids around the article. Reading is the experience; chrome competes with it.
- **Don't** ship portfolio brutalism: neon-on-black, monospace headings, ASCII decoration, deliberately broken layout. The Engineer's Notebook is precise, not provocative.
- **Don't** ship corporate engineering-blog gloss: all-caps eyebrows, perfect 12-column grid with no fingerprint, dot-matrix backgrounds, lifeless polish.
- **Don't** use side-stripe colored borders on cards, list items, callouts, or alerts. The TOC's 2px left rail is the only sanctioned use; everywhere else is forbidden.
- **Don't** use gradient text. `background-clip: text` plus a gradient background is decorative and forbidden. Emphasis comes from weight or size.
- **Don't** use glassmorphism — no `backdrop-filter: blur` decorative use, no frosted cards. Not in the system.
- **Don't** introduce shadows beyond the PostCard hover lift without a written justification. The system is flat-by-default.
- **Don't** use bouncy or elastic easing. Motion is `ease-out-quart` or simpler. No `cubic-bezier(0.68, -0.55, 0.27, 1.55)`.
- **Don't** animate CSS layout properties (width, height, padding, margin). Animate opacity and transform only.
- **Don't** use a sidebar on a post page (`/blog/$slug`). Posts are uninterrupted. Navigation belongs in the header.
- **Don't** reach for a modal as the first thought. Inline disclosure and progressive forms come first; modals are a last resort.
- **Don't** invent a second accent color "to add variety". The Workshop Cyan Rule is non-negotiable.
- **Don't** use em dashes (`—` or `--`) in UI copy. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** treat pt-br as a degraded en. If a layout breaks in pt-br because the word is longer, fix the layout, not the translation.
