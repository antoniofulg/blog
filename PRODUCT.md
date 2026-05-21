# Product

## Register

brand

## Users

Curious engineers and early-career developers working in modern web stacks (React, TypeScript, Bun, TanStack family, Postgres). They land on a post because a search result, a link, or a recommendation promised a real explanation of something they're trying to understand. They are smart but not necessarily senior — they're here to leave understanding *why* a pattern works, not just to copy a snippet.

Reading context is focused, often deep: tab open while debugging, coffee in hand on a weekend, RSS reader. Bilingual: posts appear in English and Brazilian Portuguese. The pt-br audience is a first-class citizen, not a translation afterthought.

## Product Purpose

Antonio Fulgencio's personal blog. Long-form, technical writing that explains the reasoning behind patterns, tradeoffs, and decisions in modern web development. Posts are the product. The admin surface exists so the author can publish; readers never see it.

Success looks like: a reader finishes a post, understands why the pattern exists, and can apply or adapt it tomorrow. Bounce rate on long posts is a feature signal, not a vanity metric.

## Brand Personality

Patient, precise, generous.

Voice teaches without condescending. Explains the why before the what. Admits uncertainty where it exists. Strong views, lightly held — opinionated where the author has earned it, hedged where the territory is genuinely unsettled. The blog reads like a senior engineer who still remembers being junior and writes the post they wish they'd found.

Emotional outcome: calm focus, the small thrill of "oh — that's why."

## Anti-references

The blog must not resemble any of these patterns:

- **Medium-style SaaS blog**: centered title, big stock-photo hero, AI-generated gradient banner, reading-time chip, clap counter. Indistinguishable from every content-marketing post on the internet.
- **Dev.to / Hashnode community platforms**: busy sidebars, tag soup, reaction bars, follow buttons, related-post grids, social cruft framing the content.
- **Personal portfolio brutalism**: neon-on-black, monospace headings everywhere, ASCII decorations, deliberately broken layout. Trying-too-hard hacker aesthetic that prioritizes persona over readability.
- **Corporate engineering blog (Stripe/Vercel lookalike)**: technically clean but anonymous. All-caps eyebrows, perfect 12-column grid, no fingerprints. Polish without a person behind it.

The blog should feel like a publication owned by one human who writes carefully — closer in spirit to A List Apart, Increment, or a well-typeset essay than to any of the above.

## Design Principles

1. **Reading is the experience.** Long-form typography, generous focus, no chrome competing with the prose. Sidebars, social rails, and related-post grids are off the table on post pages. Code blocks get real weight because code is part of the argument.
2. **Teach by showing the why.** The design should reinforce that posts are explanations, not announcements. Hierarchy guides the eye through reasoning steps. Callouts surface caveats and tradeoffs the author wants the reader to slow down on.
3. **Generous, never condescending.** Visual tone matches the voice: patient, precise, no marketing varnish. No "you should be excited" energy, no FOMO patterns, no engagement bait.
4. **Personality without performance.** The author shows up — color choice, type, a quiet wit — without becoming the show. Quietly opinionated beats loudly stylized. Brutalism and corporate-clean are equally off-limits.
5. **Bilingual parity.** Every layout decision must hold in both English and Brazilian Portuguese. Type sizes, line lengths, button labels, hierarchy — all tested in the language with the longer words. Translations are not a degraded experience.

## Accessibility & Inclusion

- **WCAG 2.2 AA** is the floor across the public blog and admin.
- Body text contrast comfortable above 4.5:1 in both light and dark themes; aim for ≥7:1 where it doesn't fight the editorial palette.
- Respect `prefers-reduced-motion` — no parallax, no auto-playing motion, transitions must degrade to instant.
- Visible focus rings on every interactive element. Keyboard navigation is a first-class path, not an afterthought.
- All images carry meaningful `alt` text; decorative images use `alt=""` explicitly. Code blocks are real `<pre><code>`, not images.
- Light and dark themes are equal citizens — neither is the "real" theme. Theme toggle is keyboard-reachable.
