# CHIMERA — UI / UX Design System

## Visual identity

CHIMERA's identity is **dark security operations center meets evolving organism**. The interface should feel like watching a living system — neither sterile dashboard nor toy game.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| `bg.950` | `#04060b` | App background |
| `bg.900` | `#070a13` | Panel surface |
| `cy.300` | `#4be9d2` | Primary accent (signal, defense) |
| `cy.500` | `#0ab59f` | Buttons / focus |
| `danger.500` | `#ff3b6e` | Compromise / attacker |
| `warn.500` | `#ffc857` | Quarantine / monitor |
| `ink.100..400` | `#d8e1f3 … #525a6f` | Typographic ramp |

Defenders are always **cyan**. Attackers are always **magenta-red**. Lobster Trap is **amber**. This is a strict convention — never use cyan for an attack signal.

## Typography

- Display / headings: **Space Grotesk** (geometric, slightly cinematic)
- Body: same family, lighter weights
- Mono: **JetBrains Mono** (terminal, chips, log lines)

## Motion

- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- Entries: 200–400 ms, fade + 8–16 px translate
- Pulsing accents: 2.4 s loop, contained to "live" state badges only
- The neural-mesh canvas is *deliberately* slow (sub-1Hz drift). No flicker.

## Components

- `panel` — rounded surface with a cyan-tinted border
- `chip` — small mono-cased state pill; `chip-danger`, `chip-warn` variants
- `btn` / `btn-primary` — terminal-style buttons with cyan glow on hover
- `stat` — KPI tile (label + large number)
- `scanline` — overlay applied to live panels (subtle CRT scan)

## Information density

Three-zone layout per page:
1. Header strip — title + chip + actions
2. KPI strip — four-up numbers
3. Body — split between graph and stream (Arena) or table + inspector (Defense)

Never put more than seven primary objects on screen at once. The arena's
graph and terminal are designed to feel "alive" without overwhelming.

## Tone of copy

- Active, present tense
- Direct, slightly clinical
- Avoid hype words: "revolutionary", "AI-powered", "next-gen"
- Prefer named primitives: "Lobster Trap", "Attack Genome", "CRI"
